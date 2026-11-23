package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductAttributeValueRepository extends JpaRepository<ProductAttributeValueEntity, UUID> {
    List<ProductAttributeValueEntity> findAllByProductId(UUID productId);

    List<ProductAttributeValueEntity> findAllByProductIdIn(Collection<UUID> productIds);

    boolean existsByAttributeDefinitionId(UUID attributeDefinitionId);

    void deleteAllByProductId(UUID productId);
}
