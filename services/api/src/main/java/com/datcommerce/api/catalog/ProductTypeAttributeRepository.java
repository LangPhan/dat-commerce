package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductTypeAttributeRepository
        extends JpaRepository<ProductTypeAttributeEntity, ProductTypeAttributeEntity.ProductTypeAttributeId> {
    List<ProductTypeAttributeEntity> findAllByIdProductTypeIdOrderByDisplayOrderAsc(UUID productTypeId);

    List<ProductTypeAttributeEntity> findAllByIdProductTypeIdInOrderByDisplayOrderAsc(Collection<UUID> productTypeIds);

    boolean existsByIdAttributeDefinitionId(UUID attributeDefinitionId);

    void deleteAllByIdProductTypeId(UUID productTypeId);
}
