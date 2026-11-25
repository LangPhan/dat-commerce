package com.datcommerce.api.ai;

import com.datcommerce.api.catalog.CategoryEntity;
import com.datcommerce.api.catalog.CategoryRepository;
import com.datcommerce.api.catalog.CollectionEntity;
import com.datcommerce.api.catalog.CollectionProductRepository;
import com.datcommerce.api.catalog.CollectionRepository;
import com.datcommerce.api.catalog.ProductEntity;
import com.datcommerce.api.catalog.ProductImageEntity;
import com.datcommerce.api.catalog.ProductImageRepository;
import com.datcommerce.api.catalog.ProductRepository;
import com.datcommerce.api.catalog.VariantEntity;
import com.datcommerce.api.catalog.VariantRepository;
import com.datcommerce.api.media.MediaAssetEntity;
import com.datcommerce.api.media.MediaAssetRepository;
import com.datcommerce.api.pricing.PriceEntity;
import com.datcommerce.api.pricing.PriceRepository;
import com.datcommerce.api.promotion.PromotionEntity;
import com.datcommerce.api.promotion.PromotionRepository;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class EditorDesignDataService {

    public static final Set<String> DESIGN_TOOL_NAMES = Set.of(
            "design.list_collections",
            "design.list_categories",
            "design.search_products",
            "design.list_promotions",
            "design.list_media_images"
    );

    private final StoreRepository storeRepository;
    private final CollectionRepository collectionRepository;
    private final CollectionProductRepository collectionProductRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final VariantRepository variantRepository;
    private final PriceRepository priceRepository;
    private final PromotionRepository promotionRepository;
    private final MediaAssetRepository mediaAssetRepository;

    public EditorDesignDataService(
            StoreRepository storeRepository,
            CollectionRepository collectionRepository,
            CollectionProductRepository collectionProductRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            ProductImageRepository productImageRepository,
            VariantRepository variantRepository,
            PriceRepository priceRepository,
            PromotionRepository promotionRepository,
            MediaAssetRepository mediaAssetRepository
    ) {
        this.storeRepository = storeRepository;
        this.collectionRepository = collectionRepository;
        this.collectionProductRepository = collectionProductRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
        this.variantRepository = variantRepository;
        this.priceRepository = priceRepository;
        this.promotionRepository = promotionRepository;
        this.mediaAssetRepository = mediaAssetRepository;
    }

    public List<AiModelGateway.ToolDefinition> designToolDefinitions() {
        return List.of(
                new AiModelGateway.ToolDefinition(
                        "design.list_collections",
                        "Read-only: list all store collections with slugs, descriptions, product counts, cover images, and optional sample products for building collection showcase designs.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "includeProducts", Map.of("type", "boolean", "description", "Include up to 4 sample products per collection")
                                )
                        )
                ),
                new AiModelGateway.ToolDefinition(
                        "design.list_categories",
                        "Read-only: list all store categories with slugs, descriptions, image URLs, and product counts.",
                        Map.of("type", "object", "properties", Map.of())
                ),
                new AiModelGateway.ToolDefinition(
                        "design.search_products",
                        "Read-only: search published store products by text query, categorySlug, or collectionSlug to obtain real titles, slugs, prices, and image URLs.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "query", Map.of("type", "string", "description", "Optional keyword match on product name or brand"),
                                        "categorySlug", Map.of("type", "string", "description", "Optional category slug filter"),
                                        "collectionSlug", Map.of("type", "string", "description", "Optional collection slug filter"),
                                        "limit", Map.of("type", "integer", "description", "Max products to return (1-20, default 8)")
                                )
                        )
                ),
                new AiModelGateway.ToolDefinition(
                        "design.list_promotions",
                        "Read-only: list store discounts and promotions with real promo codes, discount values, types, and expiry timestamps.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "status", Map.of("type", "string", "description", "Optional status filter: ACTIVE, SCHEDULED, or ALL")
                                )
                        )
                ),
                new AiModelGateway.ToolDefinition(
                        "design.list_media_images",
                        "Read-only: list uploaded store media images (URL, altText, filename) that can be used as hero banners, card backgrounds, or galleries.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "query", Map.of("type", "string", "description", "Optional keyword filter on filename or alt text"),
                                        "limit", Map.of("type", "integer", "description", "Max images to return (1-24, default 12)")
                                )
                        )
                )
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> buildCompactStoreManifest(UUID storeId) {
        if (storeId == null) {
            return Map.of();
        }
        String currency = "USD";
        String storeName = "Dat Commerce";
        Optional<StoreEntity> storeOpt = storeRepository.findById(storeId);
        if (storeOpt.isPresent()) {
            StoreEntity st = storeOpt.get();
            if (StringUtils.hasText(st.getName())) storeName = st.getName();
            if (StringUtils.hasText(st.getDefaultCurrency())) currency = st.getDefaultCurrency();
        }

        List<ProductEntity> activeProducts = productRepository.findAllByStoreIdAndStatusOrderByCreatedAtDesc(storeId, "ACTIVE");
        if (activeProducts.isEmpty()) {
            activeProducts = productRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
        }
        Map<UUID, ProductEntity> productById = new LinkedHashMap<>();
        Map<UUID, Integer> categoryCounts = new HashMap<>();
        for (ProductEntity p : activeProducts) {
            productById.put(p.getId(), p);
            if (p.getCategories() != null) {
                for (CategoryEntity cat : p.getCategories()) {
                    categoryCounts.merge(cat.getId(), 1, Integer::sum);
                }
            }
        }

        List<CollectionEntity> collections = collectionRepository.findAllByStoreIdOrderByNameAsc(storeId);
        Map<UUID, List<UUID>> collectionProductIds = loadCollectionProductMap(collections);
        List<Map<String, Object>> collectionSummaries = new ArrayList<>();
        for (CollectionEntity c : collections.stream().limit(24).toList()) {
            List<UUID> pids = collectionProductIds.getOrDefault(c.getId(), List.of());
            String cover = null;
            for (UUID pid : pids) {
                ProductEntity p = productById.get(pid);
                if (p != null && StringUtils.hasText(p.getPrimaryImageUrl())) {
                    cover = p.getPrimaryImageUrl();
                    break;
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", c.getName());
            row.put("slug", c.getSlug());
            if (StringUtils.hasText(c.getDescription())) row.put("description", clip(c.getDescription(), 140));
            row.put("productCount", pids.size());
            if (cover != null) row.put("coverImage", cover);
            collectionSummaries.add(row);
        }

        List<CategoryEntity> categories = categoryRepository.findAllByStoreIdOrderByNameAsc(storeId);
        List<Map<String, Object>> categorySummaries = new ArrayList<>();
        for (CategoryEntity cat : categories.stream().limit(24).toList()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", cat.getName());
            row.put("slug", cat.getSlug());
            row.put("productCount", categoryCounts.getOrDefault(cat.getId(), 0));
            if (StringUtils.hasText(cat.getImageUrl())) row.put("imageUrl", cat.getImageUrl());
            if (StringUtils.hasText(cat.getDescription())) row.put("description", clip(cat.getDescription(), 120));
            categorySummaries.add(row);
        }

        List<PromotionEntity> promotions = promotionRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
        Instant now = Instant.now();
        List<Map<String, Object>> promoSummaries = new ArrayList<>();
        for (PromotionEntity pr : promotions) {
            if (!"ACTIVE".equalsIgnoreCase(pr.getStatus()) && !"SCHEDULED".equalsIgnoreCase(pr.getStatus())) {
                continue;
            }
            if (pr.getEndsAt() != null && pr.getEndsAt().isBefore(now)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", pr.getCode());
            row.put("name", pr.getName());
            row.put("type", pr.getType());
            row.put("value", pr.getValue());
            row.put("scopeType", pr.getScopeType());
            row.put("status", pr.getStatus());
            if (pr.getEndsAt() != null) row.put("endsAt", pr.getEndsAt().toString());
            promoSummaries.add(row);
            if (promoSummaries.size() >= 10) break;
        }

        List<MediaAssetEntity> mediaAssets = mediaAssetRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
        List<Map<String, Object>> mediaSummaries = new ArrayList<>();
        for (MediaAssetEntity m : mediaAssets) {
            if (m.getMimeType() == null || !m.getMimeType().toLowerCase(Locale.ROOT).startsWith("image/")) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("url", m.getUrl());
            row.put("filename", m.getOriginalFilename());
            if (StringUtils.hasText(m.getAltText())) row.put("altText", clip(m.getAltText(), 100));
            mediaSummaries.add(row);
            if (mediaSummaries.size() >= 12) break;
        }

        List<ProductEntity> sampleProducts = activeProducts.stream().limit(10).toList();
        Map<UUID, PriceInfo> prices = loadLeadPrices(sampleProducts, currency);
        List<Map<String, Object>> productSummaries = new ArrayList<>();
        for (ProductEntity p : sampleProducts) {
            productSummaries.add(toProductRow(p, prices.get(p.getId()), currency));
        }

        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("store", Map.of("name", storeName, "currency", currency));
        manifest.put("counts", Map.of(
                "collections", collections.size(),
                "categories", categories.size(),
                "products", activeProducts.size(),
                "activePromotions", promoSummaries.size(),
                "mediaImages", mediaSummaries.size()
        ));
        manifest.put("collections", collectionSummaries);
        manifest.put("categories", categorySummaries);
        manifest.put("promotions", promoSummaries);
        manifest.put("mediaImages", mediaSummaries);
        manifest.put("sampleProducts", productSummaries);
        return manifest;
    }

    @Transactional(readOnly = true)
    public DesignToolExecutionResult executeDesignTool(
            UUID storeId,
            String toolName,
            Map<String, Object> args
    ) {
        Map<String, Object> safeArgs = args != null ? args : Map.of();
        String currency = storeRepository.findById(storeId)
                .map(StoreEntity::getDefaultCurrency)
                .filter(StringUtils::hasText)
                .orElse("USD");

        return switch (toolName) {
            case "design.list_collections" -> {
                boolean includeProducts = Boolean.TRUE.equals(safeArgs.get("includeProducts"));
                List<CollectionEntity> collections = collectionRepository.findAllByStoreIdOrderByNameAsc(storeId);
                Map<UUID, List<UUID>> colProdMap = loadCollectionProductMap(collections);
                List<ProductEntity> allProducts = productRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
                Map<UUID, ProductEntity> prodById = allProducts.stream()
                        .collect(Collectors.toMap(ProductEntity::getId, p -> p, (a, b) -> a));
                Map<UUID, PriceInfo> prices = includeProducts ? loadLeadPrices(allProducts, currency) : Map.of();

                List<Map<String, Object>> rows = new ArrayList<>();
                for (CollectionEntity c : collections) {
                    List<UUID> pids = colProdMap.getOrDefault(c.getId(), List.of());
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", c.getName());
                    row.put("slug", c.getSlug());
                    row.put("description", c.getDescription() != null ? c.getDescription() : "");
                    row.put("productCount", pids.size());
                    String cover = null;
                    List<Map<String, Object>> samples = new ArrayList<>();
                    for (UUID pid : pids) {
                        ProductEntity p = prodById.get(pid);
                        if (p == null) continue;
                        if (cover == null && StringUtils.hasText(p.getPrimaryImageUrl())) {
                            cover = p.getPrimaryImageUrl();
                        }
                        if (includeProducts && samples.size() < 4) {
                            samples.add(toProductRow(p, prices.get(p.getId()), currency));
                        }
                    }
                    if (cover != null) row.put("coverImage", cover);
                    if (includeProducts) row.put("sampleProducts", samples);
                    rows.add(row);
                }
                yield new DesignToolExecutionResult("collections", Map.of("count", rows.size(), "collections", rows));
            }
            case "design.list_categories" -> {
                List<CategoryEntity> categories = categoryRepository.findAllByStoreIdOrderByNameAsc(storeId);
                List<ProductEntity> products = productRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
                Map<UUID, Integer> counts = new HashMap<>();
                for (ProductEntity p : products) {
                    if (p.getCategories() != null) {
                        for (CategoryEntity c : p.getCategories()) {
                            counts.merge(c.getId(), 1, Integer::sum);
                        }
                    }
                }
                List<Map<String, Object>> rows = new ArrayList<>();
                for (CategoryEntity c : categories) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", c.getName());
                    row.put("slug", c.getSlug());
                    row.put("description", c.getDescription() != null ? c.getDescription() : "");
                    row.put("imageUrl", c.getImageUrl() != null ? c.getImageUrl() : "");
                    row.put("productCount", counts.getOrDefault(c.getId(), 0));
                    rows.add(row);
                }
                yield new DesignToolExecutionResult("categories", Map.of("count", rows.size(), "categories", rows));
            }
            case "design.search_products" -> {
                String query = str(safeArgs.get("query")).toLowerCase(Locale.ROOT);
                String catSlug = str(safeArgs.get("categorySlug")).toLowerCase(Locale.ROOT);
                String colSlug = str(safeArgs.get("collectionSlug")).toLowerCase(Locale.ROOT);
                int limit = clampInt(safeArgs.get("limit"), 8, 1, 20);

                Set<UUID> allowedCollectionProductIds = null;
                if (StringUtils.hasText(colSlug)) {
                    Optional<CollectionEntity> colOpt = collectionRepository.findByStoreIdAndSlugIgnoreCase(storeId, colSlug);
                    if (colOpt.isPresent()) {
                        allowedCollectionProductIds = collectionProductRepository
                                .findAllByIdCollectionIdInOrderBySortOrderAsc(List.of(colOpt.get().getId()))
                                .stream()
                                .map(cp -> cp.getId().getProductId())
                                .collect(Collectors.toSet());
                    } else {
                        allowedCollectionProductIds = Set.of();
                    }
                }

                List<ProductEntity> all = productRepository.findAllByStoreIdAndStatusOrderByCreatedAtDesc(storeId, "ACTIVE");
                if (all.isEmpty()) all = productRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);

                List<ProductEntity> filtered = new ArrayList<>();
                for (ProductEntity p : all) {
                    if (allowedCollectionProductIds != null && !allowedCollectionProductIds.contains(p.getId())) {
                        continue;
                    }
                    if (StringUtils.hasText(catSlug)) {
                        boolean matchCat = p.getCategories() != null && p.getCategories().stream()
                                .anyMatch(c -> catSlug.equalsIgnoreCase(c.getSlug()));
                        if (!matchCat) continue;
                    }
                    if (StringUtils.hasText(query)) {
                        String hay = (str(p.getName()) + " " + str(p.getBrand()) + " " + str(p.getSlug())).toLowerCase(Locale.ROOT);
                        if (!hay.contains(query)) continue;
                    }
                    filtered.add(p);
                    if (filtered.size() >= limit) break;
                }

                Map<UUID, PriceInfo> prices = loadLeadPrices(filtered, currency);
                Map<UUID, List<String>> gallery = loadProductGalleryUrls(filtered);
                List<Map<String, Object>> rows = new ArrayList<>();
                for (ProductEntity p : filtered) {
                    Map<String, Object> row = toProductRow(p, prices.get(p.getId()), currency);
                    List<String> imgs = gallery.getOrDefault(p.getId(), List.of());
                    if (!imgs.isEmpty()) row.put("images", imgs);
                    rows.add(row);
                }
                yield new DesignToolExecutionResult("products", Map.of("count", rows.size(), "products", rows));
            }
            case "design.list_promotions" -> {
                String statusFilter = str(safeArgs.get("status")).toUpperCase(Locale.ROOT);
                List<PromotionEntity> promos = promotionRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
                List<Map<String, Object>> rows = new ArrayList<>();
                for (PromotionEntity pr : promos) {
                    if (StringUtils.hasText(statusFilter) && !"ALL".equals(statusFilter)
                            && !statusFilter.equalsIgnoreCase(pr.getStatus())) {
                        continue;
                    }
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("code", pr.getCode());
                    row.put("name", pr.getName());
                    row.put("type", pr.getType());
                    row.put("value", pr.getValue());
                    row.put("scopeType", pr.getScopeType());
                    row.put("status", pr.getStatus());
                    if (pr.getStartsAt() != null) row.put("startsAt", pr.getStartsAt().toString());
                    if (pr.getEndsAt() != null) row.put("endsAt", pr.getEndsAt().toString());
                    rows.add(row);
                    if (rows.size() >= 20) break;
                }
                yield new DesignToolExecutionResult("promotions", Map.of("count", rows.size(), "promotions", rows));
            }
            case "design.list_media_images" -> {
                String query = str(safeArgs.get("query")).toLowerCase(Locale.ROOT);
                int limit = clampInt(safeArgs.get("limit"), 12, 1, 24);
                List<MediaAssetEntity> assets = mediaAssetRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
                List<Map<String, Object>> rows = new ArrayList<>();
                for (MediaAssetEntity m : assets) {
                    if (m.getMimeType() == null || !m.getMimeType().toLowerCase(Locale.ROOT).startsWith("image/")) {
                        continue;
                    }
                    if (StringUtils.hasText(query)) {
                        String hay = (str(m.getOriginalFilename()) + " " + str(m.getAltText())).toLowerCase(Locale.ROOT);
                        if (!hay.contains(query)) continue;
                    }
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("url", m.getUrl());
                    row.put("filename", m.getOriginalFilename());
                    row.put("altText", m.getAltText() != null ? m.getAltText() : "");
                    if (m.getWidth() != null) row.put("width", m.getWidth());
                    if (m.getHeight() != null) row.put("height", m.getHeight());
                    rows.add(row);
                    if (rows.size() >= limit) break;
                }
                yield new DesignToolExecutionResult("media", Map.of("count", rows.size(), "images", rows));
            }
            default -> new DesignToolExecutionResult("unknown", Map.of("error", "Unsupported design tool: " + toolName));
        };
    }

    private Map<UUID, List<UUID>> loadCollectionProductMap(List<CollectionEntity> collections) {
        if (collections == null || collections.isEmpty()) return Map.of();
        List<UUID> ids = collections.stream().map(CollectionEntity::getId).toList();
        List<CollectionEntity.CollectionProductEntity> links =
                collectionProductRepository.findAllByIdCollectionIdInOrderBySortOrderAsc(ids);
        Map<UUID, List<UUID>> out = new HashMap<>();
        for (CollectionEntity.CollectionProductEntity link : links) {
            if (link.getId() != null) {
                out.computeIfAbsent(link.getId().getCollectionId(), k -> new ArrayList<>())
                        .add(link.getId().getProductId());
            }
        }
        return out;
    }

    private Map<UUID, PriceInfo> loadLeadPrices(Collection<ProductEntity> products, String currency) {
        if (products == null || products.isEmpty()) return Map.of();
        List<UUID> productIds = products.stream().map(ProductEntity::getId).toList();
        List<VariantEntity> variants = variantRepository.findAllByProductIdInOrderByCreatedAtAsc(productIds);
        if (variants.isEmpty()) return Map.of();

        List<UUID> variantIds = variants.stream().map(VariantEntity::getId).toList();
        Map<UUID, PriceEntity> priceByVariant = priceRepository.findAllByVariantIdInAndCurrency(variantIds, currency)
                .stream()
                .collect(Collectors.toMap(PriceEntity::getVariantId, p -> p, (a, b) -> a));

        Map<UUID, PriceInfo> byProduct = new HashMap<>();
        for (VariantEntity v : variants) {
            if (byProduct.containsKey(v.getProductId())) continue;
            PriceEntity pe = priceByVariant.get(v.getId());
            if (pe != null && pe.getAmount() != null) {
                byProduct.put(v.getProductId(), new PriceInfo(pe.getAmount(), pe.getCompareAtAmount()));
            }
        }
        return byProduct;
    }

    private Map<UUID, List<String>> loadProductGalleryUrls(Collection<ProductEntity> products) {
        if (products == null || products.isEmpty()) return Map.of();
        List<UUID> pids = products.stream().map(ProductEntity::getId).toList();
        List<ProductImageEntity> imgs = productImageRepository.findAllByProductIdInOrderBySortOrderAsc(pids);
        Map<UUID, List<String>> out = new HashMap<>();
        for (ProductImageEntity img : imgs) {
            if (StringUtils.hasText(img.getUrl())) {
                List<String> list = out.computeIfAbsent(img.getProductId(), k -> new ArrayList<>());
                if (list.size() < 4) list.add(img.getUrl());
            }
        }
        return out;
    }

    private static Map<String, Object> toProductRow(ProductEntity p, PriceInfo price, String currency) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", p.getName());
        row.put("slug", p.getSlug());
        if (StringUtils.hasText(p.getBrand())) row.put("brand", p.getBrand());
        if (StringUtils.hasText(p.getPrimaryImageUrl())) row.put("imageUrl", p.getPrimaryImageUrl());
        if (price != null) {
            row.put("price", price.amount());
            row.put("currency", currency);
            if (price.compareAt() != null) row.put("compareAtPrice", price.compareAt());
        }
        if (p.getCategories() != null && !p.getCategories().isEmpty()) {
            row.put("categories", p.getCategories().stream().map(CategoryEntity::getSlug).sorted().toList());
        } else {
            row.put("categories", Collections.emptyList());
        }
        return row;
    }

    private static String clip(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max - 1) + "…";
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int clampInt(Object raw, int def, int min, int max) {
        if (raw instanceof Number n) {
            return Math.max(min, Math.min(max, n.intValue()));
        }
        if (raw instanceof String s) {
            try {
                return Math.max(min, Math.min(max, Integer.parseInt(s.trim())));
            } catch (NumberFormatException ignored) {
                return def;
            }
        }
        return def;
    }

    private record PriceInfo(BigDecimal amount, BigDecimal compareAt) {
    }

    public record DesignToolExecutionResult(String dataSource, Map<String, Object> payload) {
    }
}
