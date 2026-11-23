package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VariantRepository extends JpaRepository<VariantEntity, UUID> {
    List<VariantEntity> findAllByProductIdOrderByCreatedAtAsc(UUID productId);

    List<VariantEntity> findAllByProductIdInOrderByCreatedAtAsc(Collection<UUID> productIds);

    Optional<VariantEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<VariantEntity> findByStoreIdAndSkuIgnoreCase(UUID storeId, String sku);

    boolean existsByStoreIdAndSkuIgnoreCase(UUID storeId, String sku);
}
