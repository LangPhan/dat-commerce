package com.datcommerce.api.inventory;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryReservationRepository extends JpaRepository<InventoryReservationEntity, UUID> {
    List<InventoryReservationEntity> findAllByOrderId(UUID orderId);
}
