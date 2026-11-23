package com.datcommerce.api.cart;

import com.datcommerce.api.catalog.ProductEntity;
import com.datcommerce.api.catalog.ProductRepository;
import com.datcommerce.api.catalog.VariantEntity;
import com.datcommerce.api.catalog.VariantRepository;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.inventory.InventoryService;
import com.datcommerce.api.pricing.PricingCalculationService;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final VariantRepository variantRepository;
    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final InventoryService inventoryService;
    private final PricingCalculationService pricingCalculationService;

    public CartService(
            CartRepository cartRepository,
            CartItemRepository cartItemRepository,
            VariantRepository variantRepository,
            ProductRepository productRepository,
            StoreRepository storeRepository,
            InventoryService inventoryService,
            PricingCalculationService pricingCalculationService
    ) {
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.variantRepository = variantRepository;
        this.productRepository = productRepository;
        this.storeRepository = storeRepository;
        this.inventoryService = inventoryService;
        this.pricingCalculationService = pricingCalculationService;
    }

    @Transactional
    public CartResponse getOrCreateCart(String sessionToken) {
        CartEntity cart = resolveCartEntity(sessionToken);
        return buildResponse(cart);
    }

    @Transactional
    public CartResponse addItem(String sessionToken, AddCartItemRequest req) {
        CartEntity cart = resolveCartEntity(sessionToken);
        VariantEntity variant = variantRepository.findByIdAndStoreId(req.variantId(), cart.getStoreId())
                .filter(v -> "ACTIVE".equalsIgnoreCase(v.getStatus()))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Variant not found"));

        CartItemEntity item = cartItemRepository.findByCartIdAndVariantId(cart.getId(), variant.getId())
                .orElse(null);
        int nextQty = (item != null ? item.getQuantity() : 0) + req.quantity();

        int available = inventoryService.getAvailableStockByVariantIds(cart.getStoreId(), List.of(variant.getId()))
                .getOrDefault(variant.getId(), 0);
        if (nextQty > available) {
            throw new ApiException(ErrorCode.CONFLICT, "Insufficient stock for SKU " + variant.getSku());
        }

        if (item == null) {
            item = new CartItemEntity();
            item.setId(UUID.randomUUID());
            item.setCartId(cart.getId());
            item.setVariantId(variant.getId());
        }
        item.setQuantity(nextQty);
        cartItemRepository.save(item);
        cart.setUpdatedAt(Instant.now());
        cartRepository.save(cart);

        return buildResponse(cart);
    }

    @Transactional
    public CartResponse updateItemQuantity(String sessionToken, UUID variantId, int quantity) {
        CartEntity cart = resolveCartEntity(sessionToken);
        CartItemEntity item = cartItemRepository.findByCartIdAndVariantId(cart.getId(), variantId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Cart item not found"));

        if (quantity <= 0) {
            cartItemRepository.delete(item);
        } else {
            VariantEntity variant = variantRepository.findByIdAndStoreId(variantId, cart.getStoreId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Variant not found"));
            int available = inventoryService.getAvailableStockByVariantIds(cart.getStoreId(), List.of(variantId))
                    .getOrDefault(variantId, 0);
            if (quantity > available) {
                throw new ApiException(ErrorCode.CONFLICT, "Insufficient stock for SKU " + variant.getSku());
            }
            item.setQuantity(quantity);
            cartItemRepository.save(item);
        }
        cart.setUpdatedAt(Instant.now());
        cartRepository.save(cart);
        return buildResponse(cart);
    }

    @Transactional
    public CartResponse removeItem(String sessionToken, UUID variantId) {
        CartEntity cart = resolveCartEntity(sessionToken);
        cartItemRepository.findByCartIdAndVariantId(cart.getId(), variantId)
                .ifPresent(cartItemRepository::delete);
        cart.setUpdatedAt(Instant.now());
        cartRepository.save(cart);
        return buildResponse(cart);
    }

    @Transactional
    public CartResponse applyPromotion(String sessionToken, String promotionCode) {
        CartEntity cart = resolveCartEntity(sessionToken);
        if (!StringUtils.hasText(promotionCode)) {
            cart.setPromotionCode(null);
            cart.setUpdatedAt(Instant.now());
            cartRepository.save(cart);
            return buildResponse(cart);
        }

        List<PricingCalculationService.PricedLineInput> inputs = loadPricedLines(cart.getId());
        if (inputs.isEmpty()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Add items to cart before applying a promotion code");
        }
        var quote = pricingCalculationService.calculateQuote(
                cart.getStoreId(), cart.getCurrency(), inputs, promotionCode, "standard", true
        );
        cart.setPromotionCode(quote.promotionCode());
        cart.setUpdatedAt(Instant.now());
        cartRepository.save(cart);
        return buildResponse(cart);
    }

    @Transactional
    public CartEntity resolveCartEntity(String sessionToken) {
        StoreEntity store = storeRepository.findByCode("terrain-supply")
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not initialized"));
        if (StringUtils.hasText(sessionToken)) {
            var existing = cartRepository.findBySessionToken(sessionToken.trim());
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        String token = StringUtils.hasText(sessionToken) ? sessionToken.trim() : UUID.randomUUID().toString();
        Instant now = Instant.now();
        CartEntity cart = new CartEntity();
        cart.setId(UUID.randomUUID());
        cart.setStoreId(store.getId());
        cart.setSessionToken(token);
        cart.setCurrency(store.getDefaultCurrency());
        cart.setCreatedAt(now);
        cart.setUpdatedAt(now);
        return cartRepository.save(cart);
    }

    @Transactional(readOnly = true)
    public List<PricingCalculationService.PricedLineInput> loadPricedLines(UUID cartId) {
        List<CartItemEntity> items = cartItemRepository.findAllByCartId(cartId);
        if (items.isEmpty()) return List.of();
        List<UUID> variantIds = items.stream().map(CartItemEntity::getVariantId).toList();
        Map<UUID, VariantEntity> variantsById = variantRepository.findAllById(variantIds).stream()
                .collect(Collectors.toMap(VariantEntity::getId, Function.identity()));
        return items.stream()
                .map(i -> {
                    VariantEntity v = variantsById.get(i.getVariantId());
                    return v != null ? new PricingCalculationService.PricedLineInput(v, i.getQuantity()) : null;
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private CartResponse buildResponse(CartEntity cart) {
        List<PricingCalculationService.PricedLineInput> inputs = loadPricedLines(cart.getId());
        var quote = pricingCalculationService.calculateQuote(
                cart.getStoreId(), cart.getCurrency(), inputs, cart.getPromotionCode(), "standard", false
        );

        List<UUID> productIds = quote.lines().stream().map(PricingCalculationService.QuotedLine::productId).distinct().toList();
        Map<UUID, ProductEntity> productsById = productIds.isEmpty()
                ? Map.of()
                : productRepository.findAllByStoreIdAndIdIn(cart.getStoreId(), productIds).stream()
                        .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));

        List<UUID> variantIds = quote.lines().stream().map(PricingCalculationService.QuotedLine::variantId).toList();
        Map<UUID, Integer> stockMap = inventoryService.getAvailableStockByVariantIds(cart.getStoreId(), variantIds);

        List<CartLineDto> lineDtos = quote.lines().stream().map(l -> {
            ProductEntity p = productsById.get(l.productId());
            return new CartLineDto(
                    l.variantId(),
                    l.productId(),
                    p != null ? p.getSlug() : "",
                    l.productName(),
                    l.variantTitle(),
                    l.sku(),
                    p != null ? p.getPrimaryImageUrl() : "/media/terrain-fallback.jpg",
                    l.unitPrice(),
                    l.quantity(),
                    l.lineTotal(),
                    stockMap.getOrDefault(l.variantId(), 0)
            );
        }).toList();

        BigDecimal freeThreshold = new BigDecimal("100.00");
        StoreEntity store = storeRepository.findById(cart.getStoreId()).orElse(null);
        if (store != null && store.getSettingsJson() != null && store.getSettingsJson().get("freeShippingThreshold") != null) {
            try {
                freeThreshold = new BigDecimal(String.valueOf(store.getSettingsJson().get("freeShippingThreshold")));
            } catch (NumberFormatException ignored) {
                // keep default
            }
        }

        return new CartResponse(
                cart.getId(),
                cart.getSessionToken(),
                quote.currency(),
                quote.promotionCode(),
                quote.subtotal(),
                quote.discountTotal(),
                quote.shippingTotal(),
                freeThreshold,
                quote.grandTotal(),
                lineDtos
        );
    }

    public record AddCartItemRequest(@NotNull UUID variantId, @Min(1) int quantity) {
    }

    public record UpdateCartItemRequest(@Min(0) int quantity) {
    }

    public record ApplyPromoRequest(String code) {
    }

    public record CartLineDto(
            UUID variantId,
            UUID productId,
            String productSlug,
            String productName,
            String variantTitle,
            String sku,
            String imageUrl,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal,
            int availableStock
    ) {
    }

    public record CartResponse(
            UUID id,
            String sessionToken,
            String currency,
            String promotionCode,
            BigDecimal subtotal,
            BigDecimal discountTotal,
            BigDecimal shippingTotal,
            BigDecimal freeShippingThreshold,
            BigDecimal grandTotal,
            List<CartLineDto> items
    ) {
    }
}
