package com.datcommerce.api.cms;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThemeConfigRepository extends JpaRepository<ThemeConfigEntity, UUID> {
    List<ThemeConfigEntity> findAllByStoreIdOrderByVersionNumberDesc(UUID storeId);

    Optional<ThemeConfigEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<ThemeConfigEntity> findTopByStoreIdAndStatusOrderByVersionNumberDesc(UUID storeId, String status);

    Optional<ThemeConfigEntity> findTopByStoreIdOrderByVersionNumberDesc(UUID storeId);
}
