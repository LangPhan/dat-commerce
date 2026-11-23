package com.datcommerce.api.catalog;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class CatalogAdminController {

    private final CatalogAdminService catalogAdminService;

    public CatalogAdminController(CatalogAdminService catalogAdminService) {
        this.catalogAdminService = catalogAdminService;
    }

    // ---- Product Types ----

    @GetMapping("/product-types")
    @PreAuthorize("hasAuthority('catalog:read')")
    public List<CatalogDtos.ProductTypeDto> listProductTypes(@AuthenticationPrincipal AuthenticatedUser user) {
        return catalogAdminService.listProductTypes(user.storeId());
    }

    @GetMapping("/product-types/{typeId}")
    @PreAuthorize("hasAuthority('catalog:read')")
    public CatalogDtos.ProductTypeDto getProductType(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID typeId
    ) {
        return catalogAdminService.getProductType(user.storeId(), typeId);
    }

    @PostMapping("/product-types")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.ProductTypeDto createProductType(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CatalogDtos.CreateProductTypeRequest request
    ) {
        return catalogAdminService.createProductType(user, request);
    }

    @PatchMapping("/product-types/{typeId}")
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.ProductTypeDto updateProductType(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID typeId,
            @Valid @RequestBody CatalogDtos.UpdateProductTypeRequest request
    ) {
        return catalogAdminService.updateProductType(user, typeId, request);
    }

    @PostMapping("/product-types/{typeId}/attributes")
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.ProductTypeDto bindAttribute(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID typeId,
            @Valid @RequestBody CatalogDtos.TypeAttributeBindingRequest request
    ) {
        return catalogAdminService.bindAttributeToProductType(user, typeId, request);
    }

    // ---- Attributes ----

    @GetMapping("/attributes")
    @PreAuthorize("hasAuthority('catalog:read')")
    public List<CatalogDtos.AttributeDefinitionDto> listAttributes(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return catalogAdminService.listAttributes(user.storeId(), includeArchived);
    }

    @PostMapping("/attributes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.AttributeDefinitionDto createAttribute(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CatalogDtos.CreateAttributeRequest request
    ) {
        return catalogAdminService.createAttribute(user, request);
    }

    @PatchMapping("/attributes/{attributeId}")
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.AttributeDefinitionDto updateAttribute(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID attributeId,
            @Valid @RequestBody CatalogDtos.UpdateAttributeRequest request
    ) {
        return catalogAdminService.updateAttribute(user, attributeId, request);
    }

    @DeleteMapping("/attributes/{attributeId}")
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.DeleteAttributeResponse deleteAttribute(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID attributeId
    ) {
        return catalogAdminService.deleteOrArchiveAttribute(user, attributeId);
    }

    // ---- Categories ----

    @GetMapping("/categories")
    @PreAuthorize("hasAuthority('catalog:read')")
    public List<CatalogDtos.CategoryDto> listCategories(@AuthenticationPrincipal AuthenticatedUser user) {
        return catalogAdminService.listCategories(user.storeId());
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.CategoryDto createCategory(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CatalogDtos.CreateCategoryRequest request
    ) {
        return catalogAdminService.createCategory(user, request);
    }

    @PatchMapping("/categories/{categoryId}")
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.CategoryDto updateCategory(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID categoryId,
            @Valid @RequestBody CatalogDtos.UpdateCategoryRequest request
    ) {
        return catalogAdminService.updateCategory(user, categoryId, request);
    }

    @DeleteMapping("/categories/{categoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog:write')")
    public void deleteCategory(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID categoryId
    ) {
        catalogAdminService.deleteCategory(user, categoryId);
    }

    // ---- Collections ----

    @GetMapping("/collections")
    @PreAuthorize("hasAuthority('catalog:read')")
    public List<CatalogDtos.CollectionDto> listCollections(@AuthenticationPrincipal AuthenticatedUser user) {
        return catalogAdminService.listCollections(user.storeId());
    }

    @PostMapping("/collections")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.CollectionDto createCollection(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CatalogDtos.UpsertCollectionRequest request
    ) {
        return catalogAdminService.createCollection(user, request);
    }

    @PatchMapping("/collections/{collectionId}")
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.CollectionDto updateCollection(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID collectionId,
            @Valid @RequestBody CatalogDtos.UpsertCollectionRequest request
    ) {
        return catalogAdminService.updateCollection(user, collectionId, request);
    }

    @DeleteMapping("/collections/{collectionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog:write')")
    public void deleteCollection(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID collectionId
    ) {
        catalogAdminService.deleteCollection(user, collectionId);
    }

    // ---- Products & Variants ----

    @GetMapping("/products")
    @PreAuthorize("hasAuthority('catalog:read')")
    public List<CatalogDtos.ProductDto> listProducts(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) String status
    ) {
        return catalogAdminService.listProducts(user.storeId(), q, categoryId, status);
    }

    @GetMapping("/products/{productId}")
    @PreAuthorize("hasAuthority('catalog:read')")
    public CatalogDtos.ProductDto getProduct(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID productId
    ) {
        return catalogAdminService.getProduct(user.storeId(), productId);
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.ProductDto createProduct(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CatalogDtos.CreateProductRequest request
    ) {
        return catalogAdminService.createProduct(user, request);
    }

    @PatchMapping("/products/{productId}")
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.ProductDto updateProduct(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID productId,
            @Valid @RequestBody CatalogDtos.UpdateProductRequest request
    ) {
        return catalogAdminService.updateProduct(user, productId, request);
    }

    @DeleteMapping("/products/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog:write')")
    public void deleteProduct(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID productId
    ) {
        catalogAdminService.deleteProduct(user, productId);
    }

    @PostMapping("/products/{productId}/variants")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog:write')")
    public CatalogDtos.VariantDto addVariant(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID productId,
            @Valid @RequestBody CatalogDtos.VariantInput request
    ) {
        return catalogAdminService.addVariant(user, productId, request);
    }

    @PatchMapping("/variants/{variantId}")
    @PreAuthorize("hasAnyAuthority('catalog:write', 'pricing:write')")
    public CatalogDtos.VariantDto updateVariant(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID variantId,
            @Valid @RequestBody CatalogDtos.UpdateVariantRequest request
    ) {
        return catalogAdminService.updateVariant(user, variantId, request);
    }
}
