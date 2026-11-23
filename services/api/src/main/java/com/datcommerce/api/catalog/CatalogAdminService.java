package com.datcommerce.api.catalog;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.inventory.InventoryService;
import com.datcommerce.api.pricing.PriceEntity;
import com.datcommerce.api.pricing.PricingService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CatalogAdminService {

    private final ProductTypeRepository productTypeRepository;
    private final AttributeDefinitionRepository attributeRepository;
    private final AttributeOptionRepository optionRepository;
    private final ProductTypeAttributeRepository typeAttributeRepository;
    private final VariantOptionDefinitionRepository variantOptionDefRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ProductImageRepository imageRepository;
    private final ProductAttributeValueRepository attrValueRepository;
    private final VariantRepository variantRepository;
    private final VariantOptionValueRepository variantOptionValueRepository;
    private final CollectionRepository collectionRepository;
    private final CollectionProductRepository collectionProductRepository;
    private final AttributeValidationService attributeValidationService;
    private final PricingService pricingService;
    private final InventoryService inventoryService;
    private final AuditLogService auditLogService;

    public CatalogAdminService(
            ProductTypeRepository productTypeRepository,
            AttributeDefinitionRepository attributeRepository,
            AttributeOptionRepository optionRepository,
            ProductTypeAttributeRepository typeAttributeRepository,
            VariantOptionDefinitionRepository variantOptionDefRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            ProductImageRepository imageRepository,
            ProductAttributeValueRepository attrValueRepository,
            VariantRepository variantRepository,
            VariantOptionValueRepository variantOptionValueRepository,
            CollectionRepository collectionRepository,
            CollectionProductRepository collectionProductRepository,
            AttributeValidationService attributeValidationService,
            PricingService pricingService,
            InventoryService inventoryService,
            AuditLogService auditLogService
    ) {
        this.productTypeRepository = productTypeRepository;
        this.attributeRepository = attributeRepository;
        this.optionRepository = optionRepository;
        this.typeAttributeRepository = typeAttributeRepository;
        this.variantOptionDefRepository = variantOptionDefRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.imageRepository = imageRepository;
        this.attrValueRepository = attrValueRepository;
        this.variantRepository = variantRepository;
        this.variantOptionValueRepository = variantOptionValueRepository;
        this.collectionRepository = collectionRepository;
        this.collectionProductRepository = collectionProductRepository;
        this.attributeValidationService = attributeValidationService;
        this.pricingService = pricingService;
        this.inventoryService = inventoryService;
        this.auditLogService = auditLogService;
    }

    // ---- Product Types ----

    @Transactional(readOnly = true)
    public List<CatalogDtos.ProductTypeDto> listProductTypes(UUID storeId) {
        List<ProductTypeEntity> types = productTypeRepository.findAllByStoreIdOrderByNameAsc(storeId);
        return assembleProductTypes(storeId, types);
    }

    @Transactional(readOnly = true)
    public CatalogDtos.ProductTypeDto getProductType(UUID storeId, UUID typeId) {
        ProductTypeEntity type = productTypeRepository.findByIdAndStoreId(typeId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product type not found"));
        return assembleProductTypes(storeId, List.of(type)).getFirst();
    }

    @Transactional
    public CatalogDtos.ProductTypeDto createProductType(
            AuthenticatedUser actor,
            CatalogDtos.CreateProductTypeRequest req
    ) {
        String code = req.code().trim().toLowerCase(Locale.ROOT);
        if (productTypeRepository.existsByStoreIdAndCodeIgnoreCase(actor.storeId(), code)) {
            throw new ApiException(ErrorCode.CONFLICT, "Product type code already exists: " + code);
        }
        Instant now = Instant.now();
        ProductTypeEntity entity = new ProductTypeEntity();
        entity.setId(UUID.randomUUID());
        entity.setStoreId(actor.storeId());
        entity.setCode(code);
        entity.setName(req.name().trim());
        entity.setDescription(req.description());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        ProductTypeEntity saved = productTypeRepository.save(entity);

        if (req.attributes() != null) {
            saveTypeAttributes(actor.storeId(), saved.getId(), req.attributes());
        }
        if (req.variantOptions() != null) {
            saveVariantOptions(saved.getId(), req.variantOptions());
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "PRODUCT_TYPE_CREATED", "PRODUCT_TYPE", saved.getId().toString(),
                null, Map.of("code", saved.getCode(), "name", saved.getName()), Map.of(), null
        );
        return getProductType(actor.storeId(), saved.getId());
    }

    @Transactional
    public CatalogDtos.ProductTypeDto updateProductType(
            AuthenticatedUser actor,
            UUID typeId,
            CatalogDtos.UpdateProductTypeRequest req
    ) {
        ProductTypeEntity entity = productTypeRepository.findByIdAndStoreId(typeId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product type not found"));
        if (StringUtils.hasText(req.name())) {
            entity.setName(req.name().trim());
        }
        if (req.description() != null) {
            entity.setDescription(req.description());
        }
        entity.setUpdatedAt(Instant.now());
        productTypeRepository.save(entity);

        if (req.attributes() != null) {
            saveTypeAttributes(actor.storeId(), typeId, req.attributes());
        }
        if (req.variantOptions() != null) {
            saveVariantOptions(typeId, req.variantOptions());
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "PRODUCT_TYPE_UPDATED", "PRODUCT_TYPE", typeId.toString(),
                null, Map.of("name", entity.getName()), Map.of(), null
        );
        return getProductType(actor.storeId(), typeId);
    }

    @Transactional
    public CatalogDtos.ProductTypeDto bindAttributeToProductType(
            AuthenticatedUser actor,
            UUID typeId,
            CatalogDtos.TypeAttributeBindingRequest req
    ) {
        ProductTypeEntity type = productTypeRepository.findByIdAndStoreId(typeId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product type not found"));
        AttributeDefinitionEntity def = attributeRepository.findByIdAndStoreId(req.attributeDefinitionId(), actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Attribute definition not found"));
        if (def.getArchivedAt() != null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Cannot bind an archived attribute");
        }

        var id = new ProductTypeAttributeEntity.ProductTypeAttributeId(type.getId(), def.getId());
        ProductTypeAttributeEntity binding = typeAttributeRepository.findById(id)
                .orElseGet(() -> {
                    ProductTypeAttributeEntity e = new ProductTypeAttributeEntity();
                    e.setId(id);
                    return e;
                });
        int defaultOrder = typeAttributeRepository.findAllByIdProductTypeIdOrderByDisplayOrderAsc(typeId).size();
        binding.setDisplayOrder(req.displayOrder() != null ? req.displayOrder() : defaultOrder);
        binding.setRequiredOverride(req.requiredOverride());
        typeAttributeRepository.save(binding);

        return getProductType(actor.storeId(), typeId);
    }

    private void saveTypeAttributes(
            UUID storeId,
            UUID typeId,
            List<CatalogDtos.TypeAttributeBindingRequest> bindings
    ) {
        typeAttributeRepository.deleteAllByIdProductTypeId(typeId);
        typeAttributeRepository.flush();
        if (bindings.isEmpty()) return;

        List<UUID> defIds = bindings.stream().map(CatalogDtos.TypeAttributeBindingRequest::attributeDefinitionId).toList();
        Map<UUID, AttributeDefinitionEntity> defs = attributeRepository.findAllByIdIn(defIds).stream()
                .filter(d -> d.getStoreId().equals(storeId) && d.getArchivedAt() == null)
                .collect(Collectors.toMap(AttributeDefinitionEntity::getId, Function.identity()));

        List<ProductTypeAttributeEntity> entities = new ArrayList<>();
        for (int i = 0; i < bindings.size(); i++) {
            CatalogDtos.TypeAttributeBindingRequest b = bindings.get(i);
            if (!defs.containsKey(b.attributeDefinitionId())) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "Invalid or archived attribute definition: " + b.attributeDefinitionId());
            }
            ProductTypeAttributeEntity entity = new ProductTypeAttributeEntity();
            entity.setId(new ProductTypeAttributeEntity.ProductTypeAttributeId(typeId, b.attributeDefinitionId()));
            entity.setDisplayOrder(b.displayOrder() != null ? b.displayOrder() : i);
            entity.setRequiredOverride(b.requiredOverride());
            entities.add(entity);
        }
        typeAttributeRepository.saveAll(entities);
    }

    private void saveVariantOptions(UUID typeId, List<CatalogDtos.VariantOptionDefRequest> options) {
        variantOptionDefRepository.deleteAllByProductTypeId(typeId);
        variantOptionDefRepository.flush();
        List<VariantOptionDefinitionEntity> entities = new ArrayList<>();
        for (int i = 0; i < options.size(); i++) {
            CatalogDtos.VariantOptionDefRequest opt = options.get(i);
            VariantOptionDefinitionEntity entity = new VariantOptionDefinitionEntity();
            entity.setId(UUID.randomUUID());
            entity.setProductTypeId(typeId);
            entity.setCode(opt.code().trim().toLowerCase(Locale.ROOT));
            entity.setName(opt.name().trim());
            entity.setSortOrder(opt.sortOrder() != null ? opt.sortOrder() : i);
            entities.add(entity);
        }
        if (!entities.isEmpty()) {
            variantOptionDefRepository.saveAll(entities);
        }
    }

    private List<CatalogDtos.ProductTypeDto> assembleProductTypes(UUID storeId, List<ProductTypeEntity> types) {
        if (types.isEmpty()) return List.of();
        List<UUID> typeIds = types.stream().map(ProductTypeEntity::getId).toList();

        List<ProductTypeAttributeEntity> allBindings =
                typeAttributeRepository.findAllByIdProductTypeIdInOrderByDisplayOrderAsc(typeIds);
        Set<UUID> attrIds = allBindings.stream()
                .map(b -> b.getId().getAttributeDefinitionId())
                .collect(Collectors.toSet());

        Map<UUID, AttributeDefinitionEntity> attrsById = attrIds.isEmpty()
                ? Map.of()
                : attributeRepository.findAllByIdIn(attrIds).stream()
                        .collect(Collectors.toMap(AttributeDefinitionEntity::getId, Function.identity()));
        Map<UUID, List<CatalogDtos.AttributeOptionDto>> optionsByAttr = attrIds.isEmpty()
                ? Map.of()
                : optionRepository.findAllByAttributeDefinitionIdInOrderBySortOrderAsc(attrIds).stream()
                        .collect(Collectors.groupingBy(
                                AttributeOptionEntity::getAttributeDefinitionId,
                                Collectors.mapping(
                                        o -> new CatalogDtos.AttributeOptionDto(o.getId(), o.getValue(), o.getLabel(), o.getSortOrder()),
                                        Collectors.toList()
                                )
                        ));

        Map<UUID, List<ProductTypeAttributeEntity>> bindingsByType = allBindings.stream()
                .collect(Collectors.groupingBy(b -> b.getId().getProductTypeId()));

        Map<UUID, List<CatalogDtos.VariantOptionDefDto>> varOptsByType =
                variantOptionDefRepository.findAllByProductTypeIdInOrderBySortOrderAsc(typeIds).stream()
                        .collect(Collectors.groupingBy(
                                VariantOptionDefinitionEntity::getProductTypeId,
                                Collectors.mapping(
                                        v -> new CatalogDtos.VariantOptionDefDto(v.getId(), v.getCode(), v.getName(), v.getSortOrder()),
                                        Collectors.toList()
                                )
                        ));

        return types.stream().map(t -> {
            List<CatalogDtos.TypeAttributeDto> attrs = bindingsByType.getOrDefault(t.getId(), List.of()).stream()
                    .map(b -> {
                        AttributeDefinitionEntity d = attrsById.get(b.getId().getAttributeDefinitionId());
                        if (d == null) return null;
                        boolean req = b.getRequiredOverride() != null ? b.getRequiredOverride() : d.isRequired();
                        return new CatalogDtos.TypeAttributeDto(
                                d.getId(), d.getCode(), d.getName(), d.getDataType(),
                                req, d.isFilterable(), d.isSearchable(), d.getUnit(),
                                d.getValidationRulesJson() != null ? d.getValidationRulesJson() : Map.of(),
                                optionsByAttr.getOrDefault(d.getId(), List.of()),
                                b.getDisplayOrder(), b.getRequiredOverride(),
                                d.getArchivedAt() != null
                        );
                    })
                    .filter(java.util.Objects::nonNull)
                    .toList();
            return new CatalogDtos.ProductTypeDto(
                    t.getId(), t.getCode(), t.getName(), t.getDescription(),
                    attrs, varOptsByType.getOrDefault(t.getId(), List.of()), t.getUpdatedAt()
            );
        }).toList();
    }

    // ---- Attribute Definitions ----

    @Transactional(readOnly = true)
    public List<CatalogDtos.AttributeDefinitionDto> listAttributes(UUID storeId, boolean includeArchived) {
        List<AttributeDefinitionEntity> defs = includeArchived
                ? attributeRepository.findAllByStoreIdOrderByCodeAsc(storeId)
                : attributeRepository.findAllByStoreIdAndArchivedAtIsNullOrderByCodeAsc(storeId);
        if (defs.isEmpty()) return List.of();
        List<UUID> ids = defs.stream().map(AttributeDefinitionEntity::getId).toList();
        Map<UUID, List<CatalogDtos.AttributeOptionDto>> optionsByDef =
                optionRepository.findAllByAttributeDefinitionIdInOrderBySortOrderAsc(ids).stream()
                        .collect(Collectors.groupingBy(
                                AttributeOptionEntity::getAttributeDefinitionId,
                                Collectors.mapping(
                                        o -> new CatalogDtos.AttributeOptionDto(o.getId(), o.getValue(), o.getLabel(), o.getSortOrder()),
                                        Collectors.toList()
                                )
                        ));
        return defs.stream().map(d -> new CatalogDtos.AttributeDefinitionDto(
                d.getId(), d.getCode(), d.getName(), d.getDataType(),
                d.isRequired(), d.isFilterable(), d.isSearchable(), d.getUnit(),
                d.getValidationRulesJson() != null ? d.getValidationRulesJson() : Map.of(),
                optionsByDef.getOrDefault(d.getId(), List.of()),
                d.getArchivedAt(), d.getUpdatedAt()
        )).toList();
    }

    @Transactional
    public CatalogDtos.AttributeDefinitionDto createAttribute(
            AuthenticatedUser actor,
            CatalogDtos.CreateAttributeRequest req
    ) {
        String code = req.code().trim().toLowerCase(Locale.ROOT);
        String dataType = req.dataType().trim().toUpperCase(Locale.ROOT);
        if (!AttributeValidationService.VALID_TYPES.contains(dataType)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Invalid dataType: " + dataType);
        }
        if (attributeRepository.findByStoreIdAndCodeIgnoreCase(actor.storeId(), code).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Attribute code already exists: " + code);
        }
        if (("ENUM".equals(dataType) || "MULTI_SELECT".equals(dataType))
                && (req.options() == null || req.options().isEmpty())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "ENUM and MULTI_SELECT attributes require at least one option");
        }

        Instant now = Instant.now();
        AttributeDefinitionEntity entity = new AttributeDefinitionEntity();
        entity.setId(UUID.randomUUID());
        entity.setStoreId(actor.storeId());
        entity.setCode(code);
        entity.setName(req.name().trim());
        entity.setDataType(dataType);
        entity.setRequired(req.required());
        entity.setFilterable(req.filterable());
        entity.setSearchable(req.searchable());
        entity.setUnit(StringUtils.hasText(req.unit()) ? req.unit().trim() : null);
        entity.setValidationRulesJson(req.validationRules() != null ? req.validationRules() : Map.of());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        AttributeDefinitionEntity saved = attributeRepository.save(entity);

        if (req.options() != null) {
            saveAttributeOptions(saved.getId(), req.options());
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ATTRIBUTE_CREATED", "ATTRIBUTE", saved.getId().toString(),
                null, Map.of("code", saved.getCode(), "dataType", saved.getDataType()), Map.of(), null
        );
        return listAttributes(actor.storeId(), true).stream()
                .filter(a -> a.id().equals(saved.getId()))
                .findFirst().orElseThrow();
    }

    @Transactional
    public CatalogDtos.AttributeDefinitionDto updateAttribute(
            AuthenticatedUser actor,
            UUID attributeId,
            CatalogDtos.UpdateAttributeRequest req
    ) {
        AttributeDefinitionEntity entity = attributeRepository.findByIdAndStoreId(attributeId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Attribute not found"));
        if (StringUtils.hasText(req.name())) entity.setName(req.name().trim());
        if (req.required() != null) entity.setRequired(req.required());
        if (req.filterable() != null) entity.setFilterable(req.filterable());
        if (req.searchable() != null) entity.setSearchable(req.searchable());
        if (req.unit() != null) entity.setUnit(StringUtils.hasText(req.unit()) ? req.unit().trim() : null);
        if (req.validationRules() != null) entity.setValidationRulesJson(req.validationRules());
        if (req.archived() != null) {
            entity.setArchivedAt(req.archived() ? Instant.now() : null);
        }
        entity.setUpdatedAt(Instant.now());
        attributeRepository.save(entity);

        if (req.options() != null) {
            saveAttributeOptions(attributeId, req.options());
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ATTRIBUTE_UPDATED", "ATTRIBUTE", attributeId.toString(),
                null, Map.of("code", entity.getCode(), "name", entity.getName()), Map.of(), null
        );
        return listAttributes(actor.storeId(), true).stream()
                .filter(a -> a.id().equals(attributeId))
                .findFirst().orElseThrow();
    }

    @Transactional
    public CatalogDtos.DeleteAttributeResponse deleteOrArchiveAttribute(AuthenticatedUser actor, UUID attributeId) {
        AttributeDefinitionEntity entity = attributeRepository.findByIdAndStoreId(attributeId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Attribute not found"));

        boolean inUse = attrValueRepository.existsByAttributeDefinitionId(attributeId)
                || typeAttributeRepository.existsByIdAttributeDefinitionId(attributeId);

        if (inUse) {
            Instant archivedAt = Instant.now();
            entity.setArchivedAt(archivedAt);
            entity.setUpdatedAt(archivedAt);
            attributeRepository.save(entity);
            auditLogService.record(
                    actor.storeId(), actor.userId(), actor.email(),
                    "ATTRIBUTE_ARCHIVED", "ATTRIBUTE", attributeId.toString(),
                    null, Map.of("code", entity.getCode(), "archived", true), Map.of(), null
            );
            return new CatalogDtos.DeleteAttributeResponse(attributeId, true, archivedAt);
        }

        attributeRepository.delete(entity);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ATTRIBUTE_DELETED", "ATTRIBUTE", attributeId.toString(),
                Map.of("code", entity.getCode()), null, Map.of(), null
        );
        return new CatalogDtos.DeleteAttributeResponse(attributeId, false, null);
    }

    private void saveAttributeOptions(UUID attributeId, List<CatalogDtos.AttributeOptionRequest> options) {
        optionRepository.deleteAllByAttributeDefinitionId(attributeId);
        optionRepository.flush();
        List<AttributeOptionEntity> list = new ArrayList<>();
        for (int i = 0; i < options.size(); i++) {
            CatalogDtos.AttributeOptionRequest o = options.get(i);
            AttributeOptionEntity entity = new AttributeOptionEntity();
            entity.setId(UUID.randomUUID());
            entity.setAttributeDefinitionId(attributeId);
            entity.setValue(o.value().trim());
            entity.setLabel(o.label().trim());
            entity.setSortOrder(o.sortOrder() != null ? o.sortOrder() : i);
            list.add(entity);
        }
        if (!list.isEmpty()) {
            optionRepository.saveAll(list);
        }
    }

    // ---- Categories ----

    @Transactional(readOnly = true)
    public List<CatalogDtos.CategoryDto> listCategories(UUID storeId) {
        List<CategoryEntity> categories = categoryRepository.findAllByStoreIdOrderByNameAsc(storeId);
        List<ProductEntity> products = productRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
        Map<UUID, Long> countByCategory = new HashMap<>();
        for (ProductEntity p : products) {
            for (CategoryEntity c : p.getCategories()) {
                countByCategory.merge(c.getId(), 1L, Long::sum);
            }
        }
        return categories.stream()
                .map(c -> new CatalogDtos.CategoryDto(
                        c.getId(), c.getParentId(), c.getSlug(), c.getName(),
                        c.getDescription(), c.getSeoDescription(), c.getImageUrl(),
                        c.getDefaultProductTypeId(), countByCategory.getOrDefault(c.getId(), 0L),
                        c.getUpdatedAt()
                ))
                .toList();
    }

    @Transactional
    public CatalogDtos.CategoryDto createCategory(AuthenticatedUser actor, CatalogDtos.CreateCategoryRequest req) {
        String slug = slugify(StringUtils.hasText(req.slug()) ? req.slug() : req.name());
        if (categoryRepository.findByStoreIdAndSlugIgnoreCase(actor.storeId(), slug).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Category slug already exists: " + slug);
        }
        if (req.parentId() != null) {
            categoryRepository.findByIdAndStoreId(req.parentId(), actor.storeId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Parent category not found"));
        }

        Instant now = Instant.now();
        CategoryEntity entity = new CategoryEntity();
        entity.setId(UUID.randomUUID());
        entity.setStoreId(actor.storeId());
        entity.setParentId(req.parentId());
        entity.setSlug(slug);
        entity.setName(req.name().trim());
        entity.setDescription(req.description());
        entity.setSeoDescription(req.seoDescription());
        entity.setImageUrl(req.imageUrl());
        entity.setDefaultProductTypeId(req.defaultProductTypeId());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        CategoryEntity saved = categoryRepository.save(entity);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CATEGORY_CREATED", "CATEGORY", saved.getId().toString(),
                null, Map.of("name", saved.getName(), "slug", saved.getSlug()), Map.of(), null
        );
        return listCategories(actor.storeId()).stream().filter(c -> c.id().equals(saved.getId())).findFirst().orElseThrow();
    }

    @Transactional
    public CatalogDtos.CategoryDto updateCategory(
            AuthenticatedUser actor,
            UUID categoryId,
            CatalogDtos.UpdateCategoryRequest req
    ) {
        CategoryEntity entity = categoryRepository.findByIdAndStoreId(categoryId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Category not found"));
        if (StringUtils.hasText(req.name())) entity.setName(req.name().trim());
        if (StringUtils.hasText(req.slug())) entity.setSlug(slugify(req.slug()));
        if (req.clearParent()) {
            entity.setParentId(null);
        } else if (req.parentId() != null) {
            validateNoCategoryCycle(actor.storeId(), categoryId, req.parentId());
            entity.setParentId(req.parentId());
        }
        if (req.description() != null) entity.setDescription(req.description());
        if (req.seoDescription() != null) entity.setSeoDescription(req.seoDescription());
        if (req.imageUrl() != null) entity.setImageUrl(req.imageUrl());
        if (req.defaultProductTypeId() != null) entity.setDefaultProductTypeId(req.defaultProductTypeId());
        entity.setUpdatedAt(Instant.now());
        categoryRepository.save(entity);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CATEGORY_UPDATED", "CATEGORY", categoryId.toString(),
                null, Map.of("name", entity.getName(), "slug", entity.getSlug()), Map.of(), null
        );
        return listCategories(actor.storeId()).stream().filter(c -> c.id().equals(categoryId)).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteCategory(AuthenticatedUser actor, UUID categoryId) {
        CategoryEntity entity = categoryRepository.findByIdAndStoreId(categoryId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Category not found"));
        categoryRepository.delete(entity);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "CATEGORY_DELETED", "CATEGORY", categoryId.toString(),
                Map.of("name", entity.getName()), null, Map.of(), null
        );
    }

    private void validateNoCategoryCycle(UUID storeId, UUID categoryId, UUID proposedParentId) {
        UUID cursor = proposedParentId;
        int guard = 0;
        while (cursor != null && guard++ < 50) {
            if (cursor.equals(categoryId)) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "Category hierarchy cycle detected");
            }
            cursor = categoryRepository.findByIdAndStoreId(cursor, storeId)
                    .map(CategoryEntity::getParentId)
                    .orElse(null);
        }
    }

    // ---- Collections ----

    @Transactional(readOnly = true)
    public List<CatalogDtos.CollectionDto> listCollections(UUID storeId) {
        List<CollectionEntity> cols = collectionRepository.findAllByStoreIdOrderByNameAsc(storeId);
        if (cols.isEmpty()) return List.of();
        List<UUID> ids = cols.stream().map(CollectionEntity::getId).toList();
        Map<UUID, List<UUID>> productIdsByCol = collectionProductRepository
                .findAllByIdCollectionIdInOrderBySortOrderAsc(ids).stream()
                .collect(Collectors.groupingBy(
                        cp -> cp.getId().getCollectionId(),
                        Collectors.mapping(cp -> cp.getId().getProductId(), Collectors.toList())
                ));
        return cols.stream()
                .map(c -> new CatalogDtos.CollectionDto(
                        c.getId(), c.getSlug(), c.getName(), c.getDescription(),
                        productIdsByCol.getOrDefault(c.getId(), List.of()), c.getUpdatedAt()
                ))
                .toList();
    }

    @Transactional
    public CatalogDtos.CollectionDto createCollection(AuthenticatedUser actor, CatalogDtos.UpsertCollectionRequest req) {
        String slug = slugify(StringUtils.hasText(req.slug()) ? req.slug() : req.name());
        if (collectionRepository.findByStoreIdAndSlugIgnoreCase(actor.storeId(), slug).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Collection slug already exists");
        }
        Instant now = Instant.now();
        CollectionEntity col = new CollectionEntity();
        col.setId(UUID.randomUUID());
        col.setStoreId(actor.storeId());
        col.setSlug(slug);
        col.setName(req.name().trim());
        col.setDescription(req.description());
        col.setCreatedAt(now);
        col.setUpdatedAt(now);
        CollectionEntity saved = collectionRepository.save(col);
        saveCollectionProducts(saved.getId(), req.productIds());
        return listCollections(actor.storeId()).stream().filter(c -> c.id().equals(saved.getId())).findFirst().orElseThrow();
    }

    @Transactional
    public CatalogDtos.CollectionDto updateCollection(
            AuthenticatedUser actor,
            UUID collectionId,
            CatalogDtos.UpsertCollectionRequest req
    ) {
        CollectionEntity col = collectionRepository.findByIdAndStoreId(collectionId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Collection not found"));
        col.setName(req.name().trim());
        if (StringUtils.hasText(req.slug())) col.setSlug(slugify(req.slug()));
        col.setDescription(req.description());
        col.setUpdatedAt(Instant.now());
        collectionRepository.save(col);
        saveCollectionProducts(collectionId, req.productIds());
        return listCollections(actor.storeId()).stream().filter(c -> c.id().equals(collectionId)).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteCollection(AuthenticatedUser actor, UUID collectionId) {
        CollectionEntity col = collectionRepository.findByIdAndStoreId(collectionId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Collection not found"));
        collectionRepository.delete(col);
    }

    private void saveCollectionProducts(UUID collectionId, List<UUID> productIds) {
        collectionProductRepository.deleteAllByIdCollectionId(collectionId);
        collectionProductRepository.flush();
        if (productIds == null || productIds.isEmpty()) return;
        List<CollectionEntity.CollectionProductEntity> items = new ArrayList<>();
        for (int i = 0; i < productIds.size(); i++) {
            CollectionEntity.CollectionProductEntity cp = new CollectionEntity.CollectionProductEntity();
            cp.setId(new CollectionEntity.CollectionProductId(collectionId, productIds.get(i)));
            cp.setSortOrder(i);
            items.add(cp);
        }
        collectionProductRepository.saveAll(items);
    }

    // ---- Products & Variants ----

    @Transactional(readOnly = true)
    public List<CatalogDtos.ProductDto> listProducts(UUID storeId, String q, UUID categoryId, String status) {
        List<ProductEntity> all = productRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
        List<ProductEntity> filtered = all.stream()
                .filter(p -> !StringUtils.hasText(status) || p.getStatus().equalsIgnoreCase(status.trim()))
                .filter(p -> categoryId == null || p.getCategories().stream().anyMatch(c -> c.getId().equals(categoryId)))
                .filter(p -> {
                    if (!StringUtils.hasText(q)) return true;
                    String needle = q.trim().toLowerCase(Locale.ROOT);
                    return p.getName().toLowerCase(Locale.ROOT).contains(needle)
                            || p.getBrand().toLowerCase(Locale.ROOT).contains(needle)
                            || p.getSlug().toLowerCase(Locale.ROOT).contains(needle);
                })
                .toList();
        return assembleProducts(storeId, filtered);
    }

    @Transactional(readOnly = true)
    public CatalogDtos.ProductDto getProduct(UUID storeId, UUID productId) {
        ProductEntity p = productRepository.findByIdAndStoreId(productId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product not found"));
        return assembleProducts(storeId, List.of(p)).getFirst();
    }

    @Transactional
    public CatalogDtos.ProductDto createProduct(AuthenticatedUser actor, CatalogDtos.CreateProductRequest req) {
        productTypeRepository.findByIdAndStoreId(req.productTypeId(), actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product type not found"));

        String baseSlug = slugify(StringUtils.hasText(req.slug()) ? req.slug() : req.name());
        String uniqueSlug = ensureUniqueSlug(actor.storeId(), baseSlug);

        Set<CategoryEntity> categories = resolveCategories(actor.storeId(), req.categoryIds());
        Instant now = Instant.now();

        ProductEntity product = new ProductEntity();
        product.setId(UUID.randomUUID());
        product.setStoreId(actor.storeId());
        product.setProductTypeId(req.productTypeId());
        product.setSlug(uniqueSlug);
        product.setName(req.name().trim());
        product.setBrand(StringUtils.hasText(req.brand()) ? req.brand().trim() : "Terrain");
        product.setDescription(req.description() != null ? req.description() : "");
        product.setStatus(normalizeStatus(req.status(), "ACTIVE"));
        product.setPrimaryImageUrl(resolvePrimaryImage(req.primaryImageUrl(), req.images()));
        product.setSeoTitle(req.seoTitle());
        product.setSeoDescription(req.seoDescription());
        product.setRating(new BigDecimal("4.80"));
        product.setReviewCount(0);
        product.setCategories(categories);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);

        ProductEntity saved = productRepository.saveAndFlush(product);

        saveProductImages(saved.getId(), req.images(), saved.getPrimaryImageUrl());
        attributeValidationService.validateAndSaveProductAttributes(
                saved.getId(), saved.getProductTypeId(), req.attributes(), false, false
        );

        for (CatalogDtos.VariantInput v : req.variants()) {
            createVariantInternal(actor.storeId(), saved.getId(), v);
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "PRODUCT_CREATED", "PRODUCT", saved.getId().toString(),
                null, Map.of("name", saved.getName(), "slug", saved.getSlug()), Map.of(), null
        );
        return getProduct(actor.storeId(), saved.getId());
    }

    @Transactional
    public CatalogDtos.ProductDto updateProduct(
            AuthenticatedUser actor,
            UUID productId,
            CatalogDtos.UpdateProductRequest req
    ) {
        ProductEntity product = productRepository.findByIdAndStoreId(productId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product not found"));

        if (req.expectedVersion() != null && !req.expectedVersion().equals(product.getVersion())) {
            throw new ApiException(ErrorCode.CONFLICT, "Product was modified concurrently. Refresh and try again.");
        }

        Map<String, Object> before = Map.of("name", product.getName(), "status", product.getStatus());

        boolean typeChanged = false;
        if (req.productTypeId() != null && !req.productTypeId().equals(product.getProductTypeId())) {
            productTypeRepository.findByIdAndStoreId(req.productTypeId(), actor.storeId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product type not found"));
            product.setProductTypeId(req.productTypeId());
            typeChanged = true;
        }
        if (StringUtils.hasText(req.name())) product.setName(req.name().trim());
        if (StringUtils.hasText(req.slug())) product.setSlug(slugify(req.slug()));
        if (req.brand() != null) product.setBrand(req.brand().trim());
        if (req.description() != null) product.setDescription(req.description());
        if (StringUtils.hasText(req.status())) product.setStatus(normalizeStatus(req.status(), product.getStatus()));
        if (req.primaryImageUrl() != null) product.setPrimaryImageUrl(req.primaryImageUrl());
        if (req.seoTitle() != null) product.setSeoTitle(req.seoTitle());
        if (req.seoDescription() != null) product.setSeoDescription(req.seoDescription());
        if (req.categoryIds() != null) {
            product.setCategories(resolveCategories(actor.storeId(), req.categoryIds()));
        }
        product.setUpdatedAt(Instant.now());

        if (req.images() != null) {
            saveProductImages(productId, req.images(), product.getPrimaryImageUrl());
            if (!StringUtils.hasText(product.getPrimaryImageUrl()) && !req.images().isEmpty()) {
                product.setPrimaryImageUrl(req.images().getFirst().url());
            }
        }

        if (req.attributes() != null || typeChanged) {
            Map<String, Object> attrPayload = req.attributes();
            if (attrPayload == null) {
                // Re-validate existing attributes against the new productTypeId
                attrPayload = currentAttributesAsMap(productId);
            }
            attributeValidationService.validateAndSaveProductAttributes(
                    productId,
                    product.getProductTypeId(),
                    attrPayload,
                    typeChanged,
                    Boolean.TRUE.equals(req.confirmDropIncompatibleAttributes())
            );
        }

        ProductEntity saved = productRepository.saveAndFlush(product);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "PRODUCT_UPDATED", "PRODUCT", saved.getId().toString(),
                before, Map.of("name", saved.getName(), "status", saved.getStatus()), Map.of(), null
        );
        return getProduct(actor.storeId(), saved.getId());
    }

    @Transactional
    public void deleteProduct(AuthenticatedUser actor, UUID productId) {
        ProductEntity product = productRepository.findByIdAndStoreId(productId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product not found"));
        productRepository.delete(product);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "PRODUCT_DELETED", "PRODUCT", productId.toString(),
                Map.of("name", product.getName()), null, Map.of(), null
        );
    }

    @Transactional
    public CatalogDtos.VariantDto addVariant(
            AuthenticatedUser actor,
            UUID productId,
            CatalogDtos.VariantInput input
    ) {
        productRepository.findByIdAndStoreId(productId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product not found"));
        VariantEntity saved = createVariantInternal(actor.storeId(), productId, input);
        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "VARIANT_CREATED", "VARIANT", saved.getId().toString(),
                null, Map.of("sku", saved.getSku(), "productId", productId.toString()), Map.of(), null
        );
        return getProduct(actor.storeId(), productId).variants().stream()
                .filter(v -> v.id().equals(saved.getId()))
                .findFirst().orElseThrow();
    }

    @Transactional
    public CatalogDtos.VariantDto updateVariant(
            AuthenticatedUser actor,
            UUID variantId,
            CatalogDtos.UpdateVariantRequest req
    ) {
        VariantEntity variant = variantRepository.findByIdAndStoreId(variantId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Variant not found"));
        if (StringUtils.hasText(req.sku()) && !req.sku().trim().equalsIgnoreCase(variant.getSku())) {
            String nextSku = req.sku().trim();
            if (variantRepository.existsByStoreIdAndSkuIgnoreCase(actor.storeId(), nextSku)) {
                throw new ApiException(ErrorCode.CONFLICT, "SKU already exists: " + nextSku);
            }
            variant.setSku(nextSku);
        }
        if (StringUtils.hasText(req.title())) variant.setTitle(req.title().trim());
        if (StringUtils.hasText(req.status())) variant.setStatus(normalizeStatus(req.status(), variant.getStatus()));
        variant.setUpdatedAt(Instant.now());
        VariantEntity saved = variantRepository.saveAndFlush(variant);

        if (req.price() != null) {
            pricingService.upsertVariantPrice(actor.storeId(), saved.getId(), "USD", req.price(), req.compareAtPrice());
        }
        if (req.options() != null) {
            saveVariantOptionValues(saved.getId(), req.options());
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "VARIANT_UPDATED", "VARIANT", saved.getId().toString(),
                null, Map.of("sku", saved.getSku()), Map.of(), null
        );
        return getProduct(actor.storeId(), saved.getProductId()).variants().stream()
                .filter(v -> v.id().equals(saved.getId()))
                .findFirst().orElseThrow();
    }

    private VariantEntity createVariantInternal(UUID storeId, UUID productId, CatalogDtos.VariantInput v) {
        String sku = v.sku().trim();
        if (variantRepository.existsByStoreIdAndSkuIgnoreCase(storeId, sku)) {
            throw new ApiException(ErrorCode.CONFLICT, "SKU already exists: " + sku);
        }
        Instant now = Instant.now();
        VariantEntity entity = new VariantEntity();
        entity.setId(UUID.randomUUID());
        entity.setStoreId(storeId);
        entity.setProductId(productId);
        entity.setSku(sku);
        entity.setTitle(v.title().trim());
        entity.setStatus(normalizeStatus(v.status(), "ACTIVE"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        VariantEntity saved = variantRepository.saveAndFlush(entity);

        saveVariantOptionValues(saved.getId(), v.options());
        pricingService.upsertVariantPrice(storeId, saved.getId(), "USD", v.price(), v.compareAtPrice());
        inventoryService.ensureVariantStock(storeId, saved.getId(), saved.getSku(), v.stock());
        return saved;
    }

    private void saveVariantOptionValues(UUID variantId, Map<String, String> options) {
        variantOptionValueRepository.deleteAllByVariantId(variantId);
        variantOptionValueRepository.flush();
        if (options == null || options.isEmpty()) return;
        List<VariantOptionValueEntity> rows = new ArrayList<>();
        for (Map.Entry<String, String> e : options.entrySet()) {
            if (!StringUtils.hasText(e.getKey()) || !StringUtils.hasText(e.getValue())) continue;
            VariantOptionValueEntity row = new VariantOptionValueEntity();
            row.setId(UUID.randomUUID());
            row.setVariantId(variantId);
            row.setOptionName(e.getKey().trim().toLowerCase(Locale.ROOT));
            row.setOptionValue(e.getValue().trim());
            rows.add(row);
        }
        if (!rows.isEmpty()) {
            variantOptionValueRepository.saveAll(rows);
        }
    }

    private void saveProductImages(UUID productId, List<CatalogDtos.ProductImageInput> images, String fallbackPrimary) {
        imageRepository.deleteAllByProductId(productId);
        imageRepository.flush();
        List<ProductImageEntity> list = new ArrayList<>();
        if (images != null && !images.isEmpty()) {
            for (int i = 0; i < images.size(); i++) {
                CatalogDtos.ProductImageInput img = images.get(i);
                ProductImageEntity e = new ProductImageEntity();
                e.setId(UUID.randomUUID());
                e.setProductId(productId);
                e.setMediaAssetId(img.mediaAssetId());
                e.setUrl(img.url().trim());
                e.setAltText(img.altText());
                e.setSortOrder(i);
                list.add(e);
            }
        } else if (StringUtils.hasText(fallbackPrimary)) {
            ProductImageEntity e = new ProductImageEntity();
            e.setId(UUID.randomUUID());
            e.setProductId(productId);
            e.setUrl(fallbackPrimary.trim());
            e.setSortOrder(0);
            list.add(e);
        }
        if (!list.isEmpty()) {
            imageRepository.saveAll(list);
        }
    }

    private Map<String, Object> currentAttributesAsMap(UUID productId) {
        List<ProductAttributeValueEntity> vals = attrValueRepository.findAllByProductId(productId);
        if (vals.isEmpty()) return Map.of();
        List<UUID> defIds = vals.stream().map(ProductAttributeValueEntity::getAttributeDefinitionId).toList();
        Map<UUID, AttributeDefinitionEntity> defs = attributeRepository.findAllByIdIn(defIds).stream()
                .collect(Collectors.toMap(AttributeDefinitionEntity::getId, Function.identity()));
        Map<String, Object> out = new LinkedHashMap<>();
        for (ProductAttributeValueEntity v : vals) {
            AttributeDefinitionEntity d = defs.get(v.getAttributeDefinitionId());
            if (d != null) {
                Object raw = AttributeValidationService.extractRawValue(v, d.getDataType());
                if (raw != null) out.put(d.getCode(), raw);
            }
        }
        return out;
    }

    // ---- Shared Assembly ----

    public List<CatalogDtos.ProductDto> assembleProducts(UUID storeId, List<ProductEntity> products) {
        if (products.isEmpty()) return List.of();
        List<UUID> productIds = products.stream().map(ProductEntity::getId).toList();
        Set<UUID> typeIds = products.stream().map(ProductEntity::getProductTypeId).collect(Collectors.toSet());

        Map<UUID, ProductTypeEntity> typesById = productTypeRepository.findAllById(typeIds).stream()
                .collect(Collectors.toMap(ProductTypeEntity::getId, Function.identity()));

        Map<UUID, List<ProductImageEntity>> imagesByProduct = imageRepository
                .findAllByProductIdInOrderBySortOrderAsc(productIds).stream()
                .collect(Collectors.groupingBy(ProductImageEntity::getProductId));

        List<ProductAttributeValueEntity> allAttrVals = attrValueRepository.findAllByProductIdIn(productIds);
        Set<UUID> attrDefIds = allAttrVals.stream()
                .map(ProductAttributeValueEntity::getAttributeDefinitionId)
                .collect(Collectors.toSet());
        Map<UUID, AttributeDefinitionEntity> attrDefsById = attrDefIds.isEmpty()
                ? Map.of()
                : attributeRepository.findAllByIdIn(attrDefIds).stream()
                        .collect(Collectors.toMap(AttributeDefinitionEntity::getId, Function.identity()));
        Map<UUID, List<ProductAttributeValueEntity>> attrValsByProduct = allAttrVals.stream()
                .collect(Collectors.groupingBy(ProductAttributeValueEntity::getProductId));

        List<VariantEntity> allVariants = variantRepository.findAllByProductIdInOrderByCreatedAtAsc(productIds);
        List<UUID> variantIds = allVariants.stream().map(VariantEntity::getId).toList();
        Map<UUID, List<VariantEntity>> variantsByProduct = allVariants.stream()
                .collect(Collectors.groupingBy(VariantEntity::getProductId));

        Map<UUID, PriceEntity> pricesByVariant = pricingService.getPricesByVariantIds(variantIds, "USD");
        Map<UUID, Integer> stockByVariant = inventoryService.getAvailableStockByVariantIds(storeId, variantIds);
        Map<UUID, Map<String, String>> optionsByVariant = new HashMap<>();
        if (!variantIds.isEmpty()) {
            for (VariantOptionValueEntity opt : variantOptionValueRepository.findAllByVariantIdIn(variantIds)) {
                optionsByVariant.computeIfAbsent(opt.getVariantId(), k -> new LinkedHashMap<>())
                        .put(opt.getOptionName(), opt.getOptionValue());
            }
        }

        return products.stream().map(p -> {
            ProductTypeEntity type = typesById.get(p.getProductTypeId());
            List<CatalogDtos.ProductImageDto> imgDtos = imagesByProduct.getOrDefault(p.getId(), List.of()).stream()
                    .map(img -> new CatalogDtos.ProductImageDto(
                            img.getId(), img.getMediaAssetId(), img.getUrl(), img.getAltText(), img.getSortOrder()))
                    .toList();

            List<CatalogDtos.ProductAttributeDto> attrDtos = attrValsByProduct.getOrDefault(p.getId(), List.of()).stream()
                    .map(v -> {
                        AttributeDefinitionEntity def = attrDefsById.get(v.getAttributeDefinitionId());
                        if (def == null) return null;
                        Object raw = AttributeValidationService.extractRawValue(v, def.getDataType());
                        String display = AttributeValidationService.formatDisplayValue(v, def);
                        return new CatalogDtos.ProductAttributeDto(
                                def.getId(), def.getCode(), def.getName(), def.getDataType(),
                                def.getUnit(), raw, display, def.isFilterable(), def.isSearchable()
                        );
                    })
                    .filter(java.util.Objects::nonNull)
                    .toList();

            List<CatalogDtos.VariantDto> variantDtos = variantsByProduct.getOrDefault(p.getId(), List.of()).stream()
                    .map(v -> {
                        PriceEntity pr = pricesByVariant.get(v.getId());
                        BigDecimal price = pr != null ? pr.getAmount() : BigDecimal.ZERO;
                        BigDecimal compare = pr != null ? pr.getCompareAtAmount() : null;
                        int avail = stockByVariant.getOrDefault(v.getId(), 0);
                        return new CatalogDtos.VariantDto(
                                v.getId(), v.getSku(), v.getTitle(), v.getStatus(),
                                price, compare, "USD", avail,
                                optionsByVariant.getOrDefault(v.getId(), Map.of()),
                                v.getVersion()
                        );
                    })
                    .toList();

            BigDecimal minPrice = variantDtos.stream().map(CatalogDtos.VariantDto::price)
                    .min(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
            BigDecimal maxPrice = variantDtos.stream().map(CatalogDtos.VariantDto::price)
                    .max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
            BigDecimal compareAt = variantDtos.stream()
                    .map(CatalogDtos.VariantDto::compareAtPrice)
                    .filter(java.util.Objects::nonNull)
                    .findFirst().orElse(null);
            int totalStock = variantDtos.stream().mapToInt(CatalogDtos.VariantDto::availableStock).sum();

            List<CatalogDtos.CategoryRefDto> catRefs = p.getCategories().stream()
                    .map(c -> new CatalogDtos.CategoryRefDto(c.getId(), c.getSlug(), c.getName()))
                    .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                    .toList();

            return new CatalogDtos.ProductDto(
                    p.getId(),
                    p.getProductTypeId(),
                    type != null ? type.getName() : "",
                    type != null ? type.getCode() : "",
                    p.getSlug(),
                    p.getName(),
                    p.getBrand(),
                    p.getDescription(),
                    p.getStatus(),
                    p.getPrimaryImageUrl(),
                    imgDtos,
                    p.getSeoTitle(),
                    p.getSeoDescription(),
                    p.getRating(),
                    p.getReviewCount(),
                    minPrice,
                    maxPrice,
                    compareAt,
                    totalStock,
                    catRefs,
                    attrDtos,
                    variantDtos,
                    p.getVersion(),
                    p.getCreatedAt(),
                    p.getUpdatedAt()
            );
        }).toList();
    }

    private Set<CategoryEntity> resolveCategories(UUID storeId, List<UUID> categoryIds) {
        if (categoryIds == null || categoryIds.isEmpty()) {
            return new HashSet<>();
        }
        List<CategoryEntity> found = categoryRepository.findAllByStoreIdAndIdIn(storeId, categoryIds);
        if (found.size() != new HashSet<>(categoryIds).size()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "One or more categoryIds are invalid");
        }
        return new HashSet<>(found);
    }

    private String ensureUniqueSlug(UUID storeId, String baseSlug) {
        String candidate = baseSlug;
        int n = 2;
        while (productRepository.existsByStoreIdAndSlugIgnoreCase(storeId, candidate)) {
            candidate = baseSlug + "-" + n++;
        }
        return candidate;
    }

    private static String resolvePrimaryImage(String explicit, List<CatalogDtos.ProductImageInput> images) {
        if (StringUtils.hasText(explicit)) return explicit.trim();
        if (images != null && !images.isEmpty()) return images.getFirst().url().trim();
        return "/media/terrain-fallback.jpg";
    }

    private static String normalizeStatus(String status, String fallback) {
        if (!StringUtils.hasText(status)) return fallback;
        String upper = status.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("DRAFT", "ACTIVE", "ARCHIVED").contains(upper)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Invalid status: " + status);
        }
        return upper;
    }

    public static String slugify(String raw) {
        String cleaned = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return cleaned.isEmpty() ? "item-" + UUID.randomUUID().toString().substring(0, 6) : cleaned;
    }
}
