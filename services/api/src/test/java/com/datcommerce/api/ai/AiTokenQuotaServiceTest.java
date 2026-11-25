package com.datcommerce.api.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.identity.AdminUserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AiTokenQuotaServiceTest {

    @Test
    void enforcesDailyQuotaBlocksOverLimitAndResetsCleanly() {
        UUID storeId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        LocalDate fixedDay = LocalDate.of(2026, 11, 25);
        Clock fixedClock = Clock.fixed(fixedDay.atTime(10, 0).toInstant(ZoneOffset.UTC), ZoneOffset.UTC);

        AiUserDailyUsageRepository repo = mock(AiUserDailyUsageRepository.class);
        AiSettingsService settings = mock(AiSettingsService.class);
        AdminUserRepository userRepo = mock(AdminUserRepository.class);
        AuditLogService audit = mock(AuditLogService.class);

        when(settings.getCustomerAiConfig(storeId))
                .thenReturn(new AiSettingsService.CustomerAiConfig(true, 5000, "gpt-6-luna"));

        AiUserDailyUsageEntity usage = new AiUserDailyUsageEntity();
        usage.setId(new AiUserDailyUsageEntity.DailyUsageId(storeId, userId, fixedDay));
        usage.setPromptTokens(2200);
        usage.setCompletionTokens(800);
        usage.setTotalTokens(3000);
        usage.setRequestCount(4);

        when(repo.findById(new AiUserDailyUsageEntity.DailyUsageId(storeId, userId, fixedDay)))
                .thenReturn(Optional.of(usage));

        AiTokenQuotaService svc = new AiTokenQuotaService(repo, settings, userRepo, audit, fixedClock);

        AiDtos.CustomerAiQuotaDto q = svc.assertCanUse(storeId, userId);
        assertEquals(5000L, q.dailyLimit());
        assertEquals(3000L, q.usedTokens());
        assertEquals(2000L, q.remainingTokens());

        // Reaching limit -> 429 RATE_LIMITED
        usage.setTotalTokens(5000);
        ApiException rateEx = assertThrows(ApiException.class, () -> svc.assertCanUse(storeId, userId));
        assertEquals(ErrorCode.RATE_LIMITED, rateEx.getCode());

        // Disabled by admin -> 403 FORBIDDEN
        when(settings.getCustomerAiConfig(storeId))
                .thenReturn(new AiSettingsService.CustomerAiConfig(false, 5000, "gpt-6-luna"));
        ApiException forbiddenEx = assertThrows(ApiException.class, () -> svc.assertCanUse(storeId, userId));
        assertEquals(ErrorCode.FORBIDDEN, forbiddenEx.getCode());

        // Recording usage estimates positive minimum if gateway returns 0
        svc.recordUsage(storeId, userId, 0, 0, "Recommended Trail Shoes");
        verify(repo).incrementDailyUsage(eq(storeId), eq(userId), eq(fixedDay), eq(0L), eq(5L), eq(5L), any(Instant.class));

        // Reset deletes today's usage row
        AuthenticatedUser admin = new AuthenticatedUser(UUID.randomUUID(), storeId, "owner@test", "Owner", List.of("OWNER"), List.of("store:write"));
        svc.resetUserTodayUsage(admin, userId);
        verify(repo).delete(usage);
    }
}
