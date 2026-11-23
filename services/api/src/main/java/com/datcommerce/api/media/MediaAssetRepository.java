package com.datcommerce.api.media;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaAssetRepository extends JpaRepository<MediaAssetEntity, UUID> {
    List<MediaAssetEntity> findAllByStoreIdOrderByCreatedAtDesc(UUID storeId);

    Optional<MediaAssetEntity> findByIdAndStoreId(UUID id, UUID storeId);
}
