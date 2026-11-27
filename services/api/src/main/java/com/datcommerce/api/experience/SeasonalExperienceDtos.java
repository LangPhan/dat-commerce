package com.datcommerce.api.experience;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SeasonalExperienceDtos {

    private SeasonalExperienceDtos() {
    }

    public record TemplateDto(
            String presetKey,
            String name,
            String category,
            String description,
            String accentColor,
            String previewGradient,
            List<String> tags,
            int defaultPriority,
            String defaultBlendMode,
            List<String> defaultExclusiveGroups,
            Map<String, Object> config
    ) {
    }

    public record ExperienceVersionDto(
            UUID id,
            int versionNumber,
            Map<String, Object> config,
            String changeSummary,
            UUID createdBy,
            Instant createdAt
    ) {
        static ExperienceVersionDto from(SeasonalExperienceVersionEntity e) {
            return new ExperienceVersionDto(
                    e.getId(),
                    e.getVersionNumber(),
                    e.getConfigJson(),
                    e.getChangeSummary(),
                    e.getCreatedBy(),
                    e.getCreatedAt()
            );
        }
    }

    public record ExperienceSummaryDto(
            UUID id,
            String slug,
            String name,
            String description,
            String category,
            String presetKey,
            String status,
            String activationMode,
            boolean manualOverride,
            Instant startsAt,
            Instant endsAt,
            String timezone,
            String recurrenceRule,
            int priority,
            String blendMode,
            List<String> exclusiveGroups,
            List<String> targetPages,
            int maxParticleBudget,
            UUID activeVersionId,
            int latestVersionNumber,
            int layerCount,
            long version,
            Instant updatedAt
    ) {
    }

    public record ExperienceDetailDto(
            UUID id,
            String slug,
            String name,
            String description,
            String category,
            String presetKey,
            String status,
            String activationMode,
            boolean manualOverride,
            Instant startsAt,
            Instant endsAt,
            String timezone,
            String recurrenceRule,
            int priority,
            String blendMode,
            List<String> exclusiveGroups,
            List<String> targetPages,
            int maxParticleBudget,
            UUID activeVersionId,
            int latestVersionNumber,
            long version,
            ExperienceVersionDto latestVersion,
            ExperienceVersionDto activeVersion,
            List<ExperienceVersionDto> versions,
            Instant updatedAt
    ) {
    }

    public record CreateExperienceRequest(
            @NotBlank @Size(max = 140) String name,
            @Size(max = 100) String slug,
            String description,
            String category,
            String presetKey,
            String activationMode,
            Instant startsAt,
            Instant endsAt,
            String timezone,
            String recurrenceRule,
            Integer priority,
            String blendMode,
            List<String> exclusiveGroups,
            List<String> targetPages,
            Integer maxParticleBudget,
            Map<String, Object> config
    ) {
    }

    public record UpdateExperienceRequest(
            @Size(max = 140) String name,
            @Size(max = 100) String slug,
            String description,
            String category,
            String activationMode,
            Boolean manualOverride,
            Instant startsAt,
            Instant endsAt,
            Boolean clearScheduleDates,
            String timezone,
            String recurrenceRule,
            Integer priority,
            String blendMode,
            List<String> exclusiveGroups,
            List<String> targetPages,
            Integer maxParticleBudget,
            Long expectedVersion
    ) {
    }

    public record CreateVersionRequest(
            Map<String, Object> config,
            @Size(max = 255) String changeSummary,
            Long expectedVersion,
            Boolean publishIfActive
    ) {
    }

    public record ScheduleExperienceRequest(
            Instant startsAt,
            Instant endsAt,
            String timezone,
            String recurrenceRule
    ) {
    }

    public record ActivateExperienceRequest(
            UUID versionId,
            Boolean manualOverride
    ) {
    }

    public record ExperienceSettingsDto(
            UUID storeId,
            boolean enabled,
            String conflictStrategy,
            int maxConcurrentExperiences,
            int globalParticleCap,
            String mobilePerformanceMode,
            boolean respectReducedMotion,
            String fallbackBehavior,
            UUID defaultExperienceId,
            boolean allowCustomerDismiss,
            Instant updatedAt
    ) {
        static ExperienceSettingsDto from(SeasonalExperienceSettingsEntity e) {
            return new ExperienceSettingsDto(
                    e.getStoreId(),
                    e.isEnabled(),
                    e.getConflictStrategy(),
                    e.getMaxConcurrentExperiences(),
                    e.getGlobalParticleCap(),
                    e.getMobilePerformanceMode(),
                    e.isRespectReducedMotion(),
                    e.getFallbackBehavior(),
                    e.getDefaultExperienceId(),
                    e.isAllowCustomerDismiss(),
                    e.getUpdatedAt()
            );
        }
    }

    public record UpdateExperienceSettingsRequest(
            Boolean enabled,
            String conflictStrategy,
            Integer maxConcurrentExperiences,
            Integer globalParticleCap,
            String mobilePerformanceMode,
            Boolean respectReducedMotion,
            String fallbackBehavior,
            UUID defaultExperienceId,
            Boolean clearDefaultExperience,
            Boolean allowCustomerDismiss
    ) {
    }

    public record ActiveExperienceSummaryDto(
            UUID id,
            String slug,
            String name,
            String category,
            int priority,
            String blendMode,
            Instant startsAt,
            Instant endsAt,
            List<String> targetPages
    ) {
    }

    public record ResolvedExperienceLayerDto(
            UUID sourceExperienceId,
            String sourceExperienceName,
            String id,
            String type,
            String label,
            String zone,
            int zIndex,
            double opacity,
            String blendMode,
            Map<String, Object> visibility,
            String trigger,
            double effectiveDensityScale,
            Instant experienceEndsAt,
            List<String> targetPages,
            Map<String, Object> props
    ) {
    }

    public record ResolvedStorefrontExperienceDto(
            boolean enabled,
            Instant resolvedAt,
            Instant nextTransitionAt,
            String mobilePerformanceMode,
            boolean respectReducedMotion,
            boolean allowCustomerDismiss,
            int globalParticleCap,
            List<ActiveExperienceSummaryDto> activeExperiences,
            Map<String, Object> effectiveThemeOverride,
            List<ResolvedExperienceLayerDto> layers,
            List<String> resolutionTrace
    ) {
    }

    public record AiChatTurnItem(
            String role,
            String content
    ) {
    }

    public record ExperienceAiDesignRequest(
            UUID experienceId,
            @NotBlank @Size(max = 2000) String prompt,
            String model,
            Map<String, Object> currentConfig,
            List<AiChatTurnItem> history
    ) {
    }

    public record ExperienceAiOperationDto(
            String type,
            String targetId,
            String description
    ) {
    }

    public record ExperienceAiDesignResponse(
            String model,
            String summary,
            String explanation,
            List<ExperienceAiOperationDto> operations,
            Map<String, Object> proposedConfig,
            int promptTokens,
            int completionTokens,
            int latencyMs
    ) {
    }
}
