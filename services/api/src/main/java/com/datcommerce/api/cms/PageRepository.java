package com.datcommerce.api.cms;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PageRepository extends JpaRepository<PageEntity, UUID> {
    List<PageEntity> findAllByStoreIdOrderBySlugAsc(UUID storeId);

    Optional<PageEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<PageEntity> findByStoreIdAndSlugIgnoreCase(UUID storeId, String slug);
}
