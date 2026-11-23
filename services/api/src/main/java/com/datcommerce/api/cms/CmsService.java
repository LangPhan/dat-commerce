package com.datcommerce.api.cms;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CmsService {

    private final PageRepository pageRepository;
    private final PageVersionRepository pageVersionRepository;
    private final ThemeConfigRepository themeConfigRepository;
    private final NavigationMenuRepository navigationMenuRepository;
    private final StoreRepository storeRepository;
    private final BlockSchemaValidator blockSchemaValidator;
    private final ThemeTokenValidator themeTokenValidator;
    private final AuditLogService auditLogService;
    private final StringRedisTemplate redisTemplate;

    public CmsService(
            PageRepository pageRepository,
            PageVersionRepository pageVersionRepository,
            ThemeConfigRepository themeConfigRepository,
            NavigationMenuRepository navigationMenuRepository,
            StoreRepository storeRepository,
            BlockSchemaValidator blockSchemaValidator,
            ThemeTokenValidator themeTokenValidator,
            AuditLogService auditLogService,
            StringRedisTemplate redisTemplate
    ) {
        this.pageRepository = pageRepository;
        this.pageVersionRepository = pageVersionRepository;
        this.themeConfigRepository = themeConfigRepository;
        this.navigationMenuRepository = navigationMenuRepository;
        this.storeRepository = storeRepository;
        this.blockSchemaValidator = blockSchemaValidator;
        this.themeTokenValidator = themeTokenValidator;
        this.auditLogService = auditLogService;
        this.redisTemplate = redisTemplate;
    }

    // ---- Storefront Public APIs ----

    @Transactional(readOnly = true)
    public StorePageResponse getPublishedPage(String slug) {
        UUID storeId = defaultStoreId();
        PageEntity page = pageRepository.findByStoreIdAndSlugIgnoreCase(storeId, slug.trim())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found: " + slug));
        if (page.getPublishedVersionId() == null) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Page is not published: " + slug);
        }
        PageVersionEntity published = pageVersionRepository.findByIdAndPageId(page.getPublishedVersionId(), page.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Published page version missing"));
        return new StorePageResponse(
                page.getId(),
                page.getSlug(),
                page.getTitle(),
                page.getSeoTitle(),
                page.getSeoDescription(),
                published.getVersionNumber(),
                published.getContentJson(),
                published.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public ThemeVersionDto getPublishedTheme() {
        UUID storeId = defaultStoreId();
        ThemeConfigEntity cfg = themeConfigRepository
                .findTopByStoreIdAndStatusOrderByVersionNumberDesc(storeId, "PUBLISHED")
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No published theme configuration"));
        return ThemeVersionDto.from(cfg);
    }

    @Transactional(readOnly = true)
    public NavigationMenuDto getStoreNavigation(String menuKey) {
        UUID storeId = defaultStoreId();
        return getAdminNavigation(storeId, menuKey);
    }

    // ---- Admin Pages ----

    @Transactional(readOnly = true)
    public List<PageSummaryDto> listPages(UUID storeId) {
        return pageRepository.findAllByStoreIdOrderBySlugAsc(storeId).stream()
                .map(p -> {
                    PageVersionEntity latest = pageVersionRepository
                            .findTopByPageIdOrderByVersionNumberDesc(p.getId()).orElse(null);
                    int blockCount = extractBlockCount(latest != null ? latest.getContentJson() : Map.of());
                    boolean hasUnpublishedChanges = latest != null
                            && (p.getPublishedVersionId() == null || !latest.getId().equals(p.getPublishedVersionId()));
                    return new PageSummaryDto(
                            p.getId(),
                            p.getSlug(),
                            p.getTitle(),
                            p.getStatus(),
                            p.getPublishedVersionId(),
                            p.getLatestVersionNumber(),
                            blockCount,
                            hasUnpublishedChanges,
                            p.getVersion(),
                            p.getUpdatedAt()
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public PageDetailDto getAdminPage(UUID storeId, UUID pageId) {
        PageEntity page = pageRepository.findByIdAndStoreId(pageId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found"));
        return assemblePageDetail(page);
    }

    @Transactional(readOnly = true)
    public PageDetailDto getAdminPageBySlug(UUID storeId, String slug) {
        PageEntity page = pageRepository.findByStoreIdAndSlugIgnoreCase(storeId, slug.trim())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found: " + slug));
        return assemblePageDetail(page);
    }

    @Transactional
    public PageDetailDto createPage(AuthenticatedUser actor, CreatePageRequest req) {
        String slug = req.slug().trim().toLowerCase(Locale.ROOT);
        if (pageRepository.findByStoreIdAndSlugIgnoreCase(actor.storeId(), slug).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Page slug already exists: " + slug);
        }
        Map<String, Object> cleanContent = req.content() != null
                ? blockSchemaValidator.validateAndNormalizeContent(req.content())
                : Map.of("version", 1, "blocks", List.of());

        Instant now = Instant.now();
        UUID pageId = UUID.randomUUID();

        PageEntity page = new PageEntity();
        page.setId(pageId);
        page.setStoreId(actor.storeId());
        page.setSlug(slug);
        page.setTitle(req.title().trim());
        page.setStatus("DRAFT");
        page.setSeoTitle(req.seoTitle());
        page.setSeoDescription(req.seoDescription());
        page.setLatestVersionNumber(1);
        page.setCreatedAt(now);
        page.setUpdatedAt(now);
        pageRepository.saveAndFlush(page);

        PageVersionEntity v1 = new PageVersionEntity();
        v1.setId(UUID.randomUUID());
        v1.setPageId(pageId);
        v1.setVersionNumber(1);
        v1.setContentJson(cleanContent);
        v1.setChangeSummary("Initial page draft");
        v1.setCreatedBy(actor.userId());
        v1.setCreatedAt(now);
        pageVersionRepository.save(v1);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_PAGE_CREATED", "PAGE", pageId.toString(),
                null, Map.of("slug", slug, "title", page.getTitle()), Map.of(), null
        );
        return assemblePageDetail(page);
    }

    @Transactional
    public PageDetailDto createPageVersion(AuthenticatedUser actor, UUID pageId, CreatePageVersionRequest req) {
        PageEntity page = pageRepository.findByIdAndStoreId(pageId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found"));

        if (req.expectedVersion() != null && req.expectedVersion() != page.getVersion()) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "Page was updated by another editor. Refresh before saving draft."
            );
        }

        Map<String, Object> normalized = blockSchemaValidator.validateAndNormalizeContent(req.content());
        int nextNum = page.getLatestVersionNumber() + 1;
        Instant now = Instant.now();

        PageVersionEntity ver = new PageVersionEntity();
        ver.setId(UUID.randomUUID());
        ver.setPageId(page.getId());
        ver.setVersionNumber(nextNum);
        ver.setContentJson(normalized);
        ver.setChangeSummary(StringUtils.hasText(req.changeSummary()) ? req.changeSummary().trim() : "Draft saved");
        ver.setCreatedBy(actor.userId());
        ver.setCreatedAt(now);
        pageVersionRepository.save(ver);

        if (StringUtils.hasText(req.title())) page.setTitle(req.title().trim());
        if (req.seoTitle() != null) page.setSeoTitle(req.seoTitle());
        if (req.seoDescription() != null) page.setSeoDescription(req.seoDescription());
        page.setLatestVersionNumber(nextNum);
        page.setUpdatedAt(now);
        PageEntity saved = pageRepository.saveAndFlush(page);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_PAGE_DRAFT_SAVED", "PAGE", saved.getId().toString(),
                null, Map.of("versionNumber", nextNum, "summary", ver.getChangeSummary()),
                Map.of("slug", saved.getSlug()), null
        );
        return assemblePageDetail(saved);
    }

    @Transactional(readOnly = true)
    public PageVersionDto previewPage(UUID storeId, UUID pageId) {
        PageEntity page = pageRepository.findByIdAndStoreId(pageId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found"));
        PageVersionEntity latest = pageVersionRepository.findTopByPageIdOrderByVersionNumberDesc(page.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No page versions found"));
        return PageVersionDto.from(latest);
    }

    @Transactional
    public PageDetailDto publishPage(AuthenticatedUser actor, UUID pageId, PublishPageRequest req) {
        PageEntity page = pageRepository.findByIdAndStoreId(pageId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found"));

        if (req != null && req.expectedVersion() != null && req.expectedVersion() != page.getVersion()) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "Page version mismatch during publish. Reload latest draft and retry."
            );
        }

        PageVersionEntity target = (req != null && req.versionId() != null)
                ? pageVersionRepository.findByIdAndPageId(req.versionId(), page.getId())
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Target page version not found"))
                : pageVersionRepository.findTopByPageIdOrderByVersionNumberDesc(page.getId())
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No page version to publish"));

        UUID prevPublished = page.getPublishedVersionId();
        page.setPublishedVersionId(target.getId());
        page.setStatus("PUBLISHED");
        page.setUpdatedAt(Instant.now());
        PageEntity saved = pageRepository.saveAndFlush(page);
        evictCache("cms:page:" + actor.storeId() + ":" + saved.getSlug());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_PAGE_PUBLISHED", "PAGE", saved.getId().toString(),
                prevPublished != null ? Map.of("publishedVersionId", prevPublished.toString()) : null,
                Map.of("publishedVersionId", target.getId().toString(), "versionNumber", target.getVersionNumber()),
                Map.of("slug", saved.getSlug()), null
        );
        return assemblePageDetail(saved);
    }

    @Transactional
    public PageDetailDto rollbackPage(AuthenticatedUser actor, UUID pageId, UUID versionId) {
        PageEntity page = pageRepository.findByIdAndStoreId(pageId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Page not found"));
        PageVersionEntity source = pageVersionRepository.findByIdAndPageId(versionId, page.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Source page version not found"));

        int nextNum = page.getLatestVersionNumber() + 1;
        Instant now = Instant.now();

        PageVersionEntity rolled = new PageVersionEntity();
        rolled.setId(UUID.randomUUID());
        rolled.setPageId(page.getId());
        rolled.setVersionNumber(nextNum);
        rolled.setContentJson(source.getContentJson());
        rolled.setChangeSummary("Rollback to v" + source.getVersionNumber());
        rolled.setCreatedBy(actor.userId());
        rolled.setCreatedAt(now);
        pageVersionRepository.save(rolled);

        page.setLatestVersionNumber(nextNum);
        page.setPublishedVersionId(rolled.getId());
        page.setStatus("PUBLISHED");
        page.setUpdatedAt(now);
        PageEntity saved = pageRepository.saveAndFlush(page);
        evictCache("cms:page:" + actor.storeId() + ":" + saved.getSlug());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_PAGE_ROLLED_BACK", "PAGE", saved.getId().toString(),
                null,
                Map.of("rolledBackFromVersion", source.getVersionNumber(), "newVersion", nextNum),
                Map.of("slug", saved.getSlug()), null
        );
        return assemblePageDetail(saved);
    }

    // ---- Admin Theme ----

    @Transactional(readOnly = true)
    public AdminThemeResponse getAdminTheme(UUID storeId) {
        List<ThemeVersionDto> versions = themeConfigRepository.findAllByStoreIdOrderByVersionNumberDesc(storeId)
                .stream().map(ThemeVersionDto::from).toList();
        ThemeVersionDto published = versions.stream()
                .filter(v -> "PUBLISHED".equalsIgnoreCase(v.status()))
                .findFirst().orElse(versions.isEmpty() ? null : versions.getFirst());
        ThemeVersionDto latest = versions.isEmpty() ? null : versions.getFirst();
        return new AdminThemeResponse(published, latest, versions);
    }

    @Transactional
    public ThemeVersionDto createThemeVersion(AuthenticatedUser actor, CreateThemeVersionRequest req) {
        Map<String, Object> cleanTokens = themeTokenValidator.validateAndNormalize(req.tokens());
        int nextNum = themeConfigRepository.findTopByStoreIdOrderByVersionNumberDesc(actor.storeId())
                .map(t -> t.getVersionNumber() + 1)
                .orElse(1);

        ThemeConfigEntity draft = new ThemeConfigEntity();
        draft.setId(UUID.randomUUID());
        draft.setStoreId(actor.storeId());
        draft.setVersionNumber(nextNum);
        draft.setStatus("DRAFT");
        draft.setTokensJson(cleanTokens);
        draft.setNote(StringUtils.hasText(req.note()) ? req.note().trim() : "Theme draft v" + nextNum);
        draft.setCreatedBy(actor.userId());
        draft.setCreatedAt(Instant.now());
        ThemeConfigEntity saved = themeConfigRepository.save(draft);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_THEME_DRAFT_SAVED", "THEME", saved.getId().toString(),
                null, Map.of("versionNumber", nextNum, "note", saved.getNote()), Map.of(), null
        );
        return ThemeVersionDto.from(saved);
    }

    @Transactional
    public ThemeVersionDto publishTheme(AuthenticatedUser actor, UUID versionId) {
        ThemeConfigEntity target = versionId != null
                ? themeConfigRepository.findByIdAndStoreId(versionId, actor.storeId())
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Theme version not found"))
                : themeConfigRepository.findTopByStoreIdOrderByVersionNumberDesc(actor.storeId())
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No theme version found"));

        archiveExistingPublishedThemes(actor.storeId(), target.getId());
        target.setStatus("PUBLISHED");
        target.setPublishedAt(Instant.now());
        ThemeConfigEntity saved = themeConfigRepository.save(target);
        evictCache("cms:theme:" + actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_THEME_PUBLISHED", "THEME", saved.getId().toString(),
                null, Map.of("versionNumber", saved.getVersionNumber()), Map.of(), null
        );
        return ThemeVersionDto.from(saved);
    }

    @Transactional
    public ThemeVersionDto rollbackTheme(AuthenticatedUser actor, UUID versionId) {
        ThemeConfigEntity source = themeConfigRepository.findByIdAndStoreId(versionId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Theme version not found"));

        int nextNum = themeConfigRepository.findTopByStoreIdOrderByVersionNumberDesc(actor.storeId())
                .map(t -> t.getVersionNumber() + 1)
                .orElse(1);
        Instant now = Instant.now();

        archiveExistingPublishedThemes(actor.storeId(), null);

        ThemeConfigEntity rolled = new ThemeConfigEntity();
        rolled.setId(UUID.randomUUID());
        rolled.setStoreId(actor.storeId());
        rolled.setVersionNumber(nextNum);
        rolled.setStatus("PUBLISHED");
        rolled.setTokensJson(source.getTokensJson());
        rolled.setNote("Rollback to v" + source.getVersionNumber());
        rolled.setCreatedBy(actor.userId());
        rolled.setPublishedAt(now);
        rolled.setCreatedAt(now);
        ThemeConfigEntity saved = themeConfigRepository.save(rolled);
        evictCache("cms:theme:" + actor.storeId());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_THEME_ROLLED_BACK", "THEME", saved.getId().toString(),
                null, Map.of("rolledBackFromVersion", source.getVersionNumber(), "newVersion", nextNum),
                Map.of(), null
        );
        return ThemeVersionDto.from(saved);
    }

    // ---- Navigation ----

    @Transactional(readOnly = true)
    public NavigationMenuDto getAdminNavigation(UUID storeId, String menuKey) {
        String key = StringUtils.hasText(menuKey) ? menuKey.trim().toLowerCase(Locale.ROOT) : "main";
        NavigationMenuEntity entity = navigationMenuRepository.findByStoreIdAndMenuKeyIgnoreCase(storeId, key)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Navigation menu not found: " + key));
        return new NavigationMenuDto(entity.getId(), entity.getMenuKey(), entity.getItemsJson(), entity.getUpdatedAt());
    }

    @Transactional
    public NavigationMenuDto updateNavigation(
            AuthenticatedUser actor,
            String menuKey,
            List<Map<String, Object>> items
    ) {
        String key = menuKey.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> clean = blockSchemaValidator.validateNavigationItems(items);
        Instant now = Instant.now();

        NavigationMenuEntity entity = navigationMenuRepository.findByStoreIdAndMenuKeyIgnoreCase(actor.storeId(), key)
                .orElseGet(() -> {
                    NavigationMenuEntity e = new NavigationMenuEntity();
                    e.setId(UUID.randomUUID());
                    e.setStoreId(actor.storeId());
                    e.setMenuKey(key);
                    return e;
                });
        entity.setItemsJson(clean);
        entity.setUpdatedAt(now);
        NavigationMenuEntity saved = navigationMenuRepository.save(entity);
        evictCache("cms:nav:" + actor.storeId() + ":" + key);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CMS_NAVIGATION_UPDATED", "NAVIGATION_MENU", saved.getId().toString(),
                null, Map.of("menuKey", key, "linkCount", clean.size()), Map.of(), null
        );
        return new NavigationMenuDto(saved.getId(), saved.getMenuKey(), saved.getItemsJson(), saved.getUpdatedAt());
    }

    private void archiveExistingPublishedThemes(UUID storeId, UUID excludeId) {
        List<ThemeConfigEntity> existing = themeConfigRepository.findAllByStoreIdOrderByVersionNumberDesc(storeId);
        for (ThemeConfigEntity cfg : existing) {
            if ("PUBLISHED".equalsIgnoreCase(cfg.getStatus()) && !cfg.getId().equals(excludeId)) {
                cfg.setStatus("ARCHIVED");
                themeConfigRepository.save(cfg);
            }
        }
    }

    private PageDetailDto assemblePageDetail(PageEntity page) {
        List<PageVersionDto> versions = pageVersionRepository.findAllByPageIdOrderByVersionNumberDesc(page.getId())
                .stream().map(PageVersionDto::from).toList();
        PageVersionDto latest = versions.isEmpty() ? null : versions.getFirst();
        PageVersionDto published = page.getPublishedVersionId() == null
                ? null
                : versions.stream().filter(v -> v.id().equals(page.getPublishedVersionId())).findFirst().orElse(null);
        return new PageDetailDto(
                page.getId(),
                page.getSlug(),
                page.getTitle(),
                page.getStatus(),
                page.getSeoTitle(),
                page.getSeoDescription(),
                page.getPublishedVersionId(),
                page.getLatestVersionNumber(),
                page.getVersion(),
                published,
                latest,
                versions,
                page.getUpdatedAt()
        );
    }

    private UUID defaultStoreId() {
        return storeRepository.findByCode("terrain-supply")
                .map(StoreEntity::getId)
                .orElseGet(() -> storeRepository.findAll().stream()
                        .findFirst()
                        .map(StoreEntity::getId)
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not initialized")));
    }

    private void evictCache(String key) {
        try {
            redisTemplate.delete(key);
        } catch (Exception ignored) {
            // Redis cache invalidation is best-effort
        }
    }

    private static int extractBlockCount(Map<String, Object> content) {
        if (content != null && content.get("blocks") instanceof List<?> list) {
            return list.size();
        }
        return 0;
    }

    public record CreatePageRequest(
            @NotBlank @Pattern(regexp = "^[a-z0-9-]+$") @Size(max = 120) String slug,
            @NotBlank @Size(max = 160) String title,
            String seoTitle,
            String seoDescription,
            Map<String, Object> content
    ) {
    }

    public record CreatePageVersionRequest(
            @NotNull Map<String, Object> content,
            @Size(max = 255) String changeSummary,
            String title,
            String seoTitle,
            String seoDescription,
            Long expectedVersion
    ) {
    }

    public record PublishPageRequest(UUID versionId, Long expectedVersion) {
    }

    public record CreateThemeVersionRequest(
            @NotNull Map<String, Object> tokens,
            @Size(max = 255) String note
    ) {
    }

    public record PublishThemeRequest(UUID versionId) {
    }

    public record UpdateNavigationRequest(@NotNull List<Map<String, Object>> items) {
    }

    public record PageVersionDto(
            UUID id,
            int versionNumber,
            Map<String, Object> content,
            String changeSummary,
            UUID createdBy,
            Instant createdAt
    ) {
        static PageVersionDto from(PageVersionEntity e) {
            return new PageVersionDto(
                    e.getId(), e.getVersionNumber(), e.getContentJson(),
                    e.getChangeSummary(), e.getCreatedBy(), e.getCreatedAt()
            );
        }
    }

    public record PageSummaryDto(
            UUID id,
            String slug,
            String title,
            String status,
            UUID publishedVersionId,
            int latestVersionNumber,
            int blockCount,
            boolean hasUnpublishedChanges,
            long version,
            Instant updatedAt
    ) {
    }

    public record PageDetailDto(
            UUID id,
            String slug,
            String title,
            String status,
            String seoTitle,
            String seoDescription,
            UUID publishedVersionId,
            int latestVersionNumber,
            long version,
            PageVersionDto publishedVersion,
            PageVersionDto latestVersion,
            List<PageVersionDto> versions,
            Instant updatedAt
    ) {
    }

    public record StorePageResponse(
            UUID id,
            String slug,
            String title,
            String seoTitle,
            String seoDescription,
            int versionNumber,
            Map<String, Object> content,
            Instant publishedAt
    ) {
    }

    public record ThemeVersionDto(
            UUID id,
            int versionNumber,
            String status,
            Map<String, Object> tokens,
            String note,
            Instant publishedAt,
            Instant createdAt
    ) {
        static ThemeVersionDto from(ThemeConfigEntity e) {
            return new ThemeVersionDto(
                    e.getId(), e.getVersionNumber(), e.getStatus(),
                    e.getTokensJson(), e.getNote(), e.getPublishedAt(), e.getCreatedAt()
            );
        }
    }

    public record AdminThemeResponse(
            ThemeVersionDto published,
            ThemeVersionDto latest,
            List<ThemeVersionDto> versions
    ) {
    }

    public record NavigationMenuDto(
            UUID id,
            String menuKey,
            List<Map<String, Object>> items,
            Instant updatedAt
    ) {
    }
}
