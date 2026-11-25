package com.datcommerce.api.ai;

import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class NineRouterAiGateway implements AiModelGateway {

    private static final Logger log = LoggerFactory.getLogger(NineRouterAiGateway.class);

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicReference<Instant> circuitOpenUntil = new AtomicReference<>(null);
    private volatile long retryBaseDelayMs = 150L;

    public NineRouterAiGateway(AppProperties appProperties, ObjectMapper objectMapper) {
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public void setRetryBaseDelayMsForTests(long retryBaseDelayMs) {
        this.retryBaseDelayMs = Math.max(0L, retryBaseDelayMs);
    }

    public void resetCircuitBreakerForTests() {
        consecutiveFailures.set(0);
        circuitOpenUntil.set(null);
    }

    @Override
    public List<AvailableModelInfo> listAvailableModels() {
        AppProperties.Ai ai = appProperties.getAi();
        if (!StringUtils.hasText(ai.getBaseUrl())) {
            throw new ApiException(
                    ErrorCode.AI_GATEWAY_ERROR,
                    "9Router baseUrl is not configured on the server"
            );
        }
        String base = ai.getBaseUrl().replaceAll("/+$", "");
        String endpoint = base.endsWith("/v1") ? base + "/models" : base + "/v1/models";

        try {
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(10))
                    .header("Accept", "application/json")
                    .GET();
            if (StringUtils.hasText(ai.getApiKey())) {
                reqBuilder.header("Authorization", "Bearer " + ai.getApiKey());
            }

            HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                throw new ApiException(
                        ErrorCode.AI_GATEWAY_ERROR,
                        "9Router /models returned status " + status
                );
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode data = root.path("data");
            if (!data.isArray()) {
                return List.of();
            }

            Map<String, AvailableModelInfo> deduped = new LinkedHashMap<>();
            for (JsonNode item : data) {
                String id = item.path("id").asText("").trim();
                if (!StringUtils.hasText(id)) {
                    continue;
                }
                String ownedBy = item.path("owned_by").asText("");
                JsonNode caps = item.path("capabilities");
                Integer contextLength = readPositiveInt(item, "context_length");
                if (contextLength == null) {
                    contextLength = readPositiveInt(caps, "contextWindow");
                }
                Integer maxOutput = readPositiveInt(item, "max_completion_tokens");
                if (maxOutput == null) {
                    maxOutput = readPositiveInt(caps, "maxOutput");
                }
                boolean vision = caps.path("vision").asBoolean(false);
                boolean tools = caps.path("tools").asBoolean(true);
                boolean reasoning = caps.path("reasoning").asBoolean(false);
                deduped.putIfAbsent(id, new AvailableModelInfo(
                        id,
                        StringUtils.hasText(ownedBy) ? ownedBy : "9router",
                        contextLength,
                        maxOutput,
                        vision,
                        tools,
                        reasoning
                ));
            }
            return List.copyOf(deduped.values());
        } catch (ApiException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.AI_GATEWAY_ERROR, "9Router /models request interrupted");
        } catch (Exception ex) {
            log.warn("Failed to list 9Router models from {}: {}", endpoint, ex.getMessage());
            throw new ApiException(ErrorCode.AI_GATEWAY_ERROR, "Failed to reach 9Router /models: " + ex.getMessage());
        }
    }

    @Override
    public GatewayTurnResponse generateTurn(GatewayRequest request) {
        AppProperties.Ai ai = appProperties.getAi();
        if (!StringUtils.hasText(ai.getBaseUrl()) || !StringUtils.hasText(ai.getApiKey())) {
            throw new ApiException(
                    ErrorCode.AI_GATEWAY_ERROR,
                    "9Router baseUrl or apiKey is not configured on the server"
            );
        }

        Instant openUntil = circuitOpenUntil.get();
        if (openUntil != null) {
            if (Instant.now().isBefore(openUntil)) {
                throw new ApiException(
                        ErrorCode.AI_GATEWAY_ERROR,
                        "AI gateway circuit breaker open; retrying shortly"
                );
            }
            circuitOpenUntil.compareAndSet(openUntil, null);
        }

        String base = ai.getBaseUrl().replaceAll("/+$", "");
        String endpoint = base.endsWith("/v1") ? base + "/chat/completions" : base + "/v1/chat/completions";

        String primaryModel = StringUtils.hasText(request.model())
                ? request.model().trim()
                : ai.getDefaultModel();
        String fallbackModel = resolveFallbackModel(ai, primaryModel);
        int maxAttempts = Math.max(1, ai.getRetryMaxAttempts());

        try {
            GatewayTurnResponse response = invokeWithRetries(endpoint, ai, request, primaryModel, maxAttempts);
            consecutiveFailures.set(0);
            circuitOpenUntil.set(null);
            return response;
        } catch (GatewayCallException primaryEx) {
            if (primaryEx.statusCode() != 401
                    && primaryEx.statusCode() != 403
                    && StringUtils.hasText(fallbackModel)
                    && !fallbackModel.equalsIgnoreCase(primaryModel)) {
                log.warn(
                        "Primary model {} failed (status={}); trying fallback model {}",
                        primaryModel, primaryEx.statusCode(), fallbackModel
                );
                try {
                    GatewayTurnResponse fallbackRes = invokeSingle(endpoint, ai, request, fallbackModel);
                    consecutiveFailures.set(0);
                    circuitOpenUntil.set(null);
                    return fallbackRes;
                } catch (GatewayCallException fallbackEx) {
                    recordCircuitFailure(ai);
                    throw new ApiException(ErrorCode.AI_GATEWAY_ERROR, fallbackEx.getMessage());
                }
            }
            recordCircuitFailure(ai);
            throw new ApiException(ErrorCode.AI_GATEWAY_ERROR, primaryEx.getMessage());
        }
    }

    private static Integer readPositiveInt(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode val = node.path(field);
        if (val.isInt() || val.isLong()) {
            int n = val.asInt();
            return n > 0 ? n : null;
        }
        return null;
    }

    private String resolveFallbackModel(AppProperties.Ai ai, String primaryModel) {
        if (primaryModel != null && primaryModel.equalsIgnoreCase(ai.getDefaultModel())) {
            return ai.getFastTaskModel();
        }
        return ai.getDefaultModel();
    }

    private void recordCircuitFailure(AppProperties.Ai ai) {
        int threshold = Math.max(1, ai.getCircuitBreakerThreshold());
        if (consecutiveFailures.incrementAndGet() >= threshold) {
            int openSec = Math.max(5, ai.getCircuitBreakerOpenSeconds());
            circuitOpenUntil.set(Instant.now().plusSeconds(openSec));
            log.warn("9Router circuit breaker opened for {}s after {} consecutive failures", openSec, threshold);
        }
    }

    private GatewayTurnResponse invokeWithRetries(
            String endpoint,
            AppProperties.Ai ai,
            GatewayRequest request,
            String modelName,
            int maxAttempts
    ) throws GatewayCallException {
        GatewayCallException lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return invokeSingle(endpoint, ai, request, modelName);
            } catch (GatewayCallException ex) {
                lastError = ex;
                if (!ex.retryable() || attempt == maxAttempts) {
                    throw ex;
                }
                long delayMs = retryBaseDelayMs * (1L << Math.min(4, attempt - 1));
                if (delayMs > 0) {
                    try {
                        Thread.sleep(delayMs);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new GatewayCallException(502, false, "AI gateway retry interrupted");
                    }
                }
            }
        }
        throw lastError != null ? lastError : new GatewayCallException(502, false, "AI gateway invocation failed");
    }

    private GatewayTurnResponse invokeSingle(
            String endpoint,
            AppProperties.Ai ai,
            GatewayRequest request,
            String modelName
    ) throws GatewayCallException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", modelName);
        body.put("stream", false);
        body.put("max_tokens", request.maxOutputTokens() > 0 ? request.maxOutputTokens() : ai.getMaxOutputTokens());
        body.put("temperature", 0.2);

        Map<String, String> wireToInternal = new LinkedHashMap<>();
        if (request.tools() != null && !request.tools().isEmpty()) {
            List<Map<String, Object>> toolDefs = new ArrayList<>();
            for (ToolDefinition t : request.tools()) {
                String wireName = toWireToolName(t.name());
                wireToInternal.put(wireName, t.name());
                toolDefs.add(Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", wireName,
                                "description", t.description(),
                                "parameters", t.parametersSchema()
                        )
                ));
            }
            body.put("tools", toolDefs);
            body.put("tool_choice", "auto");
        }

        List<Map<String, Object>> msgList = new ArrayList<>();
        for (GatewayMessage m : request.messages()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("role", m.role());
            if ("tool".equals(m.role())) {
                entry.put("tool_call_id", m.toolCallId());
                entry.put("content", m.content() != null ? m.content() : "");
            } else {
                if (m.images() != null && !m.images().isEmpty()) {
                    List<Map<String, Object>> parts = new ArrayList<>();
                    parts.add(Map.of("type", "text", "text", m.content() != null ? m.content() : ""));
                    for (ImageInput img : m.images()) {
                        if (img == null || !StringUtils.hasText(img.base64Data()) || !StringUtils.hasText(img.mimeType())) {
                            continue;
                        }
                        String dataUrl = "data:" + img.mimeType().trim() + ";base64," + img.base64Data().trim();
                        String detail = StringUtils.hasText(img.detail()) ? img.detail().trim() : "high";
                        parts.add(Map.of(
                                "type", "image_url",
                                "image_url", Map.of("url", dataUrl, "detail", detail)
                        ));
                    }
                    entry.put("content", parts);
                } else {
                    entry.put("content", m.content() != null ? m.content() : "");
                }
                if (m.toolCalls() != null && !m.toolCalls().isEmpty()) {
                    List<Map<String, Object>> tcOut = new ArrayList<>();
                    for (GatewayToolCall tc : m.toolCalls()) {
                        Map<String, Object> fn = new LinkedHashMap<>();
                        fn.put("name", toWireToolName(tc.toolName()));
                        fn.put("arguments", toJsonString(tc.arguments()));
                        tcOut.add(Map.of(
                                "id", tc.callId(),
                                "type", "function",
                                "function", fn
                        ));
                    }
                    entry.put("tool_calls", tcOut);
                }
            }
            msgList.add(entry);
        }
        body.put("messages", msgList);

        try {
            String payloadJson = objectMapper.writeValueAsString(body);
            HttpRequest httpReq = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(Math.max(10, ai.getRequestTimeoutSeconds())))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + ai.getApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                    .build();

            HttpResponse<String> response = httpClient.send(httpReq, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                String bodyPreview = response.body() != null ? response.body() : "";
                if (bodyPreview.length() > 300) {
                    bodyPreview = bodyPreview.substring(0, 300);
                }
                log.warn("9Router HTTP error model={} status={} body={}", modelName, status, bodyPreview);
                boolean retryable = status == 429 || status >= 500;
                throw new GatewayCallException(status, retryable, "9Router returned status " + status);
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode choice = root.path("choices").path(0);
            JsonNode message = choice.path("message");
            String finishReason = choice.path("finish_reason").asText("stop");
            String text = message.path("content").isNull() ? "" : message.path("content").asText("");

            List<GatewayToolCall> calls = new ArrayList<>();
            JsonNode tcNode = message.path("tool_calls");
            if (tcNode.isArray()) {
                for (JsonNode item : tcNode) {
                    String callId = item.path("id").asText("call_" + UUID.randomUUID().toString().substring(0, 8));
                    String wireName = item.path("function").path("name").asText();
                    String internalName = wireToInternal.getOrDefault(wireName, wireName.replace("__", "."));
                    String argsRaw = item.path("function").path("arguments").asText("{}");
                    Map<String, Object> args = parseJsonMap(argsRaw);
                    if (StringUtils.hasText(internalName)) {
                        calls.add(new GatewayToolCall(callId, internalName, args));
                    }
                }
            }

            int promptTokens = root.path("usage").path("prompt_tokens").asInt(0);
            int completionTokens = root.path("usage").path("completion_tokens").asInt(0);
            return new GatewayTurnResponse(text, calls, promptTokens, completionTokens, finishReason);
        } catch (GatewayCallException ex) {
            throw ex;
        } catch (IOException ex) {
            log.warn("9Router I/O failure model={}: {}", modelName, ex.getMessage());
            throw new GatewayCallException(502, true, "AI gateway network error: " + ex.getMessage());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new GatewayCallException(502, false, "AI gateway call interrupted");
        } catch (Exception ex) {
            log.warn("9Router gateway invocation failed: {}", ex.getMessage());
            throw new GatewayCallException(502, false, "AI gateway request failed: " + ex.getMessage());
        }
    }

    private static String toWireToolName(String internalName) {
        return internalName == null ? "" : internalName.replace(".", "__");
    }

    private String toJsonString(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map != null ? map : Map.of());
        } catch (Exception ex) {
            return "{}";
        }
    }

    private Map<String, Object> parseJsonMap(String raw) {
        if (!StringUtils.hasText(raw)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {
            });
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private static final class GatewayCallException extends Exception {
        private final int statusCode;
        private final boolean retryable;

        private GatewayCallException(int statusCode, boolean retryable, String message) {
            super(message);
            this.statusCode = statusCode;
            this.retryable = retryable;
        }

        private int statusCode() {
            return statusCode;
        }

        private boolean retryable() {
            return retryable;
        }
    }
}
