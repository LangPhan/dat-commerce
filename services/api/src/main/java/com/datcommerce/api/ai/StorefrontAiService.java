package com.datcommerce.api.ai;

import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class StorefrontAiService {

    private static final int MAX_ROUNDS = 4;
    private static final int HISTORY_LIMIT = 8;

    private static final String SYSTEM_PROMPT = """
            You are Dat Commerce Shopping AI, a helpful storefront shopping concierge for signed-in customers.
            Capabilities & strict safety rules:
            1. Answer customer product questions accurately using ONLY live catalog data returned by shop.* tools (prices, variants, stock, specs, ratings, promotions). Never fabricate prices or availability.
            2. Make tailored product recommendations and present comparisons cleanly in Markdown (bullet lists or concise tables when helpful).
            3. When a customer asks to add a product to their cart, call `shop.add_to_cart` with the resolved `variantId` (or `productSlug` + optional `sku`) and quantity.
            4. When a customer asks to prepare/fill checkout or shipping information, call `shop.prefill_checkout`. NEVER claim an order has been placed or paid — ALWAYS tell the customer their checkout form is prefilled for review and they must click "Place order" themselves.
            5. Match the customer's language (English or Vietnamese). Keep replies clear, friendly, and concise.
            """;

    private final CustomerAiConversationRepository conversationRepository;
    private final CustomerAiMessageRepository messageRepository;
    private final StoreRepository storeRepository;
    private final AiSettingsService settingsService;
    private final AiTokenQuotaService quotaService;
    private final StorefrontAiToolService toolService;
    private final MockAiModelGateway mockGateway;
    private final NineRouterAiGateway nineRouterGateway;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    @Autowired
    public StorefrontAiService(
            CustomerAiConversationRepository conversationRepository,
            CustomerAiMessageRepository messageRepository,
            StoreRepository storeRepository,
            AiSettingsService settingsService,
            AiTokenQuotaService quotaService,
            StorefrontAiToolService toolService,
            MockAiModelGateway mockGateway,
            NineRouterAiGateway nineRouterGateway,
            AppProperties appProperties,
            ObjectMapper objectMapper
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.storeRepository = storeRepository;
        this.settingsService = settingsService;
        this.quotaService = quotaService;
        this.toolService = toolService;
        this.mockGateway = mockGateway;
        this.nineRouterGateway = nineRouterGateway;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
    }

    private UUID defaultStoreId() {
        return storeRepository.findByCode("terrain-supply")
                .map(StoreEntity::getId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not initialized"));
    }

    @Transactional(readOnly = true)
    public AiDtos.CustomerAiQuotaDto getQuota(AuthenticatedUser actor) {
        return quotaService.getQuotaStatus(defaultStoreId(), actor.userId());
    }

    @Transactional(readOnly = true)
    public List<AiDtos.CustomerConversationSummaryDto> listConversations(AuthenticatedUser actor) {
        return conversationRepository
                .findAllByStoreIdAndUserIdOrderByUpdatedAtDesc(defaultStoreId(), actor.userId())
                .stream()
                .map(AiDtos.CustomerConversationSummaryDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public AiDtos.CustomerConversationDetailDto getConversation(AuthenticatedUser actor, UUID conversationId) {
        UUID storeId = defaultStoreId();
        CustomerAiConversationEntity conv = conversationRepository
                .findByIdAndStoreIdAndUserId(conversationId, storeId, actor.userId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Conversation not found"));
        List<AiDtos.CustomerMessageDto> msgs = messageRepository
                .findAllByConversationIdOrderByCreatedAtAsc(conv.getId())
                .stream()
                .map(this::toMessageDto)
                .toList();
        return new AiDtos.CustomerConversationDetailDto(
                AiDtos.CustomerConversationSummaryDto.from(conv),
                msgs,
                quotaService.getQuotaStatus(storeId, actor.userId())
        );
    }

    @Transactional
    public void deleteConversation(AuthenticatedUser actor, UUID conversationId) {
        UUID storeId = defaultStoreId();
        CustomerAiConversationEntity conv = conversationRepository
                .findByIdAndStoreIdAndUserId(conversationId, storeId, actor.userId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Conversation not found"));
        conversationRepository.delete(conv);
    }

    @Transactional
    public AiDtos.StorefrontChatResponse chat(
            AuthenticatedUser actor,
            String cartSessionToken,
            AiDtos.StorefrontChatRequest request
    ) {
        if (request == null || !StringUtils.hasText(request.message())) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Message is required");
        }
        UUID storeId = defaultStoreId();
        AiDtos.CustomerAiQuotaDto quotaBefore = quotaService.assertCanUse(storeId, actor.userId());

        String modelId = StringUtils.hasText(quotaBefore.modelId())
                ? quotaBefore.modelId()
                : settingsService.getSettings(storeId).defaultModelId();
        Instant now = Instant.now();

        CustomerAiConversationEntity conv;
        List<CustomerAiMessageEntity> existingMessages;
        if (request.conversationId() != null) {
            conv = conversationRepository
                    .findByIdAndStoreIdAndUserId(request.conversationId(), storeId, actor.userId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Conversation not found"));
            existingMessages = messageRepository.findAllByConversationIdOrderByCreatedAtAsc(conv.getId());
        } else {
            conv = new CustomerAiConversationEntity();
            conv.setId(UUID.randomUUID());
            conv.setStoreId(storeId);
            conv.setUserId(actor.userId());
            conv.setTitle(deriveTitle(request.message()));
            conv.setModel(modelId);
            conv.setCreatedAt(now);
            conv.setUpdatedAt(now);
            conversationRepository.save(conv);
            existingMessages = List.of();
        }

        List<AiModelGateway.GatewayMessage> gatewayMessages = new ArrayList<>();
        StringBuilder sysBuilder = new StringBuilder(SYSTEM_PROMPT);
        sysBuilder.append("\nCustomer context: fullName=").append(nullSafe(actor.fullName()))
                .append(", email=").append(nullSafe(actor.email()));
        if (StringUtils.hasText(request.currentPath())) {
            sysBuilder.append(", currentPath=").append(request.currentPath().trim());
        }
        if (StringUtils.hasText(request.productSlug())) {
            sysBuilder.append(", viewingProductSlug=").append(request.productSlug().trim());
        }
        gatewayMessages.add(AiModelGateway.GatewayMessage.system(sysBuilder.toString()));

        int startIdx = Math.max(0, existingMessages.size() - HISTORY_LIMIT);
        for (int i = startIdx; i < existingMessages.size(); i++) {
            CustomerAiMessageEntity m = existingMessages.get(i);
            if ("assistant".equalsIgnoreCase(m.getRole())) {
                gatewayMessages.add(AiModelGateway.GatewayMessage.assistant(m.getContent(), List.of()));
            } else {
                gatewayMessages.add(AiModelGateway.GatewayMessage.user(m.getContent()));
            }
        }
        String cleanMessage = request.message().trim();
        gatewayMessages.add(AiModelGateway.GatewayMessage.user(cleanMessage));

        Map<String, Object> gatewayContext = new LinkedHashMap<>();
        gatewayContext.put("mode", "storefront_chat");
        gatewayContext.put("customerName", nullSafe(actor.fullName()));
        gatewayContext.put("customerEmail", nullSafe(actor.email()));
        if (StringUtils.hasText(request.currentPath())) {
            gatewayContext.put("currentPath", request.currentPath().trim());
        }
        if (StringUtils.hasText(request.productSlug())) {
            gatewayContext.put("productSlug", request.productSlug().trim());
        }

        AiModelGateway gateway = selectGateway();
        List<AiModelGateway.ToolDefinition> tools = toolService.toolDefinitions();
        StorefrontAiToolService.TurnSideEffects sideEffects = new StorefrontAiToolService.TurnSideEffects(cartSessionToken);

        int totalPromptTokens = 0;
        int totalCompletionTokens = 0;
        AiModelGateway.GatewayTurnResponse turn = null;

        for (int round = 0; round < MAX_ROUNDS; round++) {
            List<AiModelGateway.ToolDefinition> roundTools = (round < MAX_ROUNDS - 1) ? tools : List.of();
            turn = gateway.generateTurn(new AiModelGateway.GatewayRequest(
                    modelId,
                    gatewayMessages,
                    roundTools,
                    gatewayContext,
                    1600,
                    round
            ));
            totalPromptTokens += turn.promptTokens();
            totalCompletionTokens += turn.completionTokens();

            if (turn.toolCalls() == null || turn.toolCalls().isEmpty() || round == MAX_ROUNDS - 1) {
                break;
            }

            gatewayMessages.add(AiModelGateway.GatewayMessage.assistant(turn.content(), turn.toolCalls()));
            for (AiModelGateway.GatewayToolCall tc : turn.toolCalls()) {
                if (!StorefrontAiToolService.ALLOWED_TOOL_NAMES.contains(tc.toolName())) {
                    gatewayMessages.add(AiModelGateway.GatewayMessage.toolResult(
                            tc.callId(), tc.toolName(), "{\"error\":\"Tool not permitted in storefront chat\"}"
                    ));
                    continue;
                }
                String toolResultJson = toolService.executeTool(
                        storeId,
                        actor,
                        tc.toolName(),
                        tc.arguments(),
                        sideEffects
                );
                gatewayMessages.add(AiModelGateway.GatewayMessage.toolResult(
                        tc.callId(), tc.toolName(), toolResultJson
                ));
            }
        }

        String finalReply = (turn != null && StringUtils.hasText(turn.content()))
                ? turn.content().trim()
                : buildFallbackReply(sideEffects);

        AiDtos.CustomerAiQuotaDto quotaAfter = quotaService.recordUsage(
                storeId,
                actor.userId(),
                totalPromptTokens,
                totalCompletionTokens,
                finalReply
        );

        CustomerAiMessageEntity userMsg = new CustomerAiMessageEntity();
        userMsg.setId(UUID.randomUUID());
        userMsg.setConversationId(conv.getId());
        userMsg.setRole("user");
        userMsg.setContent(cleanMessage);
        userMsg.setProductsJson(List.of());
        userMsg.setActionsJson(List.of());
        userMsg.setPromptTokens(0);
        userMsg.setCompletionTokens(0);
        userMsg.setCreatedAt(now);
        messageRepository.save(userMsg);

        List<AiDtos.StorefrontProductRecommendationDto> recs = sideEffects.recommendedProducts();
        List<Map<String, Object>> actionsJson = new ArrayList<>();
        if (sideEffects.checkoutPrefill() != null) {
            actionsJson.add(Map.of(
                    "type", "checkout_prefill",
                    "payload", objectMapper.convertValue(sideEffects.checkoutPrefill(), new TypeReference<Map<String, Object>>() {})
            ));
        }
        if (sideEffects.updatedCart() != null) {
            actionsJson.add(Map.of(
                    "type", "cart_updated",
                    "itemCount", sideEffects.updatedCart().items().stream().mapToInt(item -> item.quantity()).sum()
            ));
        }

        CustomerAiMessageEntity assistantMsg = new CustomerAiMessageEntity();
        assistantMsg.setId(UUID.randomUUID());
        assistantMsg.setConversationId(conv.getId());
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(finalReply);
        assistantMsg.setProductsJson(objectMapper.convertValue(recs, new TypeReference<>() {}));
        assistantMsg.setActionsJson(actionsJson);
        assistantMsg.setPromptTokens(totalPromptTokens);
        assistantMsg.setCompletionTokens(totalCompletionTokens);
        assistantMsg.setModel(modelId);
        assistantMsg.setCreatedAt(Instant.now());
        messageRepository.save(assistantMsg);

        conv.setUpdatedAt(Instant.now());
        conversationRepository.save(conv);

        return new AiDtos.StorefrontChatResponse(
                conv.getId(),
                finalReply,
                modelId,
                totalPromptTokens,
                totalCompletionTokens,
                recs,
                sideEffects.updatedCart(),
                sideEffects.checkoutPrefill(),
                false,
                quotaAfter
        );
    }

    private AiModelGateway selectGateway() {
        String mode = appProperties.getAi().getGatewayMode();
        boolean useLive = ("9router".equalsIgnoreCase(mode) || "live".equalsIgnoreCase(mode))
                && StringUtils.hasText(appProperties.getAi().getBaseUrl())
                && StringUtils.hasText(appProperties.getAi().getApiKey());
        return useLive ? nineRouterGateway : mockGateway;
    }

    private AiDtos.CustomerMessageDto toMessageDto(CustomerAiMessageEntity e) {
        List<AiDtos.StorefrontProductRecommendationDto> recs = List.of();
        if (e.getProductsJson() != null && !e.getProductsJson().isEmpty()) {
            recs = objectMapper.convertValue(e.getProductsJson(), new TypeReference<>() {});
        }
        AiDtos.CheckoutPrefillDto prefill = null;
        if (e.getActionsJson() != null) {
            for (Map<String, Object> action : e.getActionsJson()) {
                if ("checkout_prefill".equals(action.get("type")) && action.get("payload") != null) {
                    prefill = objectMapper.convertValue(action.get("payload"), AiDtos.CheckoutPrefillDto.class);
                    break;
                }
            }
        }
        return new AiDtos.CustomerMessageDto(
                e.getId(),
                e.getRole(),
                e.getContent(),
                e.getModel(),
                e.getPromptTokens(),
                e.getCompletionTokens(),
                recs,
                prefill,
                e.getCreatedAt()
        );
    }

    private static String deriveTitle(String message) {
        String clean = message.trim().replaceAll("\\s+", " ");
        return clean.length() <= 72 ? clean : clean.substring(0, 69) + "...";
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private static String buildFallbackReply(StorefrontAiToolService.TurnSideEffects effects) {
        if (effects.checkoutPrefill() != null) {
            return "I have prefilled your checkout details for review. Please click **Review & Place Order** to verify your information and submit your order.";
        }
        if (effects.updatedCart() != null) {
            return "Added the item to your shopping cart.";
        }
        if (!effects.recommendedProducts().isEmpty()) {
            return "Here are the matching products from our store catalog.";
        }
        return "How can I help you shop today?";
    }
}
