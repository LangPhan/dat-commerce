package com.datcommerce.api.ai;

import java.util.List;
import java.util.Map;

public interface AiModelGateway {

    GatewayTurnResponse generateTurn(GatewayRequest request);

    default List<AvailableModelInfo> listAvailableModels() {
        return List.of();
    }

    record AvailableModelInfo(
            String id,
            String ownedBy,
            Integer contextLength,
            Integer maxOutputTokens,
            boolean vision,
            boolean tools,
            boolean reasoning
    ) {
    }

    record ToolDefinition(
            String name,
            String description,
            Map<String, Object> parametersSchema
    ) {
    }

    record GatewayToolCall(
            String callId,
            String toolName,
            Map<String, Object> arguments
    ) {
    }

    record GatewayMessage(
            String role,
            String content,
            String toolCallId,
            String toolName,
            List<GatewayToolCall> toolCalls
    ) {
        public static GatewayMessage system(String content) {
            return new GatewayMessage("system", content, null, null, null);
        }

        public static GatewayMessage user(String content) {
            return new GatewayMessage("user", content, null, null, null);
        }

        public static GatewayMessage assistant(String content, List<GatewayToolCall> toolCalls) {
            return new GatewayMessage("assistant", content, null, null, toolCalls);
        }

        public static GatewayMessage toolResult(String callId, String toolName, String content) {
            return new GatewayMessage("tool", content, callId, toolName, null);
        }
    }

    record GatewayRequest(
            String model,
            List<GatewayMessage> messages,
            List<ToolDefinition> tools,
            Map<String, Object> context,
            int maxOutputTokens,
            int round
    ) {
    }

    record GatewayTurnResponse(
            String content,
            List<GatewayToolCall> toolCalls,
            int promptTokens,
            int completionTokens,
            String finishReason
    ) {
    }
}
