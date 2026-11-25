package com.datcommerce.api.cms;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnimationPresetRepository extends JpaRepository<AnimationPresetEntity, UUID> {
    List<AnimationPresetEntity> findAllByStoreIdOrderByUpdatedAtDesc(UUID storeId);
    List<AnimationPresetEntity> findAllByStoreIdAndCategoryIgnoreCaseOrderByUpdatedAtDesc(UUID storeId, String category);
    Optional<AnimationPresetEntity> findByIdAndStoreId(UUID id, UUID storeId);
    Optional<AnimationPresetEntity> findByStoreIdAndPresetKeyIgnoreCase(UUID storeId, String presetKey);
    boolean existsByStoreIdAndPresetKeyIgnoreCase(UUID storeId, String presetKey);
}
