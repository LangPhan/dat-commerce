package com.datcommerce.api.promotion;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final PromotionTargetRepository targetRepository;
    private final AuditLogService auditLogService;

    public PromotionService(
            PromotionRepository promotionRepository,
            PromotionTargetRepository targetRepository,
            AuditLogService auditLogService
    ) {
        this.promotionRepository = promotionRepository;
        this.targetRepository = targetRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<PromotionDto> list(UUID storeId) {
        List<PromotionEntity> all = promotionRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
        if (all.isEmpty()) return List.of();
        List<UUID> ids = all.stream().map(PromotionEntity::getId).toList();
        Map<UUID, List<UUID>> targetsByPromo = targetRepository.findAllByPromotionIdIn(ids).stream()
                .collect(Collectors.groupingBy(
                        PromotionTargetEntity::getPromotionId,
                        Collectors.mapping(PromotionTargetEntity::getTargetId, Collectors.toList())
                ));
        return all.stream()
                .map(p -> PromotionDto.from(p, targetsByPromo.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    @Transactional
    public PromotionDto create(AuthenticatedUser actor, CreatePromotionRequest req) {
        String code = req.code().trim().toUpperCase(Locale.ROOT);
        if (promotionRepository.findByStoreIdAndCodeIgnoreCase(actor.storeId(), code).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Promotion code already exists: " + code);
        }
        String type = normalizeType(req.type());
        if ("PERCENTAGE".equals(type) && req.value().compareTo(new BigDecimal("100")) > 0) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Percentage discount cannot exceed 100%");
        }
        if (req.endsAt().isBefore(req.startsAt())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "endsAt must be after startsAt");
        }
        String scopeType = normalizeScope(req.scopeType());

        Instant now = Instant.now();
        PromotionEntity entity = new PromotionEntity();
        entity.setId(UUID.randomUUID());
        entity.setStoreId(actor.storeId());
        entity.setCode(code);
        entity.setName(req.name().trim());
        entity.setType(type);
        entity.setValue(req.value());
        entity.setScopeType(scopeType);
        entity.setStartsAt(req.startsAt());
        entity.setEndsAt(req.endsAt());
        entity.setUsageLimit(req.usageLimit());
        entity.setPerCustomerLimit(req.perCustomerLimit());
        entity.setUsedCount(0);
        entity.setStackable(req.stackable());
        entity.setStatus(normalizeStatus(req.status(), "ACTIVE"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        PromotionEntity saved = promotionRepository.save(entity);

        saveTargets(saved.getId(), scopeType, req.targetIds());

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "PROMOTION_CREATED", "PROMOTION", saved.getId().toString(),
                null, Map.of("code", saved.getCode(), "type", saved.getType(), "value", saved.getValue()), Map.of(), null
        );
        return PromotionDto.from(saved, req.targetIds() != null ? req.targetIds() : List.of());
    }

    @Transactional
    public PromotionDto update(AuthenticatedUser actor, UUID promotionId, UpdatePromotionRequest req) {
        PromotionEntity entity = promotionRepository.findByIdAndStoreId(promotionId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Promotion not found"));

        if (StringUtils.hasText(req.name())) entity.setName(req.name().trim());
        if (StringUtils.hasText(req.type())) entity.setType(normalizeType(req.type()));
        if (req.value() != null) {
            if ("PERCENTAGE".equals(entity.getType()) && req.value().compareTo(new BigDecimal("100")) > 0) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Percentage discount cannot exceed 100%");
            }
            entity.setValue(req.value());
        }
        if (StringUtils.hasText(req.scopeType())) entity.setScopeType(normalizeScope(req.scopeType()));
        if (req.startsAt() != null) entity.setStartsAt(req.startsAt());
        if (req.endsAt() != null) entity.setEndsAt(req.endsAt());
        if (entity.getEndsAt().isBefore(entity.getStartsAt())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "endsAt must be after startsAt");
        }
        if (req.usageLimit() != null) entity.setUsageLimit(req.usageLimit());
        if (req.perCustomerLimit() != null) entity.setPerCustomerLimit(req.perCustomerLimit());
        if (StringUtils.hasText(req.status())) entity.setStatus(normalizeStatus(req.status(), entity.getStatus()));
        entity.setUpdatedAt(Instant.now());
        PromotionEntity saved = promotionRepository.save(entity);

        if (req.targetIds() != null) {
            saveTargets(promotionId, saved.getScopeType(), req.targetIds());
        }

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "PROMOTION_UPDATED", "PROMOTION", saved.getId().toString(),
                null, Map.of("code", saved.getCode(), "status", saved.getStatus()), Map.of(), null
        );
        List<UUID> targetIds = targetRepository.findAllByPromotionId(promotionId).stream()
                .map(PromotionTargetEntity::getTargetId).toList();
        return PromotionDto.from(saved, targetIds);
    }

    private void saveTargets(UUID promotionId, String scopeType, List<UUID> targetIds) {
        targetRepository.deleteAllByPromotionId(promotionId);
        targetRepository.flush();
        if ("ALL".equals(scopeType) || targetIds == null || targetIds.isEmpty()) return;
        List<PromotionTargetEntity> targets = new ArrayList<>();
        for (UUID tid : targetIds.stream().distinct().toList()) {
            PromotionTargetEntity t = new PromotionTargetEntity();
            t.setId(UUID.randomUUID());
            t.setPromotionId(promotionId);
            t.setTargetType(scopeType);
            t.setTargetId(tid);
            targets.add(t);
        }
        targetRepository.saveAll(targets);
    }

    private static String normalizeType(String type) {
        String upper = type.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PERCENTAGE", "FIXED_AMOUNT").contains(upper)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Promotion type must be PERCENTAGE or FIXED_AMOUNT");
        }
        return upper;
    }

    private static String normalizeScope(String scope) {
        if (!StringUtils.hasText(scope)) return "ALL";
        String upper = scope.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ALL", "CATEGORY", "PRODUCT").contains(upper)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "scopeType must be ALL, CATEGORY, or PRODUCT");
        }
        return upper;
    }

    private static String normalizeStatus(String status, String fallback) {
        if (!StringUtils.hasText(status)) return fallback;
        String upper = status.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("DRAFT", "ACTIVE", "PAUSED").contains(upper)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Invalid promotion status: " + status);
        }
        return upper;
    }

    public record CreatePromotionRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9_-]+$") @Size(max = 64) String code,
            @NotBlank @Size(max = 160) String name,
            @NotBlank String type,
            @NotNull @DecimalMin("0.01") BigDecimal value,
            String scopeType,
            @NotNull Instant startsAt,
            @NotNull Instant endsAt,
            Integer usageLimit,
            Integer perCustomerLimit,
            boolean stackable,
            String status,
            List<UUID> targetIds
    ) {
    }

    public record UpdatePromotionRequest(
            @Size(min = 1, max = 160) String name,
            String type,
            @DecimalMin("0.01") BigDecimal value,
            String scopeType,
            Instant startsAt,
            Instant endsAt,
            Integer usageLimit,
            Integer perCustomerLimit,
            String status,
            List<UUID> targetIds
    ) {
    }

    public record PromotionDto(
            UUID id,
            String code,
            String name,
            String type,
            BigDecimal value,
            String scopeType,
            Instant startsAt,
            Instant endsAt,
            Integer usageLimit,
            Integer perCustomerLimit,
            int usedCount,
            boolean stackable,
            String status,
            List<UUID> targetIds,
            Instant updatedAt
    ) {
        static PromotionDto from(PromotionEntity e, List<UUID> targetIds) {
            return new PromotionDto(
                    e.getId(), e.getCode(), e.getName(), e.getType(), e.getValue(),
                    e.getScopeType(), e.getStartsAt(), e.getEndsAt(),
                    e.getUsageLimit(), e.getPerCustomerLimit(), e.getUsedCount(),
                    e.isStackable(), e.getStatus(), targetIds, e.getUpdatedAt()
            );
        }
    }
}
