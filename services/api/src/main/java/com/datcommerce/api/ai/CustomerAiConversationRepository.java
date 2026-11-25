package com.datcommerce.api.ai;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerAiConversationRepository extends JpaRepository<CustomerAiConversationEntity, UUID> {
    List<CustomerAiConversationEntity> findAllByStoreIdAndUserIdOrderByUpdatedAtDesc(UUID storeId, UUID userId);

    Optional<CustomerAiConversationEntity> findByIdAndStoreIdAndUserId(UUID id, UUID storeId, UUID userId);
}
