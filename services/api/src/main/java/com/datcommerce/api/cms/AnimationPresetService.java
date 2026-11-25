package com.datcommerce.api.cms;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AnimationPresetService {

    private final AnimationPresetRepository presetRepository;
    private final AnimationValidationService validationService;
    private final CmsService cmsService;
    private final PageRepository pageRepository;
    private final PageVersionRepository pageVersionRepository;
    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;

    public AnimationPresetService(
            AnimationPresetRepository presetRepository,
            AnimationValidationService validationService,
            CmsService cmsService,
            PageRepository pageRepository,
            PageVersionRepository pageVersionRepository,
            StoreRepository storeRepository,
            AuditLogService auditLogService
    ) {
        this.presetRepository = presetRepository;
        this.validationService = validationService;
        this.cmsService = cmsService;
        this.pageRepository = pageRepository;
        this.pageVersionRepository = pageVersionRepository;
        this.storeRepository = storeRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<AnimationPresetDto> listAdminPresets(UUID storeId, String category) {
        List<AnimationPresetEntity> entities = StringUtils.hasText(category)
                ? presetRepository.findAllByStoreIdAndCategoryIgnoreCaseOrderByUpdatedAtDesc(storeId, category.trim())
                : presetRepository.findAllByStoreIdOrderByUpdatedAtDesc(storeId);
        return entities.stream().map(AnimationPresetDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AnimationPresetDto> listStorePresets() {
        UUID storeId = defaultStoreId();
        return presetRepository.findAllByStoreIdOrderByUpdatedAtDesc(storeId)
                .stream().map(AnimationPresetDto::from).toList();
    }

    @Transactional(readOnly = true)
    public AnimationPresetDto getPreset(UUID storeId, UUID presetId) {
        AnimationPresetEntity entity = presetRepository.findByIdAndStoreId(presetId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Animation preset not found"));
        return AnimationPresetDto.from(entity);
    }

    @Transactional
    public AnimationPresetDto createPreset(AuthenticatedUser actor, CreateAnimationPresetRequest req) {
        String cat = req.category().trim().toLowerCase(Locale.ROOT);
        Map<String, Object> cleanConfig = validationService.validatePresetConfig(cat, req.config());
        String key = buildUniquePresetKey(actor.storeId(), req.presetKey(), req.name());

        Instant now = Instant.now();
        AnimationPresetEntity entity = new AnimationPresetEntity();
        entity.setId(UUID.randomUUID());
        entity.setStoreId(actor.storeId());
        entity.setPresetKey(key);
        entity.setName(req.name().trim());
        entity.setCategory(cat);
        entity.setDescription(req.description() != null ? req.description().trim() : "");
        entity.setConfigJson(cleanConfig);
        entity.setSystem(false);
        entity.setFavorite(Boolean.TRUE.equals(req.favorite()));
        entity.setCreatedBy(actor.userId());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        AnimationPresetEntity saved = presetRepository.saveAndFlush(entity);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ANIMATION_PRESET_CREATED", "ANIMATION_PRESET", saved.getId().toString(),
                null, Map.of("presetKey", saved.getPresetKey(), "category", saved.getCategory()),
                Map.of(), null
        );
        return AnimationPresetDto.from(saved);
    }

    @Transactional
    public AnimationPresetDto updatePreset(AuthenticatedUser actor, UUID presetId, UpdateAnimationPresetRequest req) {
        AnimationPresetEntity entity = presetRepository.findByIdAndStoreId(presetId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Animation preset not found"));

        if (req.expectedVersion() != null && req.expectedVersion() != entity.getVersion()) {
            throw new ApiException(ErrorCode.CONFLICT, "Animation preset was modified by another user. Reload and retry.");
        }
        if (entity.isSystem() && (req.name() != null || req.category() != null || req.config() != null)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "System presets cannot be modified directly; duplicate them instead.");
        }

        if (StringUtils.hasText(req.name())) entity.setName(req.name().trim());
        if (StringUtils.hasText(req.category())) {
            String cat = req.category().trim().toLowerCase(Locale.ROOT);
            if (!AnimationValidationService.ALLOWED_CATEGORIES.contains(cat)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported preset category: " + cat);
            }
            entity.setCategory(cat);
        }
        if (req.description() != null) entity.setDescription(req.description().trim());
        if (req.config() != null) {
            entity.setConfigJson(validationService.validatePresetConfig(entity.getCategory(), req.config()));
        }
        if (req.favorite() != null) entity.setFavorite(req.favorite());
        entity.setUpdatedAt(Instant.now());

        AnimationPresetEntity saved = presetRepository.saveAndFlush(entity);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ANIMATION_PRESET_UPDATED", "ANIMATION_PRESET", saved.getId().toString(),
                null, Map.of("presetKey", saved.getPresetKey(), "version", saved.getVersion()),
                Map.of(), null
        );
        return AnimationPresetDto.from(saved);
    }

    @Transactional
    public void deletePreset(AuthenticatedUser actor, UUID presetId) {
        AnimationPresetEntity entity = presetRepository.findByIdAndStoreId(presetId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Animation preset not found"));
        if (entity.isSystem()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "System animation presets cannot be deleted");
        }
        presetRepository.delete(entity);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ANIMATION_PRESET_DELETED", "ANIMATION_PRESET", presetId.toString(),
                Map.of("presetKey", entity.getPresetKey()), null, Map.of(), null
        );
    }

    // ---- Element Animations on Page Draft ----

    @Transactional(readOnly = true)
    public PageAnimationsResponse getPageAnimations(UUID storeId, UUID pageId) {
        PageEntity page = pageRepository.findByIdAndStoreId(pageId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found"));
        PageVersionEntity latest = pageVersionRepository.findTopByPageIdOrderByVersionNumberDesc(page.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No page versions found"));
        Map<String, Object> animations = new LinkedHashMap<>();
        Object nodesObj = latest.getContentJson() != null ? latest.getContentJson().get("nodes") : null;
        if (nodesObj instanceof List<?> nodeList) {
            collectNodeAnimations(nodeList, animations);
        }
        return new PageAnimationsResponse(page.getId(), page.getVersion(), latest.getVersionNumber(), animations);
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public CmsService.PageDetailDto upsertElementAnimation(
            AuthenticatedUser actor,
            UUID pageId,
            String elementId,
            UpdateElementAnimationRequest req
    ) {
        PageEntity page = pageRepository.findByIdAndStoreId(pageId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found"));
        PageVersionEntity latest = pageVersionRepository.findTopByPageIdOrderByVersionNumberDesc(page.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No page versions found"));

        Map<String, Object> contentCopy = deepCopyMap(latest.getContentJson());
        Object nodesObj = contentCopy.get("nodes");
        if (!(nodesObj instanceof List<?> nodeList)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Page does not contain v2 element nodes");
        }
        Map<String, Object> cleanMotion = req.motion() != null
                ? validationService.validateAndNormalizeElementMotion(req.motion(), elementId + ".motion")
                : null;
        boolean updated = replaceNodeMotion((List<Map<String, Object>>) nodeList, elementId, cleanMotion);
        if (!updated) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Element not found in page: " + elementId);
        }

        String summary = StringUtils.hasText(req.changeSummary())
                ? req.changeSummary().trim()
                : (cleanMotion == null ? "Removed animation on " + elementId : "Updated animation on " + elementId);
        return cmsService.createPageVersion(
                actor,
                pageId,
                new CmsService.CreatePageVersionRequest(
                        contentCopy,
                        summary,
                        page.getTitle(),
                        page.getSeoTitle(),
                        page.getSeoDescription(),
                        req.expectedVersion()
                )
        );
    }

    @Transactional
    public CmsService.PageDetailDto deleteElementAnimation(
            AuthenticatedUser actor,
            UUID pageId,
            String elementId,
            Long expectedVersion
    ) {
        return upsertElementAnimation(
                actor,
                pageId,
                elementId,
                new UpdateElementAnimationRequest(null, expectedVersion, "Removed animation on " + elementId)
        );
    }

    // ---- Global Motion Settings on Theme ----

    @Transactional(readOnly = true)
    public GlobalMotionResponse getGlobalMotionSettings(UUID storeId) {
        CmsService.AdminThemeResponse theme = cmsService.getAdminTheme(storeId);
        CmsService.ThemeVersionDto active = theme.latest() != null ? theme.latest() : theme.published();
        Object rawMotion = active != null && active.tokens() != null ? active.tokens().get("motion") : null;
        Map<String, Object> normalized = validationService.validateAndNormalizeGlobalMotion(rawMotion);
        return new GlobalMotionResponse(
                active != null ? active.id() : null,
                active != null ? active.versionNumber() : 0,
                normalized
        );
    }

    @Transactional
    public CmsService.ThemeVersionDto updateGlobalMotionSettings(
            AuthenticatedUser actor,
            UpdateGlobalMotionRequest req
    ) {
        CmsService.AdminThemeResponse theme = cmsService.getAdminTheme(actor.storeId());
        CmsService.ThemeVersionDto active = theme.latest() != null ? theme.latest() : theme.published();
        Map<String, Object> tokens = active != null && active.tokens() != null
                ? deepCopyMap(active.tokens())
                : ThemeTokenValidator.defaultTokens();
        Map<String, Object> cleanMotion = validationService.validateAndNormalizeGlobalMotion(req.motion());
        tokens.put("motion", cleanMotion);
        String note = StringUtils.hasText(req.note()) ? req.note().trim() : "Updated Global Motion settings";
        return cmsService.createThemeVersion(actor, new CmsService.CreateThemeVersionRequest(tokens, note));
    }

    private void collectNodeAnimations(List<?> nodes, Map<String, Object> out) {
        for (Object item : nodes) {
            if (!(item instanceof Map<?, ?> map)) continue;
            Object id = map.get("id");
            Object motion = map.get("motion");
            if (id != null && motion instanceof Map<?, ?> m && !m.isEmpty()) {
                out.put(String.valueOf(id), motion);
            }
            if (map.get("children") instanceof List<?> children) {
                collectNodeAnimations(children, out);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private boolean replaceNodeMotion(List<Map<String, Object>> nodes, String targetId, Map<String, Object> motion) {
        for (Map<String, Object> node : nodes) {
            if (targetId.equals(String.valueOf(node.get("id")))) {
                if (motion == null || motion.isEmpty()) {
                    node.remove("motion");
                } else {
                    node.put("motion", motion);
                }
                return true;
            }
            if (node.get("children") instanceof List<?> children) {
                if (replaceNodeMotion((List<Map<String, Object>>) children, targetId, motion)) {
                    return true;
                }
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> deepCopyMap(Map<String, Object> source) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (source == null) return out;
        for (Map.Entry<String, Object> e : source.entrySet()) {
            out.put(e.getKey(), deepCopyValue(e.getValue()));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Object deepCopyValue(Object v) {
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) {
                copy.put(String.valueOf(e.getKey()), deepCopyValue(e.getValue()));
            }
            return copy;
        }
        if (v instanceof List<?> l) {
            List<Object> copy = new ArrayList<>(l.size());
            for (Object item : l) copy.add(deepCopyValue(item));
            return copy;
        }
        return v;
    }

    private String buildUniquePresetKey(UUID storeId, String rawKey, String name) {
        String source = StringUtils.hasText(rawKey) ? rawKey.trim() : name.trim();
        String base = source.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9_-]+", "-")
                .replaceAll("^-+|-+$", "");
        if (base.isEmpty()) base = "preset";
        if (base.length() > 64) base = base.substring(0, 64);
        String candidate = base;
        int idx = 2;
        while (presetRepository.existsByStoreIdAndPresetKeyIgnoreCase(storeId, candidate)) {
            candidate = base + "-" + idx++;
        }
        return candidate;
    }

    private UUID defaultStoreId() {
        return storeRepository.findByCode("terrain-supply")
                .map(StoreEntity::getId)
                .orElseGet(() -> storeRepository.findAll().stream()
                        .findFirst()
                        .map(StoreEntity::getId)
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Default store not configured")));
    }

    public record AnimationPresetDto(
            UUID id,
            String presetKey,
            String name,
            String category,
            String description,
            Map<String, Object> config,
            boolean isSystem,
            boolean isFavorite,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static AnimationPresetDto from(AnimationPresetEntity e) {
            return new AnimationPresetDto(
                    e.getId(), e.getPresetKey(), e.getName(), e.getCategory(),
                    e.getDescription(), e.getConfigJson(), e.isSystem(), e.isFavorite(),
                    e.getVersion(), e.getCreatedAt(), e.getUpdatedAt()
            );
        }
    }

    public record CreateAnimationPresetRequest(
            @Size(max = 80) String presetKey,
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 32) String category,
            @Size(max = 400) String description,
            @NotNull Map<String, Object> config,
            Boolean favorite
    ) {}

    public record UpdateAnimationPresetRequest(
            @Size(max = 120) String name,
            @Size(max = 32) String category,
            @Size(max = 400) String description,
            Map<String, Object> config,
            Boolean favorite,
            Long expectedVersion
    ) {}

    public record PageAnimationsResponse(
            UUID pageId,
            long pageVersion,
            int latestVersionNumber,
            Map<String, Object> animations
    ) {}

    public record UpdateElementAnimationRequest(
            Map<String, Object> motion,
            Long expectedVersion,
            @Size(max = 255) String changeSummary
    ) {}

    public record GlobalMotionResponse(
            UUID themeVersionId,
            int versionNumber,
            Map<String, Object> motion
    ) {}

    public record UpdateGlobalMotionRequest(
            @NotNull Map<String, Object> motion,
            @Size(max = 255) String note
    ) {}
}
