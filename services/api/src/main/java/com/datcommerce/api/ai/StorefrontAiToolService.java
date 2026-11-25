package com.datcommerce.api.ai;

import com.datcommerce.api.cart.CartService;
import com.datcommerce.api.catalog.CatalogDtos;
import com.datcommerce.api.catalog.CatalogStoreService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.promotion.PromotionEntity;
import com.datcommerce.api.promotion.PromotionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class StorefrontAiToolService {

    public static final Set<String> ALLOWED_TOOL_NAMES = Set.of(
            "shop.search_products",
            "shop.get_product_details",
            "shop.list_categories_and_collections",
            "shop.list_active_promotions",
            "shop.add_to_cart",
            "shop.prefill_checkout"
    );

    private final CatalogStoreService catalogStoreService;
    private final CartService cartService;
    private final PromotionRepository promotionRepository;
    private final ObjectMapper objectMapper;

    public StorefrontAiToolService(
            CatalogStoreService catalogStoreService,
            CartService cartService,
            PromotionRepository promotionRepository,
            ObjectMapper objectMapper
    ) {
        this.catalogStoreService = catalogStoreService;
        this.cartService = cartService;
        this.promotionRepository = promotionRepository;
        this.objectMapper = objectMapper;
    }

    public static final class TurnSideEffects {
        private String sessionToken;
        private final Map<UUID, AiDtos.StorefrontProductRecommendationDto> recommendations = new LinkedHashMap<>();
        private CartService.CartResponse updatedCart;
        private AiDtos.CheckoutPrefillDto checkoutPrefill;

        public TurnSideEffects(String initialSessionToken) {
            this.sessionToken = initialSessionToken;
        }

        public String sessionToken() {
            return sessionToken;
        }

        public List<AiDtos.StorefrontProductRecommendationDto> recommendedProducts() {
            return List.copyOf(recommendations.values());
        }

        public CartService.CartResponse updatedCart() {
            return updatedCart;
        }

        public AiDtos.CheckoutPrefillDto checkoutPrefill() {
            return checkoutPrefill;
        }

        private void addRecommendation(AiDtos.StorefrontProductRecommendationDto dto) {
            if (dto != null && dto.productId() != null && recommendations.size() < 6) {
                recommendations.putIfAbsent(dto.productId(), dto);
            }
        }
    }

    public List<AiModelGateway.ToolDefinition> toolDefinitions() {
        return List.of(
                new AiModelGateway.ToolDefinition(
                        "shop.search_products",
                        "Search live storefront products by keyword, category, brand, max price, and sort order.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "q", Map.of("type", "string", "description", "Keyword search across names, brands, specs"),
                                        "category", Map.of("type", "string", "description", "Category slug or name"),
                                        "brand", Map.of("type", "string", "description", "Exact brand name"),
                                        "maxPrice", Map.of("type", "number", "description", "Maximum price"),
                                        "sort", Map.of("type", "string", "enum", List.of("featured", "price_asc", "price_desc", "rating", "newest")),
                                        "limit", Map.of("type", "integer", "minimum", 1, "maximum", 8)
                                )
                        )
                ),
                new AiModelGateway.ToolDefinition(
                        "shop.get_product_details",
                        "Fetch product description, specs, variants, pricing, and stock by slug, ID, or query.",
                        Map.of(
                                "type", "object",
                                "required", List.of("slugOrQuery"),
                                "properties", Map.of(
                                        "slugOrQuery", Map.of("type", "string")
                                )
                        )
                ),
                new AiModelGateway.ToolDefinition(
                        "shop.list_categories_and_collections",
                        "List all product categories and collections.",
                        Map.of("type", "object", "properties", Map.of())
                ),
                new AiModelGateway.ToolDefinition(
                        "shop.list_active_promotions",
                        "List active discount codes and promotions.",
                        Map.of("type", "object", "properties", Map.of())
                ),
                new AiModelGateway.ToolDefinition(
                        "shop.add_to_cart",
                        "Add a product variant (or default in-stock variant of productSlug) to the customer's cart.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "variantId", Map.of("type", "string"),
                                        "productSlug", Map.of("type", "string"),
                                        "sku", Map.of("type", "string"),
                                        "quantity", Map.of("type", "integer", "minimum", 1, "maximum", 20, "default", 1)
                                )
                        )
                ),
                new AiModelGateway.ToolDefinition(
                        "shop.prefill_checkout",
                        "Prefill shipping address, contact details, shipping method, and promotion code into checkout for user review. NEVER places an order.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "customerName", Map.of("type", "string"),
                                        "customerEmail", Map.of("type", "string"),
                                        "line1", Map.of("type", "string"),
                                        "city", Map.of("type", "string"),
                                        "state", Map.of("type", "string"),
                                        "postalCode", Map.of("type", "string"),
                                        "shippingMethod", Map.of("type", "string", "enum", List.of("standard", "express")),
                                        "promotionCode", Map.of("type", "string"),
                                        "note", Map.of("type", "string")
                                )
                        )
                )
        );
    }

    public String executeTool(
            UUID storeId,
            AuthenticatedUser actor,
            String toolName,
            Map<String, Object> arguments,
            TurnSideEffects sideEffects
    ) {
        Map<String, Object> args = arguments != null ? arguments : Map.of();
        try {
            Object payload = switch (toolName) {
                case "shop.search_products" -> handleSearchProducts(args, sideEffects);
                case "shop.get_product_details" -> handleGetProductDetails(args, sideEffects);
                case "shop.list_categories_and_collections" -> handleListCategoriesAndCollections();
                case "shop.list_active_promotions" -> handleListActivePromotions(storeId);
                case "shop.add_to_cart" -> handleAddToCart(args, sideEffects);
                case "shop.prefill_checkout" -> handlePrefillCheckout(actor, args, sideEffects);
                default -> Map.of("error", "Unknown or unsupported storefront tool: " + toolName);
            };
            return objectMapper.writeValueAsString(payload);
        } catch (ApiException ex) {
            return safeErrorJson(ex.getMessage());
        } catch (Exception ex) {
            return safeErrorJson("Tool execution failed: " + ex.getMessage());
        }
    }

    private Map<String, Object> handleSearchProducts(Map<String, Object> args, TurnSideEffects sideEffects) {
        String q = str(args.get("q"));
        String category = str(args.get("category"));
        String brand = str(args.get("brand"));
        BigDecimal maxPrice = toBigDecimal(args.get("maxPrice"));
        String sort = str(args.get("sort"));
        int limit = clampInt(args.get("limit"), 5, 1, 8);

        CatalogDtos.StoreProductListResponse res = catalogStoreService.listProducts(
                q, category, brand, maxPrice, StringUtils.hasText(sort) ? sort : "featured", Map.of(), 0, limit
        );
        List<Map<String, Object>> summarized = new ArrayList<>();
        for (CatalogDtos.ProductDto p : res.items()) {
            AiDtos.StorefrontProductRecommendationDto rec = toRecommendation(p);
            if (rec != null) {
                sideEffects.addRecommendation(rec);
            }
            summarized.add(summarizeProduct(p, false));
        }
        return Map.of("totalMatches", res.totalElements(), "products", summarized);
    }

    private Map<String, Object> handleGetProductDetails(Map<String, Object> args, TurnSideEffects sideEffects) {
        String slugOrQuery = str(args.get("slugOrQuery"));
        if (!StringUtils.hasText(slugOrQuery)) {
            return Map.of("error", "slugOrQuery is required");
        }
        CatalogDtos.ProductDto product = resolveProduct(slugOrQuery);
        if (product == null) {
            return Map.of("found", false, "query", slugOrQuery);
        }
        AiDtos.StorefrontProductRecommendationDto rec = toRecommendation(product);
        if (rec != null) {
            sideEffects.addRecommendation(rec);
        }
        return Map.of("found", true, "product", summarizeProduct(product, true));
    }

    private Map<String, Object> handleListCategoriesAndCollections() {
        List<Map<String, Object>> categories = catalogStoreService.listCategories().stream()
                .map(c -> Map.<String, Object>of(
                        "slug", c.slug(),
                        "name", c.name(),
                        "productCount", c.productCount()
                ))
                .toList();
        List<Map<String, Object>> collections = catalogStoreService.listCollections().stream()
                .map(c -> Map.<String, Object>of(
                        "slug", c.slug(),
                        "name", c.name(),
                        "description", c.description() != null ? c.description() : "",
                        "productCount", c.productIds() != null ? c.productIds().size() : 0
                ))
                .toList();
        return Map.of("categories", categories, "collections", collections);
    }

    private Map<String, Object> handleListActivePromotions(UUID storeId) {
        Instant now = Instant.now();
        List<Map<String, Object>> active = new ArrayList<>();
        for (PromotionEntity pr : promotionRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId)) {
            if (!"ACTIVE".equalsIgnoreCase(pr.getStatus())) continue;
            if (pr.getStartsAt() != null && now.isBefore(pr.getStartsAt())) continue;
            if (pr.getEndsAt() != null && now.isAfter(pr.getEndsAt())) continue;
            if (pr.getUsageLimit() != null && pr.getUsedCount() != null && pr.getUsedCount() >= pr.getUsageLimit()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", pr.getCode());
            row.put("name", pr.getName());
            row.put("type", pr.getType());
            row.put("value", pr.getValue());
            row.put("scopeType", pr.getScopeType());
            row.put("endsAt", pr.getEndsAt());
            active.add(row);
        }
        return Map.of("promotions", active);
    }

    private Map<String, Object> handleAddToCart(Map<String, Object> args, TurnSideEffects sideEffects) {
        int qty = clampInt(args.get("quantity"), 1, 1, 20);
        UUID resolvedVariantId = tryUuid(str(args.get("variantId")));
        String productSlug = str(args.get("productSlug"));
        if (!StringUtils.hasText(productSlug)) {
            productSlug = str(args.get("slug"));
        }
        String sku = str(args.get("sku"));

        CatalogDtos.ProductDto matchedProduct = null;
        if (resolvedVariantId == null && StringUtils.hasText(productSlug)) {
            matchedProduct = resolveProduct(productSlug);
            if (matchedProduct != null && matchedProduct.variants() != null) {
                resolvedVariantId = pickVariantId(matchedProduct, sku);
            }
        }
        if (resolvedVariantId == null) {
            return Map.of("added", false, "error", "Could not resolve an active product variant to add to cart");
        }

        CartService.CartResponse cart = cartService.addItem(
                sideEffects.sessionToken,
                new CartService.AddCartItemRequest(resolvedVariantId, qty)
        );
        sideEffects.updatedCart = cart;
        sideEffects.sessionToken = cart.sessionToken();

        if (matchedProduct != null) {
            AiDtos.StorefrontProductRecommendationDto rec = toRecommendation(matchedProduct);
            if (rec != null) {
                sideEffects.addRecommendation(rec);
            }
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("added", true);
        res.put("variantId", resolvedVariantId);
        res.put("quantity", qty);
        res.put("cartItemCount", cart.items().stream().mapToInt(CartService.CartLineDto::quantity).sum());
        res.put("subtotal", cart.subtotal());
        res.put("grandTotal", cart.grandTotal());
        res.put("promotionCode", cart.promotionCode() != null ? cart.promotionCode() : "");
        return res;
    }

    private Map<String, Object> handlePrefillCheckout(
            AuthenticatedUser actor,
            Map<String, Object> args,
            TurnSideEffects sideEffects
    ) {
        String name = firstNonBlank(str(args.get("customerName")), actor != null ? actor.fullName() : "", "");
        String email = firstNonBlank(str(args.get("customerEmail")), actor != null ? actor.email() : "", "");
        String line1 = firstNonBlank(str(args.get("line1")), str(args.get("address")), "");
        String city = str(args.get("city"));
        String state = str(args.get("state"));
        String postalCode = str(args.get("postalCode"));
        String shippingMethod = "express".equalsIgnoreCase(str(args.get("shippingMethod"))) ? "express" : "standard";
        String promoCode = str(args.get("promotionCode")).toUpperCase(Locale.ROOT);
        String note = str(args.get("note"));

        String promoNote = null;
        if (StringUtils.hasText(promoCode)) {
            try {
                CartService.CartResponse promoCart = cartService.applyPromotion(sideEffects.sessionToken, promoCode);
                sideEffects.updatedCart = promoCart;
                sideEffects.sessionToken = promoCart.sessionToken();
                promoNote = "Applied code " + promoCart.promotionCode();
            } catch (ApiException ex) {
                promoNote = "Saved for checkout form; note: " + ex.getMessage();
            }
        }

        AiDtos.CheckoutPrefillDto prefill = new AiDtos.CheckoutPrefillDto(
                name, email, line1, city, state, postalCode, shippingMethod, promoCode, note
        );
        sideEffects.checkoutPrefill = prefill;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "prefilled");
        out.put("checkoutPath", "/store/checkout");
        out.put("requiresUserConfirmation", true);
        out.put("autoSubmitted", false);
        out.put("prefill", prefill);
        if (promoNote != null) {
            out.put("promotionStatus", promoNote);
        }
        return out;
    }

    private CatalogDtos.ProductDto resolveProduct(String slugOrQuery) {
        try {
            return catalogStoreService.getProductByIdOrSlug(slugOrQuery.trim());
        } catch (ApiException ignored) {
            CatalogDtos.StoreProductListResponse fallback = catalogStoreService.listProducts(
                    slugOrQuery.trim(), null, null, null, "featured", Map.of(), 0, 1
            );
            return fallback.items().isEmpty() ? null : fallback.items().getFirst();
        }
    }

    private static UUID pickVariantId(CatalogDtos.ProductDto product, String preferredSku) {
        if (product.variants() == null || product.variants().isEmpty()) return null;
        if (StringUtils.hasText(preferredSku)) {
            for (CatalogDtos.VariantDto v : product.variants()) {
                if ("ACTIVE".equalsIgnoreCase(v.status()) && preferredSku.equalsIgnoreCase(v.sku())) return v.id();
            }
        }
        for (CatalogDtos.VariantDto v : product.variants()) {
            if ("ACTIVE".equalsIgnoreCase(v.status()) && v.availableStock() > 0) return v.id();
        }
        for (CatalogDtos.VariantDto v : product.variants()) {
            if ("ACTIVE".equalsIgnoreCase(v.status())) return v.id();
        }
        return product.variants().getFirst().id();
    }

    private static AiDtos.StorefrontProductRecommendationDto toRecommendation(CatalogDtos.ProductDto p) {
        if (p == null) return null;
        CatalogDtos.VariantDto best = null;
        if (p.variants() != null) {
            for (CatalogDtos.VariantDto v : p.variants()) {
                if ("ACTIVE".equalsIgnoreCase(v.status()) && v.availableStock() > 0) {
                    best = v;
                    break;
                }
            }
            if (best == null && !p.variants().isEmpty()) {
                best = p.variants().getFirst();
            }
        }
        return new AiDtos.StorefrontProductRecommendationDto(
                p.id(),
                best != null ? best.id() : null,
                p.slug(),
                p.name(),
                p.brand(),
                best != null ? best.price() : p.minPrice(),
                p.primaryImageUrl(),
                best != null ? best.title() : "",
                best != null ? best.sku() : "",
                best != null ? best.availableStock() : p.totalStock()
        );
    }

    private static Map<String, Object> summarizeProduct(CatalogDtos.ProductDto p, boolean includeFullSpecs) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("productId", p.id());
        m.put("slug", p.slug());
        m.put("name", p.name());
        m.put("brand", p.brand());
        m.put("minPrice", p.minPrice());
        m.put("maxPrice", p.maxPrice());
        m.put("rating", p.rating());
        m.put("totalStock", p.totalStock());
        m.put("primaryImageUrl", p.primaryImageUrl());
        if (includeFullSpecs && StringUtils.hasText(p.description())) {
            m.put("description", p.description());
        }
        m.put("categories", p.categories().stream().map(CatalogDtos.CategoryRefDto::name).toList());
        int attrLimit = includeFullSpecs ? 16 : 5;
        m.put("attributes", p.attributes().stream().limit(attrLimit).map(a -> Map.of(
                "name", a.name(),
                "value", a.displayValue() != null ? a.displayValue() : ""
        )).toList());
        int varLimit = includeFullSpecs ? 12 : 3;
        m.put("variants", p.variants().stream()
                .filter(v -> "ACTIVE".equalsIgnoreCase(v.status()))
                .limit(varLimit)
                .map(v -> Map.of(
                        "variantId", v.id(),
                        "title", v.title(),
                        "sku", v.sku(),
                        "price", v.price(),
                        "availableStock", v.availableStock(),
                        "options", v.options() != null ? v.options() : Map.of()
                ))
                .toList());
        return m;
    }

    private String safeErrorJson(String message) {
        try {
            return objectMapper.writeValueAsString(Map.of("error", message != null ? message : "error"));
        } catch (Exception ignored) {
            return "{\"error\":\"Tool error\"}";
        }
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (StringUtils.hasText(v)) return v.trim();
        }
        return "";
    }

    private static BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        try {
            String s = String.valueOf(v).trim();
            return s.isEmpty() ? null : new BigDecimal(s);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static int clampInt(Object v, int fallback, int min, int max) {
        if (v == null) return fallback;
        try {
            int n = v instanceof Number num ? num.intValue() : Integer.parseInt(String.valueOf(v).trim());
            return Math.min(Math.max(n, min), max);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static UUID tryUuid(String raw) {
        if (!StringUtils.hasText(raw)) return null;
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
