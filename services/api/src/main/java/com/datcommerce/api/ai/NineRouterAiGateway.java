package com.datcommerce.api.ai;

import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    public NineRouterAiGateway(AppProperties appProperties, ObjectMapper objectMapper) {
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
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

        String base = ai.getBaseUrl().replaceAll("/+$", "");
        String endpoint = base.endsWith("/v1") ? base + "/chat/completions" : base + "/v1/chat/completions";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", StringUtils.hasText(request.model()) ? request.model() : ai.getDefaultModel());
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
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("9Router HTTP error status={}", response.statusCode());
                throw new ApiException(
                        ErrorCode.AI_GATEWAY_ERROR,
                        "9Router returned status " + response.statusCode()
                );
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
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("9Router gateway invocation failed: {}", ex.getMessage());
            throw new ApiException(ErrorCode.AI_GATEWAY_ERROR, "AI gateway request failed: " + ex.getMessage());
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
}
