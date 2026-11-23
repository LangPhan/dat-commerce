package com.datcommerce.api.inventory;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockLocationRepository extends JpaRepository<StockLocationEntity, UUID> {
    Optional<StockLocationEntity> findFirstByStoreIdAndIsDefaultTrue(UUID storeId);

    Optional<StockLocationEntity> findByStoreIdAndCode(UUID storeId, String code);

    List<StockLocationEntity> findAllByStoreIdOrderByNameAsc(UUID storeId);
}
