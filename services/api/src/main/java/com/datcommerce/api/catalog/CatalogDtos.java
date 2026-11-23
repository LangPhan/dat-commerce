package com.datcommerce.api.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    // ---- Product Types ----

    public record VariantOptionDefRequest(
            @NotBlank @Pattern(regexp = "^[a-z0-9_]+$") @Size(max = 64) String code,
            @NotBlank @Size(max = 160) String name,
            Integer sortOrder
    ) {
    }

    public record TypeAttributeBindingRequest(
            @NotNull UUID attributeDefinitionId,
            Integer displayOrder,
            Boolean requiredOverride
    ) {
    }

    public record CreateProductTypeRequest(
            @NotBlank @Pattern(regexp = "^[a-z0-9_-]+$") @Size(max = 64) String code,
            @NotBlank @Size(max = 160) String name,
            String description,
            @Valid List<TypeAttributeBindingRequest> attributes,
            @Valid List<VariantOptionDefRequest> variantOptions
    ) {
    }

    public record UpdateProductTypeRequest(
            @Size(min = 1, max = 160) String name,
            String description,
            @Valid List<TypeAttributeBindingRequest> attributes,
            @Valid List<VariantOptionDefRequest> variantOptions
    ) {
    }

    public record TypeAttributeDto(
            UUID attributeDefinitionId,
            String code,
            String name,
            String dataType,
            boolean required,
            boolean filterable,
            boolean searchable,
            String unit,
            Map<String, Object> validationRules,
            List<AttributeOptionDto> options,
            int displayOrder,
            Boolean requiredOverride,
            boolean archived
    ) {
    }

    public record VariantOptionDefDto(UUID id, String code, String name, int sortOrder) {
    }

    public record ProductTypeDto(
            UUID id,
            String code,
            String name,
            String description,
            List<TypeAttributeDto> attributes,
            List<VariantOptionDefDto> variantOptions,
            Instant updatedAt
    ) {
    }

    // ---- Attributes ----

    public record AttributeOptionRequest(
            @NotBlank @Size(max = 160) String value,
            @NotBlank @Size(max = 160) String label,
            Integer sortOrder
    ) {
    }

    public record CreateAttributeRequest(
            @NotBlank @Pattern(regexp = "^[a-z0-9_]+$") @Size(max = 64) String code,
            @NotBlank @Size(max = 160) String name,
            @NotBlank String dataType,
            boolean required,
            boolean filterable,
            boolean searchable,
            @Size(max = 32) String unit,
            Map<String, Object> validationRules,
            @Valid List<AttributeOptionRequest> options
    ) {
    }

    public record UpdateAttributeRequest(
            @Size(min = 1, max = 160) String name,
            Boolean required,
            Boolean filterable,
            Boolean searchable,
            @Size(max = 32) String unit,
            Map<String, Object> validationRules,
            @Valid List<AttributeOptionRequest> options,
            Boolean archived
    ) {
    }

    public record AttributeOptionDto(UUID id, String value, String label, int sortOrder) {
    }

    public record AttributeDefinitionDto(
            UUID id,
            String code,
            String name,
            String dataType,
            boolean required,
            boolean filterable,
            boolean searchable,
            String unit,
            Map<String, Object> validationRules,
            List<AttributeOptionDto> options,
            Instant archivedAt,
            Instant updatedAt
    ) {
    }

    public record DeleteAttributeResponse(UUID id, boolean archived, Instant archivedAt) {
    }

    // ---- Categories ----

    public record CreateCategoryRequest(
            @NotBlank @Size(max = 160) String name,
            String slug,
            UUID parentId,
            String description,
            String seoDescription,
            String imageUrl,
            UUID defaultProductTypeId
    ) {
    }

    public record UpdateCategoryRequest(
            @Size(min = 1, max = 160) String name,
            String slug,
            UUID parentId,
            boolean clearParent,
            String description,
            String seoDescription,
            String imageUrl,
            UUID defaultProductTypeId
    ) {
    }

    public record CategoryDto(
            UUID id,
            UUID parentId,
            String slug,
            String name,
            String description,
            String seoDescription,
            String imageUrl,
            UUID defaultProductTypeId,
            long productCount,
            Instant updatedAt
    ) {
    }

    // ---- Collections ----

    public record UpsertCollectionRequest(
            @NotBlank @Size(max = 160) String name,
            String slug,
            String description,
            List<UUID> productIds
    ) {
    }

    public record CollectionDto(
            UUID id,
            String slug,
            String name,
            String description,
            List<UUID> productIds,
            Instant updatedAt
    ) {
    }

    // ---- Products & Variants ----

    public record VariantInput(
            UUID id,
            @NotBlank @Size(max = 128) String sku,
            @NotBlank @Size(max = 255) String title,
            @NotNull @DecimalMin("0.00") BigDecimal price,
            @DecimalMin("0.00") BigDecimal compareAtPrice,
            @Min(0) int stock,
            Map<String, String> options,
            String status
    ) {
    }

    public record ProductImageInput(UUID mediaAssetId, @NotBlank String url, String altText) {
    }

    public record CreateProductRequest(
            @NotNull UUID productTypeId,
            @NotBlank @Size(max = 255) String name,
            String slug,
            @Size(max = 120) String brand,
            String description,
            String status,
            String primaryImageUrl,
            @Valid List<ProductImageInput> images,
            String seoTitle,
            String seoDescription,
            List<UUID> categoryIds,
            Map<String, Object> attributes,
            @NotEmpty @Valid List<VariantInput> variants
    ) {
    }

    public record UpdateProductRequest(
            UUID productTypeId,
            Boolean confirmDropIncompatibleAttributes,
            @Size(min = 1, max = 255) String name,
            String slug,
            @Size(max = 120) String brand,
            String description,
            String status,
            String primaryImageUrl,
            @Valid List<ProductImageInput> images,
            String seoTitle,
            String seoDescription,
            List<UUID> categoryIds,
            Map<String, Object> attributes,
            Long expectedVersion
    ) {
    }

    public record UpdateVariantRequest(
            @Size(min = 1, max = 128) String sku,
            @Size(min = 1, max = 255) String title,
            @DecimalMin("0.00") BigDecimal price,
            @DecimalMin("0.00") BigDecimal compareAtPrice,
            String status,
            Map<String, String> options
    ) {
    }

    public record VariantDto(
            UUID id,
            String sku,
            String title,
            String status,
            BigDecimal price,
            BigDecimal compareAtPrice,
            String currency,
            int availableStock,
            Map<String, String> options,
            Long version
    ) {
    }

    public record ProductAttributeDto(
            UUID definitionId,
            String code,
            String name,
            String dataType,
            String unit,
            Object value,
            String displayValue,
            boolean filterable,
            boolean searchable
    ) {
    }

    public record ProductImageDto(UUID id, UUID mediaAssetId, String url, String altText, int sortOrder) {
    }

    public record CategoryRefDto(UUID id, String slug, String name) {
    }

    public record ProductDto(
            UUID id,
            UUID productTypeId,
            String productTypeName,
            String productTypeCode,
            String slug,
            String name,
            String brand,
            String description,
            String status,
            String primaryImageUrl,
            List<ProductImageDto> images,
            String seoTitle,
            String seoDescription,
            BigDecimal rating,
            int reviewCount,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            BigDecimal compareAtPrice,
            int totalStock,
            List<CategoryRefDto> categories,
            List<ProductAttributeDto> attributes,
            List<VariantDto> variants,
            Long version,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record FacetDto(
            String code,
            String name,
            String dataType,
            String unit,
            List<String> values
    ) {
    }

    public record StoreProductListResponse(
            List<ProductDto> items,
            int page,
            int size,
            long totalElements,
            int totalPages,
            List<FacetDto> facets
    ) {
    }
}
