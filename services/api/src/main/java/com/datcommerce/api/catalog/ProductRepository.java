package com.datcommerce.api.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<ProductEntity, UUID> {

    @EntityGraph(attributePaths = {"categories"})
    List<ProductEntity> findAllByStoreIdOrderByCreatedAtDesc(UUID storeId);

    @EntityGraph(attributePaths = {"categories"})
    List<ProductEntity> findAllByStoreIdAndStatusOrderByCreatedAtDesc(UUID storeId, String status);

    @EntityGraph(attributePaths = {"categories"})
    Optional<ProductEntity> findByIdAndStoreId(UUID id, UUID storeId);

    @EntityGraph(attributePaths = {"categories"})
    Optional<ProductEntity> findByStoreIdAndSlugIgnoreCase(UUID storeId, String slug);

    @EntityGraph(attributePaths = {"categories"})
    List<ProductEntity> findAllByStoreIdAndIdIn(UUID storeId, Collection<UUID> ids);

    boolean existsByStoreIdAndSlugIgnoreCase(UUID storeId, String slug);
}
