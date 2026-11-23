package com.datcommerce.api.ai;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.catalog.CatalogAdminService;
import com.datcommerce.api.catalog.CatalogDtos;
import com.datcommerce.api.cms.CmsService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.inventory.InventoryService;
import com.datcommerce.api.promotion.PromotionService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

@Service
public class AiChangePlanService {

    private final AiChangePlanRepository changePlanRepository;
    private final CatalogAdminService catalogAdminService;
    private final InventoryService inventoryService;
    private final PromotionService promotionService;
    private final CmsService cmsService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate requiresNewTx;

    public AiChangePlanService(
            AiChangePlanRepository changePlanRepository,
            CatalogAdminService catalogAdminService,
            InventoryService inventoryService,
            PromotionService promotionService,
            CmsService cmsService,
            AuditLogService auditLogService,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager
    ) {
        this.changePlanRepository = changePlanRepository;
        this.catalogAdminService = catalogAdminService;
        this.inventoryService = inventoryService;
        this.promotionService = promotionService;
        this.cmsService = cmsService;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
        this.requiresNewTx = new TransactionTemplate(transactionManager);
        this.requiresNewTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional(readOnly = true)
    public List<AiDtos.ChangePlanDto> listPlans(UUID storeId) {
        return changePlanRepository.findTop50ByStoreIdOrderByCreatedAtDesc(storeId).stream()
                .map(AiDtos.ChangePlanDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public AiDtos.ChangePlanDto getPlan(UUID storeId, UUID planId) {
        AiChangePlanEntity entity = changePlanRepository.findByIdAndStoreId(planId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Change plan not found"));
        return AiDtos.ChangePlanDto.from(entity);
    }

    @Transactional
    public AiDtos.ChangePlanDto applyPlan(AuthenticatedUser actor, UUID planId, String idempotencyKey) {
        if (!StringUtils.hasText(idempotencyKey)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Idempotency-Key header is required to apply a change plan");
        }
        String trimmedKey = idempotencyKey.trim();

        Optional<AiChangePlanEntity> replay = changePlanRepository.findByStoreIdAndIdempotencyKey(actor.storeId(), trimmedKey);
        if (replay.isPresent() && replay.get().getId().equals(planId)) {
            return AiDtos.ChangePlanDto.from(replay.get());
        }
        if (replay.isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Idempotency-Key already used by another change plan");
        }

        AiChangePlanEntity plan = changePlanRepository.findByIdAndStoreId(planId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Change plan not found"));

        String requiredPerm = requiredPermissionFor(plan.getPlanType());
        if (!actor.permissions().contains(requiredPerm)) {
            auditLogService.record(
                    actor.storeId(), actor.userId(), actor.email(),
                    "AI_PLAN_FORBIDDEN", "AI_CHANGE_PLAN", planId.toString(),
                    null, null, Map.of("requiredPermission", requiredPerm), trimmedKey
            );
            throw new ApiException(ErrorCode.FORBIDDEN, "Missing permission " + requiredPerm + " to apply this plan");
        }

        if (!"PENDING_APPROVAL".equalsIgnoreCase(plan.getStatus())) {
            throw new ApiException(ErrorCode.CONFLICT, "Change plan cannot be applied in status: " + plan.getStatus());
        }

        Instant now = Instant.now();
        if (plan.getExpiresAt().isBefore(now)) {
            requiresNewTx.executeWithoutResult(status -> changePlanRepository.findByIdAndStoreId(planId, actor.storeId())
                    .ifPresent(p -> {
                        p.setStatus("EXPIRED");
                        p.setUpdatedAt(Instant.now());
                        changePlanRepository.save(p);
                    }));
            throw new ApiException(ErrorCode.CONFLICT, "Change plan has expired; generate a fresh plan");
        }

        Map<String, Object> rollbackSnapshot = executeOperation(actor, plan);

        plan.setStatus("APPLIED");
        plan.setApprovedBy(actor.userId());
        plan.setAppliedAt(now);
        plan.setIdempotencyKey(trimmedKey);
        plan.setRollbackSnapshotJson(rollbackSnapshot);
        plan.setUpdatedAt(now);
        AiChangePlanEntity saved = changePlanRepository.save(plan);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "AI_PLAN_APPLIED", "AI_CHANGE_PLAN", saved.getId().toString(),
                null,
                Map.of("planType", saved.getPlanType(), "summary", saved.getRequestSummary()),
                Map.of("conversationId", saved.getConversationId().toString()),
                trimmedKey
        );
        return AiDtos.ChangePlanDto.from(saved);
    }

    @Transactional
    public AiDtos.ChangePlanDto rejectPlan(AuthenticatedUser actor, UUID planId, String reason) {
        AiChangePlanEntity plan = changePlanRepository.findByIdAndStoreId(planId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Change plan not found"));

        if (!"PENDING_APPROVAL".equalsIgnoreCase(plan.getStatus())) {
            throw new ApiException(ErrorCode.CONFLICT, "Only pending plans can be rejected");
        }
        plan.setStatus("REJECTED");
        plan.setApprovedBy(actor.userId());
        plan.setErrorMessage(StringUtils.hasText(reason) ? reason.trim() : "Rejected by admin");
        plan.setUpdatedAt(Instant.now());
        AiChangePlanEntity saved = changePlanRepository.save(plan);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "AI_PLAN_REJECTED", "AI_CHANGE_PLAN", saved.getId().toString(),
                null, Map.of("reason", saved.getErrorMessage()), Map.of(), null
        );
        return AiDtos.ChangePlanDto.from(saved);
    }

    @Transactional
    public AiDtos.ChangePlanDto rollbackPlan(AuthenticatedUser actor, UUID planId) {
        AiChangePlanEntity plan = changePlanRepository.findByIdAndStoreId(planId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Change plan not found"));

        String requiredPerm = requiredPermissionFor(plan.getPlanType());
        if (!actor.permissions().contains(requiredPerm)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Missing permission " + requiredPerm + " to rollback this plan");
        }
        if (!plan.isReversible() || plan.getRollbackSnapshotJson() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "This change plan is not reversible");
        }
        if (!"APPLIED".equalsIgnoreCase(plan.getStatus())) {
            throw new ApiException(ErrorCode.CONFLICT, "Only APPLIED plans can be rolled back");
        }

        executeRollback(actor, plan);
        Instant now = Instant.now();
        plan.setStatus("ROLLED_BACK");
        plan.setRolledBackAt(now);
        plan.setUpdatedAt(now);
        AiChangePlanEntity saved = changePlanRepository.save(plan);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "AI_PLAN_ROLLED_BACK", "AI_CHANGE_PLAN", saved.getId().toString(),
                null, Map.of("planType", saved.getPlanType()), Map.of(), null
        );
        return AiDtos.ChangePlanDto.from(saved);
    }

    private Map<String, Object> executeOperation(AuthenticatedUser actor, AiChangePlanEntity plan) {
        Map<String, Object> ops = plan.getOperationsJson();
        return switch (plan.getPlanType()) {
            case "BULK_PRICE_UPDATE" -> {
                List<Map<String, Object>> items = convertList(ops.get("items"));
                List<Map<String, Object>> undoItems = new ArrayList<>();
                for (Map<String, Object> item : items) {
                    UUID variantId = UUID.fromString(String.valueOf(item.get("variantId")));
                    BigDecimal oldPrice = new BigDecimal(String.valueOf(item.get("oldPrice")));
                    BigDecimal newPrice = new BigDecimal(String.valueOf(item.get("newPrice")));
                    catalogAdminService.updateVariant(
                            actor, variantId,
                            new CatalogDtos.UpdateVariantRequest(null, null, newPrice, null, null, null)
                    );
                    undoItems.add(Map.of("variantId", variantId.toString(), "oldPrice", oldPrice));
                }
                yield Map.of("items", undoItems);
            }
            case "UPDATE_PRODUCT" -> {
                UUID productId = UUID.fromString(String.valueOf(ops.get("productId")));
                CatalogDtos.ProductDto before = catalogAdminService.getProduct(actor.storeId(), productId);
                Long expectedVersion = ops.get("expectedVersion") instanceof Number n ? n.longValue() : before.version();
                catalogAdminService.updateProduct(actor, productId, new CatalogDtos.UpdateProductRequest(
                        null, null,
                        ops.get("name") != null ? String.valueOf(ops.get("name")) : null,
                        null, null,
                        ops.get("description") != null ? String.valueOf(ops.get("description")) : null,
                        ops.get("status") != null ? String.valueOf(ops.get("status")) : null,
                        null, null, null, null, null,
                        ops.get("attributes") != null ? convertMap(ops.get("attributes")) : null,
                        expectedVersion
                ));
                yield Map.of(
                        "productId", productId.toString(),
                        "name", before.name(),
                        "description", before.description() != null ? before.description() : "",
                        "status", before.status()
                );
            }
            case "CREATE_PRODUCT" -> {
                List<Map<String, Object>> rawVars = convertList(ops.get("variants"));
                List<CatalogDtos.VariantInput> vars = rawVars.stream()
                        .map(v -> new CatalogDtos.VariantInput(
                                null,
                                String.valueOf(v.get("sku")),
                                String.valueOf(v.get("title")),
                                new BigDecimal(String.valueOf(v.get("price"))),
                                null,
                                v.get("stock") instanceof Number n ? n.intValue() : 10,
                                Map.of(),
                                "ACTIVE"
                        ))
                        .toList();
                List<UUID> catIds = ops.get("categoryIds") instanceof List<?> l
                        ? l.stream().map(x -> UUID.fromString(String.valueOf(x))).toList()
                        : List.of();
                catalogAdminService.createProduct(actor, new CatalogDtos.CreateProductRequest(
                        UUID.fromString(String.valueOf(ops.get("productTypeId"))),
                        String.valueOf(ops.get("name")),
                        null,
                        String.valueOf(ops.get("brand")),
                        String.valueOf(ops.getOrDefault("description", "")),
                        "ACTIVE",
                        "/media/laptop-pro.svg",
                        null, null, null,
                        catIds,
                        convertMap(ops.get("attributes")),
                        vars
                ));
                yield null;
            }
            case "CREATE_CATEGORY" -> {
                UUID parentId = ops.get("parentId") != null && StringUtils.hasText(String.valueOf(ops.get("parentId")))
                        ? UUID.fromString(String.valueOf(ops.get("parentId"))) : null;
                catalogAdminService.createCategory(actor, new CatalogDtos.CreateCategoryRequest(
                        String.valueOf(ops.get("name")),
                        String.valueOf(ops.get("slug")),
                        parentId,
                        String.valueOf(ops.getOrDefault("description", "")),
                        null, "/media/terrain-fallback.jpg", null
                ));
                yield null;
            }
            case "CREATE_ATTRIBUTE" -> {
                catalogAdminService.createAttribute(actor, new CatalogDtos.CreateAttributeRequest(
                        String.valueOf(ops.get("code")),
                        String.valueOf(ops.get("name")),
                        String.valueOf(ops.get("dataType")),
                        Boolean.TRUE.equals(ops.get("required")),
                        Boolean.TRUE.equals(ops.get("filterable")),
                        Boolean.TRUE.equals(ops.get("searchable")),
                        ops.get("unit") != null ? String.valueOf(ops.get("unit")) : null,
                        Map.of(),
                        List.of()
                ));
                yield null;
            }
            case "CREATE_PRODUCT_TYPE" -> {
                List<CatalogDtos.TypeAttributeBindingRequest> bindings = new ArrayList<>();
                for (Map<String, Object> attr : convertList(ops.get("newAttributes"))) {
                    CatalogDtos.AttributeDefinitionDto def = catalogAdminService.createAttribute(actor,
                            new CatalogDtos.CreateAttributeRequest(
                                    String.valueOf(attr.get("code")),
                                    String.valueOf(attr.get("name")),
                                    String.valueOf(attr.get("dataType")),
                                    Boolean.TRUE.equals(attr.get("required")),
                                    Boolean.TRUE.equals(attr.get("filterable")),
                                    true,
                                    attr.get("unit") != null ? String.valueOf(attr.get("unit")) : null,
                                    Map.of(),
                                    List.of()
                            ));
                    bindings.add(new CatalogDtos.TypeAttributeBindingRequest(def.id(), bindings.size(), def.required()));
                }
                List<CatalogDtos.VariantOptionDefRequest> voReqs = convertList(ops.get("variantOptions")).stream()
                        .map(vo -> new CatalogDtos.VariantOptionDefRequest(
                                String.valueOf(vo.get("code")), String.valueOf(vo.get("name")), null))
                        .toList();
                catalogAdminService.createProductType(actor, new CatalogDtos.CreateProductTypeRequest(
                        String.valueOf(ops.get("code")),
                        String.valueOf(ops.get("name")),
                        String.valueOf(ops.getOrDefault("description", "")),
                        bindings,
                        voReqs
                ));
                yield null;
            }
            case "ADJUST_STOCK" -> {
                inventoryService.adjustStock(actor, new InventoryService.AdjustStockRequest(
                        UUID.fromString(String.valueOf(ops.get("variantId"))),
                        null,
                        ((Number) ops.get("delta")).intValue(),
                        String.valueOf(ops.get("reason"))
                ));
                yield null;
            }
            case "CREATE_PROMOTION" -> {
                Instant now = Instant.now();
                List<UUID> targets = ops.get("targetIds") instanceof List<?> l
                        ? l.stream().map(x -> UUID.fromString(String.valueOf(x))).toList()
                        : List.of();
                promotionService.create(actor, new PromotionService.CreatePromotionRequest(
                        String.valueOf(ops.get("code")),
                        String.valueOf(ops.get("name")),
                        String.valueOf(ops.get("type")),
                        new BigDecimal(String.valueOf(ops.get("value"))),
                        ops.get("scopeType") != null ? String.valueOf(ops.get("scopeType")) : "ORDER",
                        now,
                        now.plus(30, ChronoUnit.DAYS),
                        100,
                        null,
                        false,
                        "ACTIVE",
                        targets
                ));
                yield null;
            }
            case "PAGE_CHANGE" -> {
                UUID pageId = UUID.fromString(String.valueOf(ops.get("pageId")));
                CmsService.PageDetailDto before = cmsService.getAdminPage(actor.storeId(), pageId);
                UUID prevLatestId = before.latestVersion() != null ? before.latestVersion().id() : null;
                Long expectedVersion = ops.get("expectedVersion") instanceof Number n ? n.longValue() : before.version();
                cmsService.createPageVersion(actor, pageId, new CmsService.CreatePageVersionRequest(
                        convertMap(ops.get("content")),
                        String.valueOf(ops.getOrDefault("changeSummary", "AI draft update")),
                        null, null, null, expectedVersion
                ));
                Map<String, Object> snap = new LinkedHashMap<>();
                snap.put("pageId", pageId.toString());
                if (prevLatestId != null) {
                    snap.put("previousContent", before.latestVersion().content());
                }
                yield snap;
            }
            case "THEME_CHANGE" -> {
                CmsService.AdminThemeResponse beforeTheme = cmsService.getAdminTheme(actor.storeId());
                cmsService.createThemeVersion(actor, new CmsService.CreateThemeVersionRequest(
                        convertMap(ops.get("tokens")),
                        String.valueOf(ops.getOrDefault("note", "AI draft theme"))
                ));
                yield Map.of(
                        "previousTokens",
                        beforeTheme.latest() != null ? beforeTheme.latest().tokens() : Map.of()
                );
            }
            default -> throw new ApiException(ErrorCode.BAD_REQUEST, "Unsupported change plan type: " + plan.getPlanType());
        };
    }

    private void executeRollback(AuthenticatedUser actor, AiChangePlanEntity plan) {
        Map<String, Object> snap = plan.getRollbackSnapshotJson();
        switch (plan.getPlanType()) {
            case "BULK_PRICE_UPDATE" -> {
                for (Map<String, Object> item : convertList(snap.get("items"))) {
                    UUID variantId = UUID.fromString(String.valueOf(item.get("variantId")));
                    BigDecimal oldPrice = new BigDecimal(String.valueOf(item.get("oldPrice")));
                    catalogAdminService.updateVariant(
                            actor, variantId,
                            new CatalogDtos.UpdateVariantRequest(null, null, oldPrice, null, null, null)
                    );
                }
            }
            case "UPDATE_PRODUCT" -> {
                UUID productId = UUID.fromString(String.valueOf(snap.get("productId")));
                catalogAdminService.updateProduct(actor, productId, new CatalogDtos.UpdateProductRequest(
                        null, null,
                        String.valueOf(snap.get("name")),
                        null, null,
                        String.valueOf(snap.get("description")),
                        String.valueOf(snap.get("status")),
                        null, null, null, null, null, null, null
                ));
            }
            case "PAGE_CHANGE" -> {
                UUID pageId = UUID.fromString(String.valueOf(snap.get("pageId")));
                if (snap.get("previousContent") != null) {
                    cmsService.createPageVersion(actor, pageId, new CmsService.CreatePageVersionRequest(
                            convertMap(snap.get("previousContent")),
                            "Rollback AI page change",
                            null, null, null, null
                    ));
                }
            }
            case "THEME_CHANGE" -> {
                if (snap.get("previousTokens") instanceof Map<?, ?> && !((Map<?, ?>) snap.get("previousTokens")).isEmpty()) {
                    cmsService.createThemeVersion(actor, new CmsService.CreateThemeVersionRequest(
                            convertMap(snap.get("previousTokens")),
                            "Rollback AI theme change"
                    ));
                }
            }
            default -> throw new ApiException(ErrorCode.BAD_REQUEST, "Rollback unsupported for " + plan.getPlanType());
        }
    }

    public static String requiredPermissionFor(String planType) {
        if (planType == null) return "catalog:write";
        return switch (planType.toUpperCase(Locale.ROOT)) {
            case "BULK_PRICE_UPDATE" -> "pricing:write";
            case "ADJUST_STOCK" -> "inventory:write";
            case "CREATE_PROMOTION" -> "promotion:write";
            case "PAGE_CHANGE", "THEME_CHANGE" -> "content:write";
            default -> "catalog:write";
        };
    }

    private Map<String, Object> convertMap(Object obj) {
        return obj == null ? Map.of() : objectMapper.convertValue(obj, new TypeReference<>() {
        });
    }

    private List<Map<String, Object>> convertList(Object obj) {
        return obj == null ? List.of() : objectMapper.convertValue(obj, new TypeReference<>() {
        });
    }
}
