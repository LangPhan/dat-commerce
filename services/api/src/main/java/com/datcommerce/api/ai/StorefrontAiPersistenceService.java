package com.datcommerce.api.ai;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StorefrontAiPersistenceService {

    private final CustomerAiConversationRepository conversationRepository;
    private final CustomerAiMessageRepository messageRepository;
    private final AiTokenQuotaService quotaService;

    public StorefrontAiPersistenceService(
            CustomerAiConversationRepository conversationRepository,
            CustomerAiMessageRepository messageRepository,
            AiTokenQuotaService quotaService
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.quotaService = quotaService;
    }

    @Transactional
    public AiDtos.CustomerAiQuotaDto saveCompletedTurn(
            UUID storeId,
            UUID userId,
            CustomerAiConversationEntity conv,
            CustomerAiMessageEntity userMsg,
            CustomerAiMessageEntity assistantMsg,
            int promptTokens,
            int completionTokens,
            String replyText
    ) {
        AiDtos.CustomerAiQuotaDto quota = quotaService.recordUsage(
                storeId,
                userId,
                promptTokens,
                completionTokens,
                replyText
        );
        conversationRepository.save(conv);
        messageRepository.save(userMsg);
        messageRepository.save(assistantMsg);
        return quota;
    }
}
