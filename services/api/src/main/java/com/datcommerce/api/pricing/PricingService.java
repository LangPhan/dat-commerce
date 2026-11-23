package com.datcommerce.api.pricing;

import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PricingService {

    private final PriceRepository priceRepository;

    public PricingService(PriceRepository priceRepository) {
        this.priceRepository = priceRepository;
    }

    @Transactional
    public PriceEntity upsertVariantPrice(
            UUID storeId,
            UUID variantId,
            String currency,
            BigDecimal amount,
            BigDecimal compareAtAmount
    ) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Price amount must be >= 0");
        }
        String curr = currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase();
        BigDecimal scaled = amount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal scaledCompare = compareAtAmount == null
                ? null
                : compareAtAmount.setScale(2, RoundingMode.HALF_UP);

        PriceEntity entity = priceRepository.findByVariantIdAndCurrency(variantId, curr)
                .orElseGet(() -> {
                    PriceEntity p = new PriceEntity();
                    p.setId(UUID.randomUUID());
                    p.setStoreId(storeId);
                    p.setVariantId(variantId);
                    p.setCurrency(curr);
                    return p;
                });
        entity.setAmount(scaled);
        entity.setCompareAtAmount(scaledCompare);
        entity.setUpdatedAt(Instant.now());
        return priceRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public Map<UUID, PriceEntity> getPricesByVariantIds(Collection<UUID> variantIds, String currency) {
        if (variantIds == null || variantIds.isEmpty()) {
            return Map.of();
        }
        String curr = currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase();
        return priceRepository.findAllByVariantIdInAndCurrency(variantIds, curr).stream()
                .collect(Collectors.toMap(PriceEntity::getVariantId, Function.identity(), (a, b) -> a));
    }
}
