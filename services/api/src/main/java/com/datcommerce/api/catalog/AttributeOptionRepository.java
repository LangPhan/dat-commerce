package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributeOptionRepository extends JpaRepository<AttributeOptionEntity, UUID> {
    List<AttributeOptionEntity> findAllByAttributeDefinitionIdOrderBySortOrderAsc(UUID attributeDefinitionId);

    List<AttributeOptionEntity> findAllByAttributeDefinitionIdInOrderBySortOrderAsc(Collection<UUID> ids);

    void deleteAllByAttributeDefinitionId(UUID attributeDefinitionId);
}
