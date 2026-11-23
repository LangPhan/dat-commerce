package com.datcommerce.api.ai;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiConversationRepository extends JpaRepository<AiConversationEntity, UUID> {
    List<AiConversationEntity> findAllByStoreIdAndUserIdOrderByUpdatedAtDesc(UUID storeId, UUID userId);

    List<AiConversationEntity> findTop30ByStoreIdOrderByUpdatedAtDesc(UUID storeId);

    Optional<AiConversationEntity> findByIdAndStoreId(UUID id, UUID storeId);
}
