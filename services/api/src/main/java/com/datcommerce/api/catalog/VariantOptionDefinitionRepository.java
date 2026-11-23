package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VariantOptionDefinitionRepository extends JpaRepository<VariantOptionDefinitionEntity, UUID> {
    List<VariantOptionDefinitionEntity> findAllByProductTypeIdOrderBySortOrderAsc(UUID productTypeId);

    List<VariantOptionDefinitionEntity> findAllByProductTypeIdInOrderBySortOrderAsc(Collection<UUID> productTypeIds);

    void deleteAllByProductTypeId(UUID productTypeId);
}
