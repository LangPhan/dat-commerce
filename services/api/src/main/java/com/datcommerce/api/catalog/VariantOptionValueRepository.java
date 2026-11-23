package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VariantOptionValueRepository extends JpaRepository<VariantOptionValueEntity, UUID> {
    List<VariantOptionValueEntity> findAllByVariantIdIn(Collection<UUID> variantIds);

    void deleteAllByVariantId(UUID variantId);
}
