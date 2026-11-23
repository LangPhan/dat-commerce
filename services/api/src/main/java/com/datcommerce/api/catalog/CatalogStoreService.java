package com.datcommerce.api.catalog;

import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CatalogStoreService {

    private final StoreRepository storeRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CatalogAdminService catalogAdminService;

    public CatalogStoreService(
            StoreRepository storeRepository,
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            CatalogAdminService catalogAdminService
    ) {
        this.storeRepository = storeRepository;
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.catalogAdminService = catalogAdminService;
    }

    public UUID defaultStoreId() {
        return storeRepository.findByCode("terrain-supply")
                .map(StoreEntity::getId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not initialized"));
    }

    @Transactional(readOnly = true)
    public CatalogDtos.StoreProductListResponse listProducts(
            String q,
            String categorySlugOrName,
            String brand,
            BigDecimal maxPrice,
            String sort,
            Map<String, String> allQueryParams,
            int page,
            int size
    ) {
        UUID storeId = defaultStoreId();
        List<ProductEntity> active = productRepository.findAllByStoreIdAndStatusOrderByCreatedAtDesc(storeId, "ACTIVE");
        List<CatalogDtos.ProductDto> assembled = catalogAdminService.assembleProducts(storeId, active);

        // 1. Category & brand pre-filter (used for computing facets)
        List<CatalogDtos.ProductDto> inScope = assembled.stream()
                .filter(p -> {
                    if (!StringUtils.hasText(categorySlugOrName)) return true;
                    String needle = categorySlugOrName.trim().toLowerCase(Locale.ROOT);
                    return p.categories().stream().anyMatch(c ->
                            c.slug().equalsIgnoreCase(needle) || c.name().equalsIgnoreCase(needle));
                })
                .filter(p -> !StringUtils.hasText(brand) || p.brand().equalsIgnoreCase(brand.trim()))
                .toList();

        List<CatalogDtos.FacetDto> facets = computeFacets(inScope);

        // 2. Dynamic attribute filters (`attr.<code>=<val>`)
        Map<String, String> attrFilters = new LinkedHashMap<>();
        if (allQueryParams != null) {
            allQueryParams.forEach((k, v) -> {
                if (k.startsWith("attr.") && StringUtils.hasText(v)) {
                    attrFilters.put(k.substring("attr.".length()).trim().toLowerCase(Locale.ROOT), v.trim().toLowerCase(Locale.ROOT));
                }
            });
        }

        List<CatalogDtos.ProductDto> filtered = inScope.stream()
                .filter(p -> maxPrice == null || p.minPrice().compareTo(maxPrice) <= 0)
                .filter(p -> {
                    if (!StringUtils.hasText(q)) return true;
                    String needle = q.trim().toLowerCase(Locale.ROOT);
                    String searchableAttrs = p.attributes().stream()
                            .filter(CatalogDtos.ProductAttributeDto::searchable)
                            .map(CatalogDtos.ProductAttributeDto::displayValue)
                            .reduce("", (a, b) -> a + " " + b);
                    String haystack = (p.name() + " " + p.brand() + " " + p.description() + " "
                            + p.categories().stream().map(CatalogDtos.CategoryRefDto::name).reduce("", (a, b) -> a + " " + b)
                            + " " + searchableAttrs).toLowerCase(Locale.ROOT);
                    return haystack.contains(needle);
                })
                .filter(p -> attrFilters.entrySet().stream().allMatch(f -> matchesAttribute(p, f.getKey(), f.getValue())))
                .toList();

        List<CatalogDtos.ProductDto> sorted = new ArrayList<>(filtered);
        String sortKey = sort == null ? "featured" : sort.trim().toLowerCase(Locale.ROOT);
        switch (sortKey) {
            case "low", "price_asc" -> sorted.sort(Comparator.comparing(CatalogDtos.ProductDto::minPrice));
            case "high", "price_desc" -> sorted.sort(Comparator.comparing(CatalogDtos.ProductDto::minPrice).reversed());
            case "rating" -> sorted.sort(Comparator.comparing(CatalogDtos.ProductDto::rating).reversed());
            case "newest" -> sorted.sort(Comparator.comparing(CatalogDtos.ProductDto::createdAt).reversed());
            default -> {
                // Keep default ordering
            }
        }

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        int from = Math.min(safePage * safeSize, sorted.size());
        int to = Math.min(from + safeSize, sorted.size());
        int totalPages = (int) Math.ceil((double) sorted.size() / safeSize);

        return new CatalogDtos.StoreProductListResponse(
                sorted.subList(from, to),
                safePage,
                safeSize,
                sorted.size(),
                totalPages,
                facets
        );
    }

    @Transactional(readOnly = true)
    public CatalogDtos.ProductDto getProductByIdOrSlug(String idOrSlug) {
        UUID storeId = defaultStoreId();
        ProductEntity entity = null;
        try {
            UUID id = UUID.fromString(idOrSlug);
            entity = productRepository.findByIdAndStoreId(id, storeId).orElse(null);
        } catch (IllegalArgumentException ignored) {
            // Fall back to slug lookup
        }
        if (entity == null) {
            entity = productRepository.findByStoreIdAndSlugIgnoreCase(storeId, idOrSlug)
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Product not found"));
        }
        return catalogAdminService.assembleProducts(storeId, List.of(entity)).getFirst();
    }

    @Transactional(readOnly = true)
    public List<CatalogDtos.CategoryDto> listCategories() {
        return catalogAdminService.listCategories(defaultStoreId());
    }

    @Transactional(readOnly = true)
    public List<CatalogDtos.CollectionDto> listCollections() {
        return catalogAdminService.listCollections(defaultStoreId());
    }

    private static boolean matchesAttribute(CatalogDtos.ProductDto p, String key, String expectedVal) {
        return p.attributes().stream().anyMatch(attr -> {
            if (!attr.code().equalsIgnoreCase(key) && !attr.name().equalsIgnoreCase(key)) {
                return false;
            }
            if (attr.value() instanceof List<?> list) {
                return list.stream().anyMatch(item -> String.valueOf(item).equalsIgnoreCase(expectedVal));
            }
            return attr.displayValue().equalsIgnoreCase(expectedVal)
                    || String.valueOf(attr.value()).equalsIgnoreCase(expectedVal);
        });
    }

    private static List<CatalogDtos.FacetDto> computeFacets(List<CatalogDtos.ProductDto> products) {
        Map<String, FacetAccumulator> map = new LinkedHashMap<>();
        for (CatalogDtos.ProductDto p : products) {
            for (CatalogDtos.ProductAttributeDto a : p.attributes()) {
                if (!a.filterable()) continue;
                FacetAccumulator acc = map.computeIfAbsent(
                        a.code(),
                        k -> new FacetAccumulator(a.code(), a.name(), a.dataType(), a.unit())
                );
                if (a.value() instanceof List<?> list) {
                    for (Object item : list) {
                        acc.values.add(String.valueOf(item));
                    }
                } else if (StringUtils.hasText(a.displayValue())) {
                    acc.values.add(a.displayValue());
                }
            }
        }
        return map.values().stream()
                .filter(f -> !f.values.isEmpty())
                .map(f -> new CatalogDtos.FacetDto(f.code, f.name, f.dataType, f.unit, new ArrayList<>(f.values)))
                .toList();
    }

    private static class FacetAccumulator {
        final String code;
        final String name;
        final String dataType;
        final String unit;
        final Set<String> values = new LinkedHashSet<>();

        FacetAccumulator(String code, String name, String dataType, String unit) {
            this.code = code;
            this.name = name;
            this.dataType = dataType;
            this.unit = unit;
        }
    }
}
