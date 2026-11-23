package com.datcommerce.api.pricing;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PriceRepository extends JpaRepository<PriceEntity, UUID> {
    Optional<PriceEntity> findByVariantIdAndCurrency(UUID variantId, String currency);

    List<PriceEntity> findAllByVariantIdInAndCurrency(Collection<UUID> variantIds, String currency);
}
