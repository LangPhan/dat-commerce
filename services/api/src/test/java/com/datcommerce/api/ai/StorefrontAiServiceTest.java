package com.datcommerce.api.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.datcommerce.api.cart.CartService;
import com.datcommerce.api.catalog.CatalogDtos;
import com.datcommerce.api.catalog.CatalogStoreService;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.promotion.PromotionRepository;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class StorefrontAiServiceTest {

    private CustomerAiConversationRepository conversationRepository;
    private CustomerAiMessageRepository messageRepository;
    private StoreRepository storeRepository;
    private AiSettingsService settingsService;
    private AiTokenQuotaService quotaService;
    private CatalogStoreService catalogStoreService;
    private CartService cartService;
    private PromotionRepository promotionRepository;
    private StorefrontAiService service;

    private UUID storeId;
    private AuthenticatedUser customer;
    private CatalogDtos.ProductDto sampleProduct;
    private UUID variantId;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(CustomerAiConversationRepository.class);
        messageRepository = mock(CustomerAiMessageRepository.class);
        storeRepository = mock(StoreRepository.class);
        settingsService = mock(AiSettingsService.class);
        quotaService = mock(AiTokenQuotaService.class);
        catalogStoreService = mock(CatalogStoreService.class);
        cartService = mock(CartService.class);
        promotionRepository = mock(PromotionRepository.class);

        ObjectMapper mapper = new ObjectMapper();
        StorefrontAiToolService toolService = new StorefrontAiToolService(
                catalogStoreService, cartService, promotionRepository, mapper
        );
        MockAiModelGateway mockGateway = new MockAiModelGateway(mapper);
        NineRouterAiGateway nineGateway = mock(NineRouterAiGateway.class);
        AppProperties props = new AppProperties();
        props.getAi().setGatewayMode("mock");

        service = new StorefrontAiService(
                conversationRepository,
                messageRepository,
                storeRepository,
                settingsService,
                quotaService,
                toolService,
                mockGateway,
                nineGateway,
                props,
                mapper
        );

        storeId = UUID.randomUUID();
        StoreEntity store = new StoreEntity();
        store.setId(storeId);
        store.setCode("terrain-supply");
        when(storeRepository.findByCode("terrain-supply")).thenReturn(Optional.of(store));

        customer = new AuthenticatedUser(
                UUID.randomUUID(),
                storeId,
                "customer@datcommerce.local",
                "Samir Patel",
                List.of(),
                List.of()
        );

        UUID prodId = UUID.randomUUID();
        variantId = UUID.randomUUID();
        sampleProduct = new CatalogDtos.ProductDto(
                prodId,
                UUID.randomUUID(),
                "Running Shoes",
                "running-shoes",
                "trail-blazer-gtx",
                "Trail Blazer GTX",
                "Terrain",
                "Waterproof GTX trail running shoe",
                "ACTIVE",
                "/media/shoe.jpg",
                List.of(),
                null,
                null,
                new BigDecimal("4.8"),
                24,
                new BigDecimal("149.00"),
                new BigDecimal("149.00"),
                null,
                12,
                List.of(new CatalogDtos.CategoryRefDto(UUID.randomUUID(), "running-shoes", "Running Shoes")),
                List.of(),
                List.of(new CatalogDtos.VariantDto(
                        variantId, "TB-GTX-42", "EU 42 / Moss", "ACTIVE",
                        new BigDecimal("149.00"), null, "USD", 12, Map.of("size", "42"), 1L
                )),
                1L,
                Instant.now(),
                Instant.now()
        );
    }

    @Test
    void recommendsProductsAddToCartAndRecordsQuota() {
        when(quotaService.assertCanUse(storeId, customer.userId())).thenReturn(
                new AiDtos.CustomerAiQuotaDto(true, 20000, 0, 20000, 0, Instant.now().plusSeconds(3600), "gpt-6-luna")
        );
        when(quotaService.recordUsage(eq(storeId), eq(customer.userId()), anyInt(), anyInt(), anyString()))
                .thenReturn(new AiDtos.CustomerAiQuotaDto(true, 20000, 292, 19708, 1, Instant.now().plusSeconds(3600), "gpt-6-luna"));
        when(catalogStoreService.listProducts(any(), any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(new CatalogDtos.StoreProductListResponse(List.of(sampleProduct), 0, 4, 1, 1, List.of()));
        CartService.CartResponse updatedCart = new CartService.CartResponse(
                UUID.randomUUID(), "sess-123", "USD", null,
                new BigDecimal("149.00"), BigDecimal.ZERO, BigDecimal.ZERO,
                new BigDecimal("100.00"), new BigDecimal("149.00"),
                List.of(new CartService.CartLineDto(
                        variantId, sampleProduct.id(), sampleProduct.slug(), sampleProduct.name(),
                        "EU 42 / Moss", "TB-GTX-42", "/media/shoe.jpg",
                        new BigDecimal("149.00"), 1, new BigDecimal("149.00"), 12
                ))
        );
        when(cartService.addItem(any(), any())).thenReturn(updatedCart);

        AiDtos.StorefrontChatResponse res = service.chat(
                customer,
                null,
                new AiDtos.StorefrontChatRequest(null, "Add to cart Trail Blazer GTX", "/", null)
        );

        assertThat(res.recommendedProducts()).hasSize(1);
        assertThat(res.updatedCart()).isNotNull();
        assertThat(res.updatedCart().sessionToken()).isEqualTo("sess-123");
        assertThat(res.checkoutAutoSubmit()).isFalse();
        assertThat(res.quota().usedTokens()).isEqualTo(292L);
        verify(quotaService).recordUsage(eq(storeId), eq(customer.userId()), anyInt(), anyInt(), anyString());
    }

    @Test
    void prefillsCheckoutSafelyWithoutAutoSubmit() {
        when(quotaService.assertCanUse(storeId, customer.userId())).thenReturn(
                new AiDtos.CustomerAiQuotaDto(true, 20000, 100, 19900, 1, Instant.now().plusSeconds(3600), "gpt-6-luna")
        );
        when(quotaService.recordUsage(eq(storeId), eq(customer.userId()), anyInt(), anyInt(), anyString()))
                .thenReturn(new AiDtos.CustomerAiQuotaDto(true, 20000, 256, 19744, 2, Instant.now().plusSeconds(3600), "gpt-6-luna"));

        AiDtos.StorefrontChatResponse res = service.chat(
                customer,
                "sess-1",
                new AiDtos.StorefrontChatRequest(null, "Prefill checkout to 123 Nguyen Hue Ho Chi Minh City", "/store/cart", null)
        );

        assertThat(res.checkoutPrefill()).isNotNull();
        assertThat(res.checkoutPrefill().customerEmail()).isEqualTo("customer@datcommerce.local");
        assertThat(res.checkoutPrefill().line1()).isEqualTo("123 Nguyen Hue");
        assertThat(res.checkoutAutoSubmit()).isFalse();
        assertThat(res.reply()).contains("Review & Place Order");
    }

    @Test
    void blocksChatImmediatelyWhenDailyQuotaIsExhausted() {
        when(quotaService.assertCanUse(storeId, customer.userId())).thenThrow(
                new ApiException(ErrorCode.RATE_LIMITED, "Daily AI token limit reached")
        );

        assertThatThrownBy(() -> service.chat(
                customer,
                null,
                new AiDtos.StorefrontChatRequest(null, "Recommend shoes", "/", null)
        ))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getCode())
                .isEqualTo(ErrorCode.RATE_LIMITED);

        verifyNoInteractions(catalogStoreService, cartService);
    }

    @Test
    void rejectsCrossUserConversationAccess() {
        UUID foreignConvId = UUID.randomUUID();
        when(conversationRepository.findByIdAndStoreIdAndUserId(foreignConvId, storeId, customer.userId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getConversation(customer, foreignConvId))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }
}
