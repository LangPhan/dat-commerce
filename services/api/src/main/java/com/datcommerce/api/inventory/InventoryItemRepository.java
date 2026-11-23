package com.datcommerce.api.inventory;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryItemRepository extends JpaRepository<InventoryItemEntity, UUID> {
    Optional<InventoryItemEntity> findByVariantId(UUID variantId);

    List<InventoryItemEntity> findAllByVariantIdIn(Collection<UUID> variantIds);

    List<InventoryItemEntity> findAllByStoreId(UUID storeId);
}
