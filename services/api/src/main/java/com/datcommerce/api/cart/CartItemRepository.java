package com.datcommerce.api.cart;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartItemRepository extends JpaRepository<CartItemEntity, UUID> {
    List<CartItemEntity> findAllByCartId(UUID cartId);

    Optional<CartItemEntity> findByCartIdAndVariantId(UUID cartId, UUID variantId);

    void deleteAllByCartId(UUID cartId);
}
