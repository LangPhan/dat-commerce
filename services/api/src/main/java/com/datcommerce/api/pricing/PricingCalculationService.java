package com.datcommerce.api.pricing;

import com.datcommerce.api.catalog.CategoryEntity;
import com.datcommerce.api.catalog.ProductEntity;
import com.datcommerce.api.catalog.ProductRepository;
import com.datcommerce.api.catalog.VariantEntity;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.promotion.PromotionEntity;
import com.datcommerce.api.promotion.PromotionRepository;
import com.datcommerce.api.promotion.PromotionTargetEntity;
import com.datcommerce.api.promotion.PromotionTargetRepository;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class PricingCalculationService {

    private final PriceRepository priceRepository;
    private final PromotionRepository promotionRepository;
    private final PromotionTargetRepository promotionTargetRepository;
    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;

    public PricingCalculationService(
            PriceRepository priceRepository,
            PromotionRepository promotionRepository,
            PromotionTargetRepository promotionTargetRepository,
            ProductRepository productRepository,
            StoreRepository storeRepository
    ) {
        this.priceRepository = priceRepository;
        this.promotionRepository = promotionRepository;
        this.promotionTargetRepository = promotionTargetRepository;
        this.productRepository = productRepository;
        this.storeRepository = storeRepository;
    }

    @Transactional(readOnly = true)
    public QuoteResult calculateQuote(
            UUID storeId,
            String currency,
            List<PricedLineInput> lines,
            String promoCode,
            String shippingMethod,
            boolean strictPromo
    ) {
        if (lines == null || lines.isEmpty()) {
            return new QuoteResult(
                    currency, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    null, null, List.of()
            );
        }

        List<UUID> variantIds = lines.stream().map(l -> l.variant().getId()).toList();
        Map<UUID, PriceEntity> priceMap = priceRepository.findAllByVariantIdInAndCurrency(variantIds, currency)
                .stream().collect(Collectors.toMap(PriceEntity::getVariantId, Function.identity(), (a, b) -> a));

        Set<UUID> productIds = lines.stream().map(l -> l.variant().getProductId()).collect(Collectors.toSet());
        Map<UUID, ProductEntity> products = productRepository.findAllByStoreIdAndIdIn(storeId, productIds)
                .stream().collect(Collectors.toMap(ProductEntity::getId, Function.identity()));

        BigDecimal subtotal = BigDecimal.ZERO;
        List<QuotedLine> quotedLines = new java.util.ArrayList<>();
        for (PricedLineInput line : lines) {
            PriceEntity price = priceMap.get(line.variant().getId());
            if (price == null) {
                throw new ApiException(ErrorCode.CONFLICT, "Missing price for SKU " + line.variant().getSku());
            }
            BigDecimal unit = price.getAmount().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unit.multiply(BigDecimal.valueOf(line.quantity())).setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineTotal);
            ProductEntity prod = products.get(line.variant().getProductId());
            quotedLines.add(new QuotedLine(
                    line.variant().getId(),
                    line.variant().getProductId(),
                    prod != null ? prod.getName() : line.variant().getTitle(),
                    line.variant().getTitle(),
                    line.variant().getSku(),
                    unit,
                    line.quantity(),
                    lineTotal,
                    prod != null ? prod.getCategories().stream().map(CategoryEntity::getId).collect(Collectors.toSet()) : Set.of()
            ));
        }

        BigDecimal discountTotal = BigDecimal.ZERO;
        PromotionEntity appliedPromo = null;
        if (StringUtils.hasText(promoCode)) {
            String code = promoCode.trim().toUpperCase();
            PromotionEntity promo = promotionRepository.findByStoreIdAndCodeIgnoreCase(storeId, code).orElse(null);
            String rejectionReason = validatePromotion(promo, quotedLines);
            if (rejectionReason != null) {
                if (strictPromo) {
                    throw new ApiException(ErrorCode.BAD_REQUEST, rejectionReason);
                }
            } else {
                appliedPromo = promo;
                BigDecimal eligibleSubtotal = computeEligibleSubtotal(promo, quotedLines);
                if (eligibleSubtotal.compareTo(BigDecimal.ZERO) > 0) {
                    if ("PERCENTAGE".equalsIgnoreCase(promo.getType())) {
                        discountTotal = eligibleSubtotal
                                .multiply(promo.getValue())
                                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
                    } else {
                        discountTotal = promo.getValue().min(eligibleSubtotal).setScale(2, RoundingMode.HALF_UP);
                    }
                } else if (strictPromo) {
                    throw new ApiException(ErrorCode.BAD_REQUEST, "Promotion code is not applicable to items in cart");
                }
            }
        }

        BigDecimal shippingTotal = computeShipping(storeId, subtotal, shippingMethod);
        BigDecimal taxTotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal grandTotal = subtotal.subtract(discountTotal).max(BigDecimal.ZERO)
                .add(shippingTotal).add(taxTotal).setScale(2, RoundingMode.HALF_UP);

        return new QuoteResult(
                currency,
                subtotal.setScale(2, RoundingMode.HALF_UP),
                discountTotal,
                shippingTotal,
                taxTotal,
                grandTotal,
                appliedPromo != null ? appliedPromo.getId() : null,
                appliedPromo != null ? appliedPromo.getCode() : null,
                quotedLines
        );
    }

    private String validatePromotion(PromotionEntity promo, List<QuotedLine> lines) {
        if (promo == null) {
            return "Promotion code does not exist";
        }
        if (!"ACTIVE".equalsIgnoreCase(promo.getStatus())) {
            return "Promotion code is not active";
        }
        Instant now = Instant.now();
        if (now.isBefore(promo.getStartsAt()) || now.isAfter(promo.getEndsAt())) {
            return "Promotion code is outside its valid schedule";
        }
        if (promo.getUsageLimit() != null && promo.getUsedCount() >= promo.getUsageLimit()) {
            return "Promotion usage limit has been reached";
        }
        if (computeEligibleSubtotal(promo, lines).compareTo(BigDecimal.ZERO) <= 0) {
            return "Promotion code does not apply to any items in cart";
        }
        return null;
    }

    private BigDecimal computeEligibleSubtotal(PromotionEntity promo, List<QuotedLine> lines) {
        if ("ALL".equalsIgnoreCase(promo.getScopeType())) {
            return lines.stream().map(QuotedLine::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        Set<UUID> targetIds = promotionTargetRepository.findAllByPromotionId(promo.getId()).stream()
                .map(PromotionTargetEntity::getTargetId)
                .collect(Collectors.toSet());
        if (targetIds.isEmpty()) return BigDecimal.ZERO;

        BigDecimal sum = BigDecimal.ZERO;
        for (QuotedLine line : lines) {
            boolean matches = "PRODUCT".equalsIgnoreCase(promo.getScopeType())
                    ? targetIds.contains(line.productId())
                    : line.categoryIds().stream().anyMatch(targetIds::contains);
            if (matches) {
                sum = sum.add(line.lineTotal());
            }
        }
        return sum;
    }

    private BigDecimal computeShipping(UUID storeId, BigDecimal subtotal, String shippingMethod) {
        if ("express".equalsIgnoreCase(shippingMethod)) {
            return new BigDecimal("24.00");
        }
        BigDecimal threshold = new BigDecimal("100.00");
        BigDecimal baseFee = new BigDecimal("12.00");
        StoreEntity store = storeRepository.findById(storeId).orElse(null);
        if (store != null && store.getSettingsJson() != null) {
            threshold = parseDecimal(store.getSettingsJson().get("freeShippingThreshold"), threshold);
            baseFee = parseDecimal(store.getSettingsJson().get("shippingFee"), baseFee);
        }
        return subtotal.compareTo(threshold) >= 0 ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : baseFee;
    }

    private static BigDecimal parseDecimal(Object raw, BigDecimal fallback) {
        if (raw == null) return fallback;
        try {
            return new BigDecimal(String.valueOf(raw)).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    public record PricedLineInput(VariantEntity variant, int quantity) {
    }

    public record QuotedLine(
            UUID variantId,
            UUID productId,
            String productName,
            String variantTitle,
            String sku,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal,
            Set<UUID> categoryIds
    ) {
    }

    public record QuoteResult(
            String currency,
            BigDecimal subtotal,
            BigDecimal discountTotal,
            BigDecimal shippingTotal,
            BigDecimal taxTotal,
            BigDecimal grandTotal,
            UUID promotionId,
            String promotionCode,
            List<QuotedLine> lines
    ) {
    }
}
