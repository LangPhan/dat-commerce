package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductImageRepository extends JpaRepository<ProductImageEntity, UUID> {
    List<ProductImageEntity> findAllByProductIdOrderBySortOrderAsc(UUID productId);

    List<ProductImageEntity> findAllByProductIdInOrderBySortOrderAsc(Collection<UUID> productIds);

    void deleteAllByProductId(UUID productId);
}
