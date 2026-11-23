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
        body.put("max_tokens", request.maxOutputTokens() > 0 ? request.maxOutputTokens() : ai.getMaxOutputTokens());
        body.put("temperature", 0.2);

        List<Map<String, Object>> msgList = new ArrayList<>();
        for (GatewayMessage m : request.messages()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("role", m.role());
            if ("tool".equals(m.role())) {
                entry.put("tool_call_id", m.toolCallId());
                entry.put("name", m.toolName());
                entry.put("content", m.content() != null ? m.content() : "{}");
            } else {
                entry.put("content", m.content() != null ? m.content() : "");
                if (m.toolCalls() != null && !m.toolCalls().isEmpty()) {
                    List<Map<String, Object>> tcOut = new ArrayList<>();
                    for (GatewayToolCall tc : m.toolCalls()) {
                        Map<String, Object> fn = new LinkedHashMap<>();
                        fn.put("name", tc.toolName());
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

        if (request.tools() != null && !request.tools().isEmpty()) {
            List<Map<String, Object>> toolDefs = request.tools().stream()
                    .map(t -> Map.<String, Object>of(
                            "type", "function",
                            "function", Map.of(
                                    "name", t.name(),
                                    "description", t.description(),
                                    "parameters", t.parametersSchema()
                            )
                    ))
                    .toList();
            body.put("tools", toolDefs);
            body.put("tool_choice", "auto");
        }

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
                log.warn("9Router HTTP error model={} status={}", modelName, status);
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
                    String fnName = item.path("function").path("name").asText();
                    String argsRaw = item.path("function").path("arguments").asText("{}");
                    Map<String, Object> args = parseJsonMap(argsRaw);
                    if (StringUtils.hasText(fnName)) {
                        calls.add(new GatewayToolCall(callId, fnName, args));
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
