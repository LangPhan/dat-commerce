package com.datcommerce.api.order;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderEventRepository extends JpaRepository<OrderEventEntity, UUID> {
    List<OrderEventEntity> findAllByOrderIdOrderByCreatedAtAsc(UUID orderId);

    List<OrderEventEntity> findAllByOrderIdInOrderByCreatedAtAsc(Collection<UUID> orderIds);
}
