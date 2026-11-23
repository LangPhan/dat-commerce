package com.datcommerce.api.inventory;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryAdjustmentRepository extends JpaRepository<InventoryAdjustmentEntity, UUID> {
    List<InventoryAdjustmentEntity> findTop30ByStoreIdOrderByCreatedAtDesc(UUID storeId);
}
