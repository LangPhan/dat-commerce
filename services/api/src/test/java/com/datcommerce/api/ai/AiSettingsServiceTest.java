package com.datcommerce.api.ai;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiSettingsServiceTest {

    private StoreRepository storeRepository;
    private AuditLogService auditLogService;
    private MockAiModelGateway mockGateway;
    private NineRouterAiGateway nineRouterGateway;
    private AppProperties appProperties;
    private AiSettingsService service;
    private UUID storeId;
    private StoreEntity store;
    private AuthenticatedUser actor;

    @BeforeEach
    void setUp() {
        storeRepository = Mockito.mock(StoreRepository.class);
        auditLogService = Mockito.mock(AuditLogService.class);
        ObjectMapper mapper = new ObjectMapper();
        mockGateway = new MockAiModelGateway(mapper);
        appProperties = new AppProperties();
        appProperties.getAi().setGatewayMode("mock");
        appProperties.getAi().setDefaultModel("gpt-6-luna");
        appProperties.getAi().setFastTaskModel("forma-fast");
        nineRouterGateway = Mockito.mock(NineRouterAiGateway.class);
        service = new AiSettingsService(storeRepository, mockGateway, nineRouterGateway, appProperties, auditLogService);

        storeId = UUID.randomUUID();
        store = new StoreEntity();
        store.setId(storeId);
        store.setSettingsJson(new LinkedHashMap<>(Map.of("currencyDisplay", "symbol")));

        actor = new AuthenticatedUser(
                UUID.randomUUID(),
                storeId,
                "owner@terrain.test",
                "Terrain Owner",
                List.of("OWNER"),
                List.of("ai:use")
        );
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(storeRepository.save(any(StoreEntity.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void returnsDefaultsWhenSettingsMissing() {
        AiDtos.AiModelSettingsDto dto = service.getSettings(storeId);
        assertTrue(dto.gatewayReachable());
        assertEquals(List.of("gpt-6-luna", "cx/gpt-6-luna", "claude-code", "forma-fast"), dto.enabledModelIds());
        assertEquals("gpt-6-luna", dto.defaultModelId());
        assertTrue(dto.availableModels().size() >= 4);
    }

    @Test
    void updatesPriorityOrderWithoutClobberingStoreSettings() {
        AiDtos.AiModelSettingsDto updated = service.updateSettings(
                actor,
                new AiDtos.UpdateAiModelSettingsRequest(List.of("claude-code", "gpt-6-luna", "claude-code"))
        );

        assertEquals(List.of("claude-code", "gpt-6-luna"), updated.enabledModelIds());
        assertEquals("claude-code", updated.defaultModelId());
        assertEquals("symbol", store.getSettingsJson().get("currencyDisplay"));
        verify(auditLogService).record(
                eq(storeId), eq(actor.userId()), eq(actor.email()),
                eq("AI_SETTINGS_UPDATED"), eq("STORE"), eq(storeId.toString()),
                any(), any(), any(), eq(null)
        );
    }

    @Test
    void rejectsUnknownModelWhenGatewayIsReachable() {
        assertThrows(
                ApiException.class,
                () -> service.updateSettings(actor, new AiDtos.UpdateAiModelSettingsRequest(List.of("nonexistent-model")))
        );
    }

    @Test
    void degradesGracefullyWhenLiveGatewayFails() {
        appProperties.getAi().setGatewayMode("9router");
        appProperties.getAi().setBaseUrl("http://127.0.0.1:20128/v1");
        when(nineRouterGateway.listAvailableModels()).thenThrow(new RuntimeException("connection refused"));

        AiDtos.AiModelSettingsDto dto = service.getSettings(storeId);
        assertTrue(!dto.gatewayReachable());
        assertEquals("gpt-6-luna", dto.defaultModelId());
    }

    @Test
    void persistsCustomerAiQuotaSettingsWithinBounds() {
        AiDtos.AiModelSettingsDto updated = service.updateSettings(
                actor,
                new AiDtos.UpdateAiModelSettingsRequest(
                        List.of("gpt-6-luna", "claude-code"),
                        false,
                        35000,
                        "claude-code"
                )
        );
        assertTrue(!updated.customerAiEnabled());
        assertEquals(35000, updated.dailyTokenLimitPerUser());
        assertEquals("claude-code", updated.customerAiModelId());

        AiSettingsService.CustomerAiConfig cfg = service.getCustomerAiConfig(storeId);
        assertTrue(!cfg.enabled());
        assertEquals(35000, cfg.dailyTokenLimitPerUser());
        assertEquals("claude-code", cfg.modelId());
    }
}
