package com.datcommerce.api.catalog;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/store")
public class CatalogStoreController {

    private final CatalogStoreService catalogStoreService;

    public CatalogStoreController(CatalogStoreService catalogStoreService) {
        this.catalogStoreService = catalogStoreService;
    }

    @GetMapping("/products")
    public CatalogDtos.StoreProductListResponse listProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "featured") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size,
            @RequestParam Map<String, String> allQueryParams
    ) {
        return catalogStoreService.listProducts(q, category, brand, maxPrice, sort, allQueryParams, page, size);
    }

    @GetMapping("/products/{idOrSlug}")
    public CatalogDtos.ProductDto getProduct(@PathVariable String idOrSlug) {
        return catalogStoreService.getProductByIdOrSlug(idOrSlug);
    }

    @GetMapping("/categories")
    public List<CatalogDtos.CategoryDto> listCategories() {
        return catalogStoreService.listCategories();
    }

    @GetMapping("/collections")
    public List<CatalogDtos.CollectionDto> listCollections() {
        return catalogStoreService.listCollections();
    }
}
