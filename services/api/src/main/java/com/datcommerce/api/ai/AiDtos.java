package com.datcommerce.api.ai;

import com.datcommerce.api.cart.CartService;
import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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

    public record CustomerAiQuotaDto(
            boolean enabled,
            long dailyLimit,
            long usedTokens,
            long remainingTokens,
            int requestCount,
            Instant resetsAt,
            String modelId
    ) {
    }

    public record AdminCustomerUsageRowDto(
            UUID userId,
            String fullName,
            String email,
            String accountType,
            long promptTokens,
            long completionTokens,
            long totalTokens,
            long dailyLimit,
            int requestCount,
            Instant updatedAt
    ) {
    }

    public record AiModelSettingsDto(
            List<String> enabledModelIds,
            List<String> availableModelIds,
            List<AvailableModelDto> availableModels,
            String defaultModelId,
            boolean gatewayReachable,
            String gatewayError,
            boolean customerAiEnabled,
            int dailyTokenLimitPerUser,
            String customerAiModelId
    ) {
        public AiModelSettingsDto(
                List<String> enabledModelIds,
                List<String> availableModelIds,
                List<AvailableModelDto> availableModels,
                String defaultModelId,
                boolean gatewayReachable,
                String gatewayError
        ) {
            this(enabledModelIds, availableModelIds, availableModels, defaultModelId, gatewayReachable, gatewayError, true, 20000, defaultModelId);
        }
    }

    public record UpdateAiModelSettingsRequest(
            @NotEmpty @Size(max = 30) List<@NotBlank @Size(max = 160) String> enabledModelIds,
            Boolean customerAiEnabled,
            @Min(1000) @Max(500000) Integer dailyTokenLimitPerUser,
            @Size(max = 160) String customerAiModelId
    ) {
        public UpdateAiModelSettingsRequest(List<String> enabledModelIds) {
            this(enabledModelIds, null, null, null);
        }
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

    // ---- Storefront Customer Shopping AI ----

    public record StorefrontChatRequest(
            UUID conversationId,
            @NotBlank @Size(max = 4000) String message,
            @Size(max = 500) String currentPath,
            @Size(max = 200) String productSlug
    ) {
    }

    public record StorefrontProductRecommendationDto(
            UUID productId,
            UUID defaultVariantId,
            String slug,
            String name,
            String brand,
            BigDecimal price,
            String imageUrl,
            String variantTitle,
            String sku,
            int availableStock
    ) {
    }

    public record CheckoutPrefillDto(
            String customerName,
            String customerEmail,
            String line1,
            String city,
            String state,
            String postalCode,
            String shippingMethod,
            String promotionCode,
            String note
    ) {
    }

    public record StorefrontChatResponse(
            UUID conversationId,
            String reply,
            String model,
            int promptTokens,
            int completionTokens,
            List<StorefrontProductRecommendationDto> recommendedProducts,
            CartService.CartResponse updatedCart,
            CheckoutPrefillDto checkoutPrefill,
            boolean checkoutAutoSubmit,
            CustomerAiQuotaDto quota
    ) {
    }

    public record CustomerConversationSummaryDto(
            UUID id,
            String title,
            String model,
            Instant createdAt,
            Instant updatedAt
    ) {
        static CustomerConversationSummaryDto from(CustomerAiConversationEntity e) {
            return new CustomerConversationSummaryDto(
                    e.getId(),
                    e.getTitle(),
                    e.getModel(),
                    e.getCreatedAt(),
                    e.getUpdatedAt()
            );
        }
    }

    public record CustomerMessageDto(
            UUID id,
            String role,
            String content,
            String model,
            int promptTokens,
            int completionTokens,
            List<StorefrontProductRecommendationDto> recommendedProducts,
            CheckoutPrefillDto checkoutPrefill,
            Instant createdAt
    ) {
    }

    public record CustomerConversationDetailDto(
            CustomerConversationSummaryDto conversation,
            List<CustomerMessageDto> messages,
            CustomerAiQuotaDto quota
    ) {
    }
}
