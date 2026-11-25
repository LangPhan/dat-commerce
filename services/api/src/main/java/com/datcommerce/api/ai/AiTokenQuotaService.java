package com.datcommerce.api.ai;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.identity.AdminUserEntity;
import com.datcommerce.api.identity.AdminUserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AiTokenQuotaService {

    public static final int DEFAULT_DAILY_TOKEN_LIMIT = 20_000;

    private final AiUserDailyUsageRepository usageRepository;
    private final AiSettingsService settingsService;
    private final AdminUserRepository userRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;

    @Autowired
    public AiTokenQuotaService(
            AiUserDailyUsageRepository usageRepository,
            AiSettingsService settingsService,
            AdminUserRepository userRepository,
            AuditLogService auditLogService
    ) {
        this(usageRepository, settingsService, userRepository, auditLogService, Clock.systemUTC());
    }

    AiTokenQuotaService(
            AiUserDailyUsageRepository usageRepository,
            AiSettingsService settingsService,
            AdminUserRepository userRepository,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.usageRepository = usageRepository;
        this.settingsService = settingsService;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AiDtos.CustomerAiQuotaDto getQuotaStatus(UUID storeId, UUID userId) {
        AiSettingsService.CustomerAiConfig cfg = settingsService.getCustomerAiConfig(storeId);
        LocalDate today = LocalDate.now(clock);
        AiUserDailyUsageEntity usage = usageRepository
                .findById(new AiUserDailyUsageEntity.DailyUsageId(storeId, userId, today))
                .orElse(null);

        long used = usage != null ? usage.getTotalTokens() : 0L;
        int reqCount = usage != null ? usage.getRequestCount() : 0;
        long limit = Math.max(1000L, cfg.dailyTokenLimitPerUser());
        long remaining = Math.max(0L, limit - used);
        Instant resetsAt = today.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        return new AiDtos.CustomerAiQuotaDto(
                cfg.enabled(),
                limit,
                used,
                remaining,
                reqCount,
                resetsAt,
                cfg.modelId()
        );
    }

    @Transactional(readOnly = true)
    public AiDtos.CustomerAiQuotaDto assertCanUse(UUID storeId, UUID userId) {
        AiDtos.CustomerAiQuotaDto status = getQuotaStatus(storeId, userId);
        if (!status.enabled()) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    "Storefront Shopping AI is currently disabled by the store administrator"
            );
        }
        if (status.remainingTokens() <= 0L) {
            throw new ApiException(
                    ErrorCode.RATE_LIMITED,
                    "Daily AI token limit reached (" + status.usedTokens() + " / " + status.dailyLimit()
                            + " tokens used today). Quota resets at " + status.resetsAt() + "."
            );
        }
        return status;
    }

    @Transactional
    public AiDtos.CustomerAiQuotaDto recordUsage(
            UUID storeId,
            UUID userId,
            int promptTokens,
            int completionTokens,
            String fallbackText
    ) {
        long safePrompt = Math.max(0L, promptTokens);
        long safeCompletion = Math.max(0L, completionTokens);
        if (safePrompt + safeCompletion == 0L) {
            int approx = StringUtils.hasText(fallbackText) ? Math.max(1, fallbackText.length() / 4) : 1;
            safeCompletion = approx;
        }
        long total = safePrompt + safeCompletion;
        LocalDate today = LocalDate.now(clock);
        usageRepository.incrementDailyUsage(
                storeId,
                userId,
                today,
                safePrompt,
                safeCompletion,
                total,
                Instant.now(clock)
        );
        return getQuotaStatus(storeId, userId);
    }

    @Transactional(readOnly = true)
    public List<AiDtos.AdminCustomerUsageRowDto> listTodayUsage(UUID storeId) {
        LocalDate today = LocalDate.now(clock);
        AiSettingsService.CustomerAiConfig cfg = settingsService.getCustomerAiConfig(storeId);
        List<AiUserDailyUsageEntity> rows =
                usageRepository.findAllByIdStoreIdAndIdUsageDateOrderByTotalTokensDesc(storeId, today);
        if (rows.isEmpty()) {
            return List.of();
        }
        List<UUID> userIds = rows.stream().map(r -> r.getId().getUserId()).toList();
        Map<UUID, AdminUserEntity> usersById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(AdminUserEntity::getId, u -> u, (a, b) -> a));

        return rows.stream().map(r -> {
            UUID uid = r.getId().getUserId();
            AdminUserEntity u = usersById.get(uid);
            return new AiDtos.AdminCustomerUsageRowDto(
                    uid,
                    u != null ? u.getFullName() : "Unknown user",
                    u != null ? u.getEmail() : uid.toString(),
                    u != null && (u.getRoles() == null || u.getRoles().isEmpty()) ? "CUSTOMER" : "STAFF",
                    r.getPromptTokens(),
                    r.getCompletionTokens(),
                    r.getTotalTokens(),
                    cfg.dailyTokenLimitPerUser(),
                    r.getRequestCount(),
                    r.getUpdatedAt()
            );
        }).toList();
    }

    @Transactional
    public void resetUserTodayUsage(AuthenticatedUser actor, UUID targetUserId) {
        LocalDate today = LocalDate.now(clock);
        AiUserDailyUsageEntity.DailyUsageId id =
                new AiUserDailyUsageEntity.DailyUsageId(actor.storeId(), targetUserId, today);
        usageRepository.findById(id).ifPresent(usageRepository::delete);

        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "AI_CUSTOMER_QUOTA_RESET",
                "AI_QUOTA",
                targetUserId.toString(),
                null,
                Map.of("usageDate", today.toString(), "remainingResetToFull", true),
                Map.of("targetUserId", targetUserId.toString()),
                null
        );
    }
}
