package com.datcommerce.api.experience;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SeasonalExperienceService {

    private static final String CACHE_KEY_PREFIX = "cms:experiences:active:";

    private final SeasonalExperienceRepository experienceRepository;
    private final SeasonalExperienceVersionRepository versionRepository;
    private final SeasonalExperienceSettingsRepository settingsRepository;
    private final SeasonalExperienceValidator validator;
    private final SeasonalExperienceResolverService resolverService;
    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public SeasonalExperienceService(
            SeasonalExperienceRepository experienceRepository,
            SeasonalExperienceVersionRepository versionRepository,
            SeasonalExperienceSettingsRepository settingsRepository,
            SeasonalExperienceValidator validator,
            SeasonalExperienceResolverService resolverService,
            StoreRepository storeRepository,
            AuditLogService auditLogService,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper
    ) {
        this.experienceRepository = experienceRepository;
        this.versionRepository = versionRepository;
        this.settingsRepository = settingsRepository;
        this.validator = validator;
        this.resolverService = resolverService;
        this.storeRepository = storeRepository;
        this.auditLogService = auditLogService;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SeasonalExperienceDtos.TemplateDto> listTemplates() {
        return SeasonalExperienceTemplates.all();
    }

    @Transactional(readOnly = true)
    public List<SeasonalExperienceDtos.ExperienceSummaryDto> listExperiences(UUID storeId) {
        return experienceRepository.findAllByStoreIdOrderByPriorityDescUpdatedAtDesc(storeId).stream()
                .map(exp -> {
                    SeasonalExperienceVersionEntity latest = versionRepository
                            .findTopByExperienceIdOrderByVersionNumberDesc(exp.getId())
                            .orElse(null);
                    int layerCount = extractLayerCount(latest != null ? latest.getConfigJson() : Map.of());
                    return toSummaryDto(exp, layerCount);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public SeasonalExperienceDtos.ExperienceDetailDto getExperience(UUID storeId, UUID experienceId) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));
        return assembleDetail(exp);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto createExperience(
            AuthenticatedUser actor,
            SeasonalExperienceDtos.CreateExperienceRequest req
    ) {
        SeasonalExperienceDtos.TemplateDto template = StringUtils.hasText(req.presetKey())
                ? SeasonalExperienceTemplates.findByKey(req.presetKey())
                : null;
        if (StringUtils.hasText(req.presetKey()) && template == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unknown template presetKey: " + req.presetKey());
        }

        String baseSlug = validator.normalizeSlug(req.slug(), req.name());
        String uniqueSlug = ensureUniqueSlug(actor.storeId(), baseSlug);

        String category = StringUtils.hasText(req.category())
                ? validator.normalizeCategory(req.category())
                : (template != null ? template.category() : "CUSTOM");
        String activationMode = validator.normalizeActivationMode(req.activationMode());
        String timezone = validator.normalizeTimezone(req.timezone());
        String recurrenceRule = validator.normalizeRecurrenceRule(req.recurrenceRule());
        validator.validateScheduleRange(req.startsAt(), req.endsAt());

        int priority = req.priority() != null
                ? validator.validatePriority(req.priority())
                : (template != null ? template.defaultPriority() : 50);
        String blendMode = StringUtils.hasText(req.blendMode())
                ? validator.normalizeBlendMode(req.blendMode())
                : (template != null ? template.defaultBlendMode() : "OVERRIDE");
        List<String> exclusiveGroups = req.exclusiveGroups() != null
                ? validator.normalizeExclusiveGroups(req.exclusiveGroups())
                : (template != null ? template.defaultExclusiveGroups() : List.of());
        List<String> targetPages = validator.normalizeTargetPages(req.targetPages());
        int maxParticleBudget = validator.validateParticleBudget(req.maxParticleBudget());

        Map<String, Object> rawConfig = req.config() != null
                ? req.config()
                : (template != null ? template.config() : SeasonalExperienceValidator.defaultEmptyConfig());
        Map<String, Object> cleanConfig = validator.validateAndNormalizeConfig(rawConfig);

        Instant now = Instant.now();
        UUID expId = UUID.randomUUID();

        SeasonalExperienceEntity exp = new SeasonalExperienceEntity();
        exp.setId(expId);
        exp.setStoreId(actor.storeId());
        exp.setSlug(uniqueSlug);
        exp.setName(req.name().trim());
        exp.setDescription(StringUtils.hasText(req.description())
                ? req.description().trim()
                : (template != null ? template.description() : null));
        exp.setCategory(category);
        exp.setPresetKey(template != null ? template.presetKey() : null);
        exp.setStatus("DRAFT");
        exp.setActivationMode(activationMode);
        exp.setManualOverride(false);
        exp.setStartsAt(req.startsAt());
        exp.setEndsAt(req.endsAt());
        exp.setTimezone(timezone);
        exp.setRecurrenceRule(recurrenceRule);
        exp.setPriority(priority);
        exp.setBlendMode(blendMode);
        exp.setExclusiveGroupsJson(exclusiveGroups);
        exp.setTargetPagesJson(targetPages);
        exp.setMaxParticleBudget(maxParticleBudget);
        exp.setLatestVersionNumber(1);
        exp.setCreatedBy(actor.userId());
        exp.setCreatedAt(now);
        exp.setUpdatedAt(now);
        experienceRepository.saveAndFlush(exp);

        SeasonalExperienceVersionEntity v1 = new SeasonalExperienceVersionEntity();
        v1.setId(UUID.randomUUID());
        v1.setExperienceId(expId);
        v1.setVersionNumber(1);
        v1.setConfigJson(cleanConfig);
        v1.setChangeSummary(template != null ? "Created from template: " + template.name() : "Initial custom draft");
        v1.setCreatedBy(actor.userId());
        v1.setCreatedAt(now);
        versionRepository.save(v1);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_CREATED", "SEASONAL_EXPERIENCE", expId.toString(),
                null, Map.of("slug", uniqueSlug, "name", exp.getName(), "category", category),
                Map.of("presetKey", template != null ? template.presetKey() : ""), null
        );
        return assembleDetail(exp);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto updateExperience(
            AuthenticatedUser actor,
            UUID experienceId,
            SeasonalExperienceDtos.UpdateExperienceRequest req
    ) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));

        if (req.expectedVersion() != null && req.expectedVersion() != exp.getVersion()) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "Experience was modified by another editor. Reload before saving."
            );
        }

        if (StringUtils.hasText(req.name())) {
            exp.setName(req.name().trim());
        }
        if (StringUtils.hasText(req.slug())) {
            String nextSlug = validator.normalizeSlug(req.slug(), exp.getName());
            if (!nextSlug.equalsIgnoreCase(exp.getSlug())) {
                experienceRepository.findByStoreIdAndSlugIgnoreCase(actor.storeId(), nextSlug)
                        .filter(existing -> !existing.getId().equals(exp.getId()))
                        .ifPresent(conflict -> {
                            throw new ApiException(ErrorCode.CONFLICT, "Experience slug already exists: " + nextSlug);
                        });
                exp.setSlug(nextSlug);
            }
        }
        if (req.description() != null) {
            exp.setDescription(req.description().trim());
        }
        if (StringUtils.hasText(req.category())) {
            exp.setCategory(validator.normalizeCategory(req.category()));
        }
        if (StringUtils.hasText(req.activationMode())) {
            exp.setActivationMode(validator.normalizeActivationMode(req.activationMode()));
        }
        if (req.manualOverride() != null) {
            exp.setManualOverride(req.manualOverride());
        }
        if (Boolean.TRUE.equals(req.clearScheduleDates())) {
            exp.setStartsAt(null);
            exp.setEndsAt(null);
        } else {
            Instant nextStart = req.startsAt() != null ? req.startsAt() : exp.getStartsAt();
            Instant nextEnd = req.endsAt() != null ? req.endsAt() : exp.getEndsAt();
            validator.validateScheduleRange(nextStart, nextEnd);
            exp.setStartsAt(nextStart);
            exp.setEndsAt(nextEnd);
        }
        if (StringUtils.hasText(req.timezone())) {
            exp.setTimezone(validator.normalizeTimezone(req.timezone()));
        }
        if (StringUtils.hasText(req.recurrenceRule())) {
            exp.setRecurrenceRule(validator.normalizeRecurrenceRule(req.recurrenceRule()));
        }
        if (req.priority() != null) {
            exp.setPriority(validator.validatePriority(req.priority()));
        }
        if (StringUtils.hasText(req.blendMode())) {
            exp.setBlendMode(validator.normalizeBlendMode(req.blendMode()));
        }
        if (req.exclusiveGroups() != null) {
            exp.setExclusiveGroupsJson(validator.normalizeExclusiveGroups(req.exclusiveGroups()));
        }
        if (req.targetPages() != null) {
            exp.setTargetPagesJson(validator.normalizeTargetPages(req.targetPages()));
        }
        if (req.maxParticleBudget() != null) {
            exp.setMaxParticleBudget(validator.validateParticleBudget(req.maxParticleBudget()));
        }

        exp.setUpdatedAt(Instant.now());
        SeasonalExperienceEntity saved = experienceRepository.saveAndFlush(exp);
        evictActiveCache(actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_UPDATED", "SEASONAL_EXPERIENCE", saved.getId().toString(),
                null, Map.of("name", saved.getName(), "priority", saved.getPriority(), "blendMode", saved.getBlendMode()),
                Map.of(), null
        );
        return assembleDetail(saved);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto createVersion(
            AuthenticatedUser actor,
            UUID experienceId,
            SeasonalExperienceDtos.CreateVersionRequest req
    ) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));

        if (req.expectedVersion() != null && req.expectedVersion() != exp.getVersion()) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "Experience was updated by another editor. Refresh before saving version."
            );
        }

        Map<String, Object> cleanConfig = validator.validateAndNormalizeConfig(req.config());
        int nextNum = exp.getLatestVersionNumber() + 1;
        Instant now = Instant.now();

        SeasonalExperienceVersionEntity ver = new SeasonalExperienceVersionEntity();
        ver.setId(UUID.randomUUID());
        ver.setExperienceId(exp.getId());
        ver.setVersionNumber(nextNum);
        ver.setConfigJson(cleanConfig);
        ver.setChangeSummary(StringUtils.hasText(req.changeSummary()) ? req.changeSummary().trim() : "Saved version v" + nextNum);
        ver.setCreatedBy(actor.userId());
        ver.setCreatedAt(now);
        versionRepository.save(ver);

        exp.setLatestVersionNumber(nextNum);
        boolean publishIfActive = req.publishIfActive() == null || Boolean.TRUE.equals(req.publishIfActive());
        if (publishIfActive && "ACTIVE".equalsIgnoreCase(exp.getStatus())) {
            exp.setActiveVersionId(ver.getId());
        }
        exp.setUpdatedAt(now);
        SeasonalExperienceEntity saved = experienceRepository.saveAndFlush(exp);

        if ("ACTIVE".equalsIgnoreCase(saved.getStatus()) && publishIfActive) {
            evictActiveCache(actor.storeId());
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_VERSION_SAVED", "SEASONAL_EXPERIENCE", saved.getId().toString(),
                null, Map.of("versionNumber", nextNum, "summary", ver.getChangeSummary()),
                Map.of(), null
        );
        return assembleDetail(saved);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto activateExperience(
            AuthenticatedUser actor,
            UUID experienceId,
            SeasonalExperienceDtos.ActivateExperienceRequest req
    ) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));

        SeasonalExperienceVersionEntity target = (req != null && req.versionId() != null)
                ? versionRepository.findByIdAndExperienceId(req.versionId(), exp.getId())
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Experience version not found"))
                : versionRepository.findTopByExperienceIdOrderByVersionNumberDesc(exp.getId())
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No saved experience version found"));

        String prevStatus = exp.getStatus();
        exp.setActiveVersionId(target.getId());
        exp.setStatus("ACTIVE");
        if (req != null && Boolean.TRUE.equals(req.manualOverride())) {
            exp.setManualOverride(true);
        } else if ("SCHEDULED".equalsIgnoreCase(exp.getActivationMode())) {
            // Manual activation of a scheduled experience marks manualOverride until deactivated or re-scheduled
            exp.setManualOverride(true);
        } else {
            exp.setActivationMode("MANUAL");
        }
        exp.setUpdatedAt(Instant.now());
        SeasonalExperienceEntity saved = experienceRepository.saveAndFlush(exp);
        evictActiveCache(actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_ACTIVATED", "SEASONAL_EXPERIENCE", saved.getId().toString(),
                Map.of("status", prevStatus),
                Map.of("status", "ACTIVE", "versionNumber", target.getVersionNumber()),
                Map.of("slug", saved.getSlug()), null
        );
        return assembleDetail(saved);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto deactivateExperience(
            AuthenticatedUser actor,
            UUID experienceId
    ) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));

        String prevStatus = exp.getStatus();
        exp.setStatus("PAUSED");
        exp.setManualOverride(false);
        exp.setUpdatedAt(Instant.now());
        SeasonalExperienceEntity saved = experienceRepository.saveAndFlush(exp);
        evictActiveCache(actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_DEACTIVATED", "SEASONAL_EXPERIENCE", saved.getId().toString(),
                Map.of("status", prevStatus),
                Map.of("status", "PAUSED"),
                Map.of("slug", saved.getSlug()), null
        );
        return assembleDetail(saved);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto scheduleExperience(
            AuthenticatedUser actor,
            UUID experienceId,
            SeasonalExperienceDtos.ScheduleExperienceRequest req
    ) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));

        if (req.startsAt() == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "startsAt is required to schedule an experience");
        }
        validator.validateScheduleRange(req.startsAt(), req.endsAt());
        String tz = StringUtils.hasText(req.timezone()) ? validator.normalizeTimezone(req.timezone()) : exp.getTimezone();
        String rec = StringUtils.hasText(req.recurrenceRule()) ? validator.normalizeRecurrenceRule(req.recurrenceRule()) : exp.getRecurrenceRule();

        SeasonalExperienceVersionEntity latest = versionRepository.findTopByExperienceIdOrderByVersionNumberDesc(exp.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No saved experience version found"));
        if (exp.getActiveVersionId() == null) {
            exp.setActiveVersionId(latest.getId());
        }

        Instant now = Instant.now();
        exp.setActivationMode("SCHEDULED");
        exp.setManualOverride(false);
        exp.setStartsAt(req.startsAt());
        exp.setEndsAt(req.endsAt());
        exp.setTimezone(tz);
        exp.setRecurrenceRule(rec);

        if (!req.startsAt().isAfter(now) && (req.endsAt() == null || req.endsAt().isAfter(now))) {
            exp.setStatus("ACTIVE");
        } else if (req.endsAt() != null && !req.endsAt().isAfter(now)) {
            exp.setStatus("ENDED");
        } else {
            exp.setStatus("SCHEDULED");
        }
        exp.setUpdatedAt(now);
        SeasonalExperienceEntity saved = experienceRepository.saveAndFlush(exp);
        evictActiveCache(actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_SCHEDULED", "SEASONAL_EXPERIENCE", saved.getId().toString(),
                null,
                Map.of("status", saved.getStatus(), "startsAt", req.startsAt().toString(),
                        "endsAt", req.endsAt() != null ? req.endsAt().toString() : ""),
                Map.of("slug", saved.getSlug()), null
        );
        return assembleDetail(saved);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto rollbackVersion(
            AuthenticatedUser actor,
            UUID experienceId,
            UUID versionId
    ) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));

        SeasonalExperienceVersionEntity source = versionRepository.findByIdAndExperienceId(versionId, exp.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Source experience version not found"));

        int nextNum = exp.getLatestVersionNumber() + 1;
        Instant now = Instant.now();

        SeasonalExperienceVersionEntity rolled = new SeasonalExperienceVersionEntity();
        rolled.setId(UUID.randomUUID());
        rolled.setExperienceId(exp.getId());
        rolled.setVersionNumber(nextNum);
        rolled.setConfigJson(source.getConfigJson());
        rolled.setChangeSummary("Restored from v" + source.getVersionNumber());
        rolled.setCreatedBy(actor.userId());
        rolled.setCreatedAt(now);
        versionRepository.save(rolled);

        exp.setLatestVersionNumber(nextNum);
        if ("ACTIVE".equalsIgnoreCase(exp.getStatus()) || exp.getActiveVersionId() != null) {
            exp.setActiveVersionId(rolled.getId());
        }
        exp.setUpdatedAt(now);
        SeasonalExperienceEntity saved = experienceRepository.saveAndFlush(exp);
        evictActiveCache(actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_ROLLED_BACK", "SEASONAL_EXPERIENCE", saved.getId().toString(),
                null,
                Map.of("restoredFromVersion", source.getVersionNumber(), "newVersion", nextNum),
                Map.of("slug", saved.getSlug()), null
        );
        return assembleDetail(saved);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceDetailDto duplicateExperience(
            AuthenticatedUser actor,
            UUID experienceId
    ) {
        SeasonalExperienceEntity source = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));
        SeasonalExperienceVersionEntity latest = versionRepository.findTopByExperienceIdOrderByVersionNumberDesc(source.getId())
                .orElse(null);

        Map<String, Object> config = latest != null
                ? latest.getConfigJson()
                : SeasonalExperienceValidator.defaultEmptyConfig();

        return createExperience(actor, new SeasonalExperienceDtos.CreateExperienceRequest(
                source.getName() + " (Copy)",
                source.getSlug() + "-copy",
                source.getDescription(),
                source.getCategory(),
                null,
                "MANUAL",
                null,
                null,
                source.getTimezone(),
                "NONE",
                source.getPriority(),
                source.getBlendMode(),
                source.getExclusiveGroupsJson(),
                source.getTargetPagesJson(),
                source.getMaxParticleBudget(),
                config
        ));
    }

    @Transactional
    public void deleteExperience(AuthenticatedUser actor, UUID experienceId) {
        SeasonalExperienceEntity exp = experienceRepository.findByIdAndStoreId(experienceId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Seasonal experience not found"));
        experienceRepository.delete(exp);
        evictActiveCache(actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_DELETED", "SEASONAL_EXPERIENCE", experienceId.toString(),
                Map.of("name", exp.getName(), "slug", exp.getSlug()), null, Map.of(), null
        );
    }

    @Transactional(readOnly = true)
    public SeasonalExperienceDtos.ExperienceSettingsDto getSettings(UUID storeId) {
        SeasonalExperienceSettingsEntity settings = settingsRepository.findById(storeId)
                .orElseGet(() -> SeasonalExperienceResolverService.defaultSettings(storeId));
        return SeasonalExperienceDtos.ExperienceSettingsDto.from(settings);
    }

    @Transactional
    public SeasonalExperienceDtos.ExperienceSettingsDto updateSettings(
            AuthenticatedUser actor,
            SeasonalExperienceDtos.UpdateExperienceSettingsRequest req
    ) {
        SeasonalExperienceSettingsEntity settings = settingsRepository.findById(actor.storeId())
                .orElseGet(() -> SeasonalExperienceResolverService.defaultSettings(actor.storeId()));

        if (req.enabled() != null) {
            settings.setEnabled(req.enabled());
        }
        if (StringUtils.hasText(req.conflictStrategy())) {
            settings.setConflictStrategy(validator.normalizeConflictStrategy(req.conflictStrategy()));
        }
        if (req.maxConcurrentExperiences() != null) {
            int max = Math.max(1, Math.min(5, req.maxConcurrentExperiences()));
            settings.setMaxConcurrentExperiences(max);
        }
        if (req.globalParticleCap() != null) {
            int cap = Math.max(20, Math.min(400, req.globalParticleCap()));
            settings.setGlobalParticleCap(cap);
        }
        if (StringUtils.hasText(req.mobilePerformanceMode())) {
            settings.setMobilePerformanceMode(validator.normalizeMobilePerformanceMode(req.mobilePerformanceMode()));
        }
        if (req.respectReducedMotion() != null) {
            settings.setRespectReducedMotion(req.respectReducedMotion());
        }
        if (StringUtils.hasText(req.fallbackBehavior())) {
            settings.setFallbackBehavior(validator.normalizeFallbackBehavior(req.fallbackBehavior()));
        }
        if (Boolean.TRUE.equals(req.clearDefaultExperience())) {
            settings.setDefaultExperienceId(null);
        } else if (req.defaultExperienceId() != null) {
            experienceRepository.findByIdAndStoreId(req.defaultExperienceId(), actor.storeId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Default fallback experience not found"));
            settings.setDefaultExperienceId(req.defaultExperienceId());
        }
        if (req.allowCustomerDismiss() != null) {
            settings.setAllowCustomerDismiss(req.allowCustomerDismiss());
        }
        settings.setUpdatedAt(Instant.now());
        SeasonalExperienceSettingsEntity saved = settingsRepository.save(settings);
        evictActiveCache(actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "EXPERIENCE_SETTINGS_UPDATED", "SEASONAL_EXPERIENCE_SETTINGS", actor.storeId().toString(),
                null,
                Map.of("enabled", saved.isEnabled(), "conflictStrategy", saved.getConflictStrategy(),
                        "globalParticleCap", saved.getGlobalParticleCap()),
                Map.of(), null
        );
        return SeasonalExperienceDtos.ExperienceSettingsDto.from(saved);
    }

    @Transactional(readOnly = true)
    public SeasonalExperienceDtos.ResolvedStorefrontExperienceDto simulate(
            UUID storeId,
            Instant at,
            String route
    ) {
        return resolverService.resolveForStore(storeId, at != null ? at : Instant.now(), route);
    }

    @Transactional(readOnly = true)
    public SeasonalExperienceDtos.ResolvedStorefrontExperienceDto getActiveForPublicStore(String route) {
        UUID storeId = defaultStoreId();
        boolean cacheable = !StringUtils.hasText(route);
        String cacheKey = CACHE_KEY_PREFIX + storeId;

        if (cacheable) {
            try {
                String cached = redisTemplate.opsForValue().get(cacheKey);
                if (StringUtils.hasText(cached)) {
                    SeasonalExperienceDtos.ResolvedStorefrontExperienceDto dto =
                            objectMapper.readValue(cached, new TypeReference<>() {
                            });
                    if (dto.nextTransitionAt() == null || dto.nextTransitionAt().isAfter(Instant.now())) {
                        return dto;
                    }
                }
            } catch (Exception ignored) {
                // Fall back to DB resolution
            }
        }

        Instant now = Instant.now();
        SeasonalExperienceDtos.ResolvedStorefrontExperienceDto resolved =
                resolverService.resolveForStore(storeId, now, route);

        if (cacheable) {
            try {
                long ttlSec = 30L;
                if (resolved.nextTransitionAt() != null) {
                    long until = Duration.between(now, resolved.nextTransitionAt()).getSeconds();
                    ttlSec = Math.max(2L, Math.min(30L, until));
                }
                redisTemplate.opsForValue().set(cacheKey, objectMapper.writeValueAsString(resolved), Duration.ofSeconds(ttlSec));
            } catch (Exception ignored) {
                // Redis cache write is best-effort
            }
        }
        return resolved;
    }

    public void evictActiveCache(UUID storeId) {
        try {
            redisTemplate.delete(CACHE_KEY_PREFIX + storeId);
        } catch (Exception ignored) {
            // Redis cache eviction is best-effort
        }
    }

    private SeasonalExperienceDtos.ExperienceDetailDto assembleDetail(SeasonalExperienceEntity exp) {
        List<SeasonalExperienceDtos.ExperienceVersionDto> versions = versionRepository
                .findAllByExperienceIdOrderByVersionNumberDesc(exp.getId())
                .stream()
                .map(SeasonalExperienceDtos.ExperienceVersionDto::from)
                .toList();
        SeasonalExperienceDtos.ExperienceVersionDto latest = versions.isEmpty() ? null : versions.getFirst();
        SeasonalExperienceDtos.ExperienceVersionDto active = exp.getActiveVersionId() == null
                ? null
                : versions.stream().filter(v -> v.id().equals(exp.getActiveVersionId())).findFirst().orElse(null);

        return new SeasonalExperienceDtos.ExperienceDetailDto(
                exp.getId(),
                exp.getSlug(),
                exp.getName(),
                exp.getDescription(),
                exp.getCategory(),
                exp.getPresetKey(),
                exp.getStatus(),
                exp.getActivationMode(),
                exp.isManualOverride(),
                exp.getStartsAt(),
                exp.getEndsAt(),
                exp.getTimezone(),
                exp.getRecurrenceRule(),
                exp.getPriority(),
                exp.getBlendMode(),
                exp.getExclusiveGroupsJson() != null ? exp.getExclusiveGroupsJson() : List.of(),
                exp.getTargetPagesJson() != null ? exp.getTargetPagesJson() : List.of("*"),
                exp.getMaxParticleBudget(),
                exp.getActiveVersionId(),
                exp.getLatestVersionNumber(),
                exp.getVersion(),
                latest,
                active,
                versions,
                exp.getUpdatedAt()
        );
    }

    private SeasonalExperienceDtos.ExperienceSummaryDto toSummaryDto(SeasonalExperienceEntity exp, int layerCount) {
        return new SeasonalExperienceDtos.ExperienceSummaryDto(
                exp.getId(),
                exp.getSlug(),
                exp.getName(),
                exp.getDescription(),
                exp.getCategory(),
                exp.getPresetKey(),
                exp.getStatus(),
                exp.getActivationMode(),
                exp.isManualOverride(),
                exp.getStartsAt(),
                exp.getEndsAt(),
                exp.getTimezone(),
                exp.getRecurrenceRule(),
                exp.getPriority(),
                exp.getBlendMode(),
                exp.getExclusiveGroupsJson() != null ? exp.getExclusiveGroupsJson() : List.of(),
                exp.getTargetPagesJson() != null ? exp.getTargetPagesJson() : List.of("*"),
                exp.getMaxParticleBudget(),
                exp.getActiveVersionId(),
                exp.getLatestVersionNumber(),
                layerCount,
                exp.getVersion(),
                exp.getUpdatedAt()
        );
    }

    private String ensureUniqueSlug(UUID storeId, String baseSlug) {
        if (experienceRepository.findByStoreIdAndSlugIgnoreCase(storeId, baseSlug).isEmpty()) {
            return baseSlug;
        }
        int suffix = 2;
        while (true) {
            String candidate = baseSlug + "-" + suffix;
            if (candidate.length() > 100) {
                candidate = baseSlug.substring(0, Math.max(1, 100 - ("-" + suffix).length())) + "-" + suffix;
            }
            if (experienceRepository.findByStoreIdAndSlugIgnoreCase(storeId, candidate).isEmpty()) {
                return candidate;
            }
            suffix++;
        }
    }

    private UUID defaultStoreId() {
        return storeRepository.findByCode("terrain-supply")
                .map(StoreEntity::getId)
                .orElseGet(() -> storeRepository.findAll().stream()
                        .findFirst()
                        .map(StoreEntity::getId)
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not initialized")));
    }

    private static int extractLayerCount(Map<String, Object> config) {
        if (config == null) return 0;
        Object layers = config.get("layers");
        return layers instanceof List<?> list ? list.size() : 0;
    }
}
