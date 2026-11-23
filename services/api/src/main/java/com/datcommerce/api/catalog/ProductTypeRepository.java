package com.datcommerce.api.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductTypeRepository extends JpaRepository<ProductTypeEntity, UUID> {
    List<ProductTypeEntity> findAllByStoreIdOrderByNameAsc(UUID storeId);

    Optional<ProductTypeEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<ProductTypeEntity> findByStoreIdAndCodeIgnoreCase(UUID storeId, String code);

    boolean existsByStoreIdAndCodeIgnoreCase(UUID storeId, String code);
}
