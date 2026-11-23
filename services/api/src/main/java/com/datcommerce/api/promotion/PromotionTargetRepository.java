package com.datcommerce.api.promotion;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromotionTargetRepository extends JpaRepository<PromotionTargetEntity, UUID> {
    List<PromotionTargetEntity> findAllByPromotionId(UUID promotionId);

    List<PromotionTargetEntity> findAllByPromotionIdIn(Collection<UUID> promotionIds);

    void deleteAllByPromotionId(UUID promotionId);
}
