package com.datcommerce.api.store;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StoreService {

    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;

    public StoreService(StoreRepository storeRepository, AuditLogService auditLogService) {
        this.storeRepository = storeRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public StoreResponse getStore(UUID storeId) {
        StoreEntity store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not found"));
        return StoreResponse.from(store);
    }

    @Transactional
    public StoreResponse updateStore(AuthenticatedUser actor, UpdateStoreRequest req) {
        StoreEntity store = storeRepository.findById(actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not found"));

        Map<String, Object> before = snapshot(store);

        if (req.name() != null && !req.name().isBlank()) {
            store.setName(req.name().trim());
        }
        if (req.defaultCurrency() != null && !req.defaultCurrency().isBlank()) {
            store.setDefaultCurrency(req.defaultCurrency().trim().toUpperCase());
        }
        if (req.locale() != null && !req.locale().isBlank()) {
            store.setLocale(req.locale().trim());
        }
        if (req.timezone() != null && !req.timezone().isBlank()) {
            store.setTimezone(req.timezone().trim());
        }
        if (req.contactEmail() != null) {
            store.setContactEmail(req.contactEmail().trim());
        }
        if (req.publicDomain() != null) {
            store.setPublicDomain(req.publicDomain().trim());
        }
        if (req.settingsJson() != null) {
            Map<String, Object> merged = new LinkedHashMap<>(
                    store.getSettingsJson() != null ? store.getSettingsJson() : Map.of()
            );
            merged.putAll(req.settingsJson());
            store.setSettingsJson(merged);
        }
        store.setUpdatedAt(Instant.now());

        StoreEntity saved = storeRepository.save(store);
        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "STORE_UPDATED",
                "STORE",
                saved.getId().toString(),
                before,
                snapshot(saved),
                Map.of(),
                null
        );

        return StoreResponse.from(saved);
    }

    private static Map<String, Object> snapshot(StoreEntity store) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("name", store.getName());
        map.put("defaultCurrency", store.getDefaultCurrency());
        map.put("locale", store.getLocale());
        map.put("timezone", store.getTimezone());
        map.put("contactEmail", store.getContactEmail());
        map.put("publicDomain", store.getPublicDomain());
        map.put("settingsJson", store.getSettingsJson());
        return map;
    }

    public record UpdateStoreRequest(
            @Size(min = 1, max = 160) String name,
            @Size(min = 3, max = 8) String defaultCurrency,
            @Size(min = 2, max = 16) String locale,
            @Size(min = 2, max = 64) String timezone,
            @Email @Size(max = 255) String contactEmail,
            @Size(max = 255) String publicDomain,
            Map<String, Object> settingsJson
    ) {
    }

    public record StoreResponse(
            UUID id,
            String code,
            String name,
            String defaultCurrency,
            String locale,
            String timezone,
            String contactEmail,
            String publicDomain,
            String status,
            Map<String, Object> settingsJson,
            Instant updatedAt
    ) {
        static StoreResponse from(StoreEntity s) {
            return new StoreResponse(
                    s.getId(),
                    s.getCode(),
                    s.getName(),
                    s.getDefaultCurrency(),
                    s.getLocale(),
                    s.getTimezone(),
                    s.getContactEmail(),
                    s.getPublicDomain(),
                    s.getStatus(),
                    s.getSettingsJson() != null ? s.getSettingsJson() : Map.of(),
                    s.getUpdatedAt()
            );
        }
    }
}
