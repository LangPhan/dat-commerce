package com.datcommerce.api.ai;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiChangePlanRepository extends JpaRepository<AiChangePlanEntity, UUID> {
    Optional<AiChangePlanEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<AiChangePlanEntity> findByStoreIdAndIdempotencyKey(UUID storeId, String idempotencyKey);

    List<AiChangePlanEntity> findAllByConversationIdOrderByCreatedAtDesc(UUID conversationId);

    List<AiChangePlanEntity> findTop50ByStoreIdOrderByCreatedAtDesc(UUID storeId);
}
