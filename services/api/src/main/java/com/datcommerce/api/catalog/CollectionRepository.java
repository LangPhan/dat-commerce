package com.datcommerce.api.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionRepository extends JpaRepository<CollectionEntity, UUID> {
    List<CollectionEntity> findAllByStoreIdOrderByNameAsc(UUID storeId);

    Optional<CollectionEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<CollectionEntity> findByStoreIdAndSlugIgnoreCase(UUID storeId, String slug);
}
