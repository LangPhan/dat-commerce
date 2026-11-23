package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionProductRepository
        extends JpaRepository<CollectionEntity.CollectionProductEntity, CollectionEntity.CollectionProductId> {
    List<CollectionEntity.CollectionProductEntity> findAllByIdCollectionIdInOrderBySortOrderAsc(Collection<UUID> ids);

    void deleteAllByIdCollectionId(UUID collectionId);
}
