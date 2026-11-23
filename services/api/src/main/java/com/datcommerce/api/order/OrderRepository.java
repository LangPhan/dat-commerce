package com.datcommerce.api.order;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<OrderEntity, UUID> {
    List<OrderEntity> findAllByStoreIdOrderByCreatedAtDesc(UUID storeId);

    Optional<OrderEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<OrderEntity> findByOrderNumberIgnoreCase(String orderNumber);

    Optional<OrderEntity> findByIdempotencyKey(String idempotencyKey);
}
