package com.datcommerce.api.order;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderItemRepository extends JpaRepository<OrderItemEntity, UUID> {
    List<OrderItemEntity> findAllByOrderId(UUID orderId);

    List<OrderItemEntity> findAllByOrderIdIn(Collection<UUID> orderIds);
}
