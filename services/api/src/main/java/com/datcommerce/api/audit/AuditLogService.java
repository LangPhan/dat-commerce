package com.datcommerce.api.audit;

import com.datcommerce.api.common.web.PageResponse;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void record(
            UUID storeId,
            UUID actorUserId,
            String actorEmail,
            String action,
            String resourceType,
            String resourceId,
            Map<String, Object> beforeJson,
            Map<String, Object> afterJson,
            Map<String, Object> metadataJson,
            String idempotencyKey
    ) {
        AuditLogEntity entry = new AuditLogEntity();
        entry.setId(UUID.randomUUID());
        entry.setStoreId(storeId);
        entry.setActorUserId(actorUserId);
        entry.setActorEmail(actorEmail);
        entry.setAction(action);
        entry.setResourceType(resourceType);
        entry.setResourceId(resourceId);
        entry.setRequestId(MDC.get("requestId"));
        entry.setIdempotencyKey(idempotencyKey);
        entry.setBeforeJson(beforeJson);
        entry.setAfterJson(afterJson);
        entry.setMetadataJson(metadataJson != null ? metadataJson : Map.of());
        entry.setCreatedAt(Instant.now());
        auditLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> list(
            UUID storeId,
            String action,
            String resourceType,
            int page,
            int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        String actionFilter = StringUtils.hasText(action) ? action.trim() : null;
        String resourceFilter = StringUtils.hasText(resourceType) ? resourceType.trim() : null;

        var result = auditLogRepository.findFiltered(
                storeId,
                actionFilter,
                resourceFilter,
                PageRequest.of(safePage, safeSize)
        ).map(AuditLogResponse::from);

        return PageResponse.from(result);
    }

    public record AuditLogResponse(
            UUID id,
            UUID actorUserId,
            String actorEmail,
            String action,
            String resourceType,
            String resourceId,
            String requestId,
            Map<String, Object> beforeJson,
            Map<String, Object> afterJson,
            Map<String, Object> metadataJson,
            Instant createdAt
    ) {
        static AuditLogResponse from(AuditLogEntity e) {
            return new AuditLogResponse(
                    e.getId(),
                    e.getActorUserId(),
                    e.getActorEmail(),
                    e.getAction(),
                    e.getResourceType(),
                    e.getResourceId(),
                    e.getRequestId(),
                    e.getBeforeJson(),
                    e.getAfterJson(),
                    e.getMetadataJson(),
                    e.getCreatedAt()
            );
        }
    }
}
