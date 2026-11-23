package com.datcommerce.api.inventory;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryLevelRepository extends JpaRepository<InventoryLevelEntity, UUID> {
    List<InventoryLevelEntity> findAllByInventoryItemIdIn(Collection<UUID> inventoryItemIds);

    Optional<InventoryLevelEntity> findByInventoryItemIdAndStockLocationId(UUID inventoryItemId, UUID stockLocationId);
}
