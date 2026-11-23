package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<CategoryEntity, UUID> {
    List<CategoryEntity> findAllByStoreIdOrderByNameAsc(UUID storeId);

    Optional<CategoryEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<CategoryEntity> findByStoreIdAndSlugIgnoreCase(UUID storeId, String slug);

    List<CategoryEntity> findAllByStoreIdAndIdIn(UUID storeId, Collection<UUID> ids);
}
