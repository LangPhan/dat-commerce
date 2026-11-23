package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributeDefinitionRepository extends JpaRepository<AttributeDefinitionEntity, UUID> {
    List<AttributeDefinitionEntity> findAllByStoreIdOrderByCodeAsc(UUID storeId);

    List<AttributeDefinitionEntity> findAllByStoreIdAndArchivedAtIsNullOrderByCodeAsc(UUID storeId);

    Optional<AttributeDefinitionEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<AttributeDefinitionEntity> findByStoreIdAndCodeIgnoreCase(UUID storeId, String code);

    List<AttributeDefinitionEntity> findAllByIdIn(Collection<UUID> ids);
}
