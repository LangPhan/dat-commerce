package com.datcommerce.api.ai;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerAiMessageRepository extends JpaRepository<CustomerAiMessageEntity, UUID> {
    List<CustomerAiMessageEntity> findAllByConversationIdOrderByCreatedAtAsc(UUID conversationId);
}
