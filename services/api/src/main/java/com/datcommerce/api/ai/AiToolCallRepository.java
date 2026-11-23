package com.datcommerce.api.ai;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiToolCallRepository extends JpaRepository<AiToolCallEntity, UUID> {
    List<AiToolCallEntity> findAllByConversationIdOrderByCreatedAtAsc(UUID conversationId);
}
