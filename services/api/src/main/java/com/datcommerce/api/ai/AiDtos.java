package com.datcommerce.api.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AiDtos {

    private AiDtos() {
    }

    public record AvailableModelDto(
            String id,
            String label,
            String ownedBy,
            Integer contextLength,
            Integer maxOutputTokens,
            boolean vision,
            boolean tools,
            boolean reasoning
    ) {
    }

    public record AiModelSettingsDto(
            List<String> enabledModelIds,
            List<String> availableModelIds,
            List<AvailableModelDto> availableModels,
            String defaultModelId,
            boolean gatewayReachable,
            String gatewayError
    ) {
    }

    public record UpdateAiModelSettingsRequest(
            @NotEmpty @Size(max = 30) List<@NotBlank @Size(max = 160) String> enabledModelIds
    ) {
    }

    public record CreateConversationRequest(
            @Size(max = 200) String title,
            @Size(max = 100) String model
    ) {
    }

    public record SendMessageRequest(
            @NotBlank @Size(max = 4000) String prompt,
            @Size(max = 100) String model,
            Map<String, Object> context
    ) {
    }

    public record RejectPlanRequest(@Size(max = 255) String reason) {
    }

    public record ConversationSummaryDto(
            UUID id,
            String title,
            String model,
            Instant createdAt,
            Instant updatedAt
    ) {
        static ConversationSummaryDto from(AiConversationEntity e) {
            return new ConversationSummaryDto(
                    e.getId(), e.getTitle(), e.getModel(), e.getCreatedAt(), e.getUpdatedAt()
            );
        }
    }

    public record MessageDto(
            UUID id,
            String role,
            String content,
            String model,
            Integer promptTokens,
            Integer completionTokens,
            Integer latencyMs,
            Map<String, Object> metadata,
            Instant createdAt
    ) {
        static MessageDto from(AiMessageEntity e) {
            return new MessageDto(
                    e.getId(), e.getRole(), e.getContent(), e.getModel(),
                    e.getPromptTokens(), e.getCompletionTokens(), e.getLatencyMs(),
                    e.getMetadataJson() != null ? e.getMetadataJson() : Map.of(),
                    e.getCreatedAt()
            );
        }
    }

    public record ToolCallDto(
            UUID id,
            UUID messageId,
            String toolName,
            Map<String, Object> arguments,
            Map<String, Object> resultSummary,
            String status,
            int durationMs,
            String errorMessage,
            Instant createdAt
    ) {
        static ToolCallDto from(AiToolCallEntity e) {
            return new ToolCallDto(
                    e.getId(), e.getMessageId(), e.getToolName(),
                    e.getArgumentsJson() != null ? e.getArgumentsJson() : Map.of(),
                    e.getResultSummaryJson() != null ? e.getResultSummaryJson() : Map.of(),
                    e.getStatus(), e.getDurationMs(), e.getErrorMessage(), e.getCreatedAt()
            );
        }
    }

    public record ChangePlanDto(
            UUID id,
            UUID conversationId,
            UUID messageId,
            UUID createdBy,
            String planType,
            String riskLevel,
            String requestSummary,
            String status,
            Map<String, Object> operations,
            List<Map<String, Object>> preview,
            List<Map<String, Object>> affectedResources,
            boolean reversible,
            Instant expiresAt,
            UUID approvedBy,
            Instant appliedAt,
            Instant rolledBackAt,
            String errorMessage,
            Instant createdAt,
            Instant updatedAt
    ) {
        static ChangePlanDto from(AiChangePlanEntity e) {
            return new ChangePlanDto(
                    e.getId(),
                    e.getConversationId(),
                    e.getMessageId(),
                    e.getCreatedBy(),
                    e.getPlanType(),
                    e.getRiskLevel(),
                    e.getRequestSummary(),
                    e.getStatus(),
                    e.getOperationsJson() != null ? e.getOperationsJson() : Map.of(),
                    e.getPreviewJson() != null ? e.getPreviewJson() : List.of(),
                    e.getAffectedResourcesJson() != null ? e.getAffectedResourcesJson() : List.of(),
                    e.isReversible(),
                    e.getExpiresAt(),
                    e.getApprovedBy(),
                    e.getAppliedAt(),
                    e.getRolledBackAt(),
                    e.getErrorMessage(),
                    e.getCreatedAt(),
                    e.getUpdatedAt()
            );
        }
    }

    public record ConversationDetailDto(
            ConversationSummaryDto conversation,
            List<MessageDto> messages,
            List<ToolCallDto> toolCalls,
            List<ChangePlanDto> changePlans
    ) {
    }

    public record ChatTurnResultDto(
            UUID conversationId,
            MessageDto assistantMessage,
            List<ToolCallDto> toolCalls,
            List<ChangePlanDto> changePlans
    ) {
    }

    public record AiActivityDto(
            List<ConversationSummaryDto> conversations,
            List<ChangePlanDto> changePlans
    ) {
    }
}
