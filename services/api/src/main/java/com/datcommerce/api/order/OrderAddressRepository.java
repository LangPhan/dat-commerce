package com.datcommerce.api.order;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderAddressRepository extends JpaRepository<OrderAddressEntity, UUID> {
    List<OrderAddressEntity> findAllByOrderId(UUID orderId);

    List<OrderAddressEntity> findAllByOrderIdIn(Collection<UUID> orderIds);
}
