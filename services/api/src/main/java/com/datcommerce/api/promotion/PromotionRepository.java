package com.datcommerce.api.promotion;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromotionRepository extends JpaRepository<PromotionEntity, UUID> {
    List<PromotionEntity> findAllByStoreIdOrderByCreatedAtDesc(UUID storeId);

    Optional<PromotionEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<PromotionEntity> findByStoreIdAndCodeIgnoreCase(UUID storeId, String code);
}
