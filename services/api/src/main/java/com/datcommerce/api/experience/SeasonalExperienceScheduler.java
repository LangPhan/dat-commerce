package com.datcommerce.api.experience;

import com.datcommerce.api.audit.AuditLogService;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SeasonalExperienceScheduler {

    private static final Logger log = LoggerFactory.getLogger(SeasonalExperienceScheduler.class);

    private final SeasonalExperienceRepository experienceRepository;
    private final SeasonalExperienceVersionRepository versionRepository;
    private final SeasonalExperienceService experienceService;
    private final AuditLogService auditLogService;

    public SeasonalExperienceScheduler(
            SeasonalExperienceRepository experienceRepository,
            SeasonalExperienceVersionRepository versionRepository,
            SeasonalExperienceService experienceService,
            AuditLogService auditLogService
    ) {
        this.experienceRepository = experienceRepository;
        this.versionRepository = versionRepository;
        this.experienceService = experienceService;
        this.auditLogService = auditLogService;
    }

    @Scheduled(fixedDelayString = "${app.experiences.scheduler-interval-ms:30000}")
    @Transactional
    public void processScheduledTransitions() {
        processScheduledTransitions(Instant.now());
    }

    @Transactional
    public void processScheduledTransitions(Instant now) {
        List<SeasonalExperienceEntity> scheduled =
                experienceRepository.findAllByActivationModeAndManualOverrideFalse("SCHEDULED");
        if (scheduled.isEmpty()) {
            return;
        }

        Set<UUID> touchedStores = new HashSet<>();

        for (SeasonalExperienceEntity exp : scheduled) {
            String status = exp.getStatus();
            Instant startsAt = exp.getStartsAt();
            Instant endsAt = exp.getEndsAt();

            // 1. Auto-activate SCHEDULED when window starts
            if ("SCHEDULED".equalsIgnoreCase(status)
                    && (startsAt == null || !startsAt.isAfter(now))
                    && (endsAt == null || endsAt.isAfter(now))) {
                if (exp.getActiveVersionId() == null) {
                    versionRepository.findTopByExperienceIdOrderByVersionNumberDesc(exp.getId())
                            .ifPresent(v -> exp.setActiveVersionId(v.getId()));
                }
                exp.setStatus("ACTIVE");
                exp.setUpdatedAt(now);
                experienceRepository.save(exp);
                touchedStores.add(exp.getStoreId());

                auditLogService.record(
                        exp.getStoreId(), null, "system:scheduler",
                        "EXPERIENCE_AUTO_ACTIVATED", "SEASONAL_EXPERIENCE", exp.getId().toString(),
                        Map.of("status", "SCHEDULED"),
                        Map.of("status", "ACTIVE", "slug", exp.getSlug()),
                        Map.of(), null
                );
                log.info("Auto-activated seasonal experience {} ({})", exp.getName(), exp.getId());
                continue;
            }

            // 2. Auto-end ACTIVE or missed-window SCHEDULED once endsAt has passed
            if (("ACTIVE".equalsIgnoreCase(status) || "SCHEDULED".equalsIgnoreCase(status))
                    && endsAt != null && !endsAt.isAfter(now)) {
                String rec = exp.getRecurrenceRule();
                if ("YEARLY".equalsIgnoreCase(rec) || "MONTHLY".equalsIgnoreCase(rec)) {
                    ZoneId zone = safeZone(exp.getTimezone());
                    if (startsAt != null) {
                        ZonedDateTime nextStart = ZonedDateTime.ofInstant(startsAt, zone);
                        ZonedDateTime nextEnd = ZonedDateTime.ofInstant(endsAt, zone);
                        while (!nextEnd.toInstant().isAfter(now)) {
                            nextStart = "YEARLY".equalsIgnoreCase(rec) ? nextStart.plusYears(1) : nextStart.plusMonths(1);
                            nextEnd = "YEARLY".equalsIgnoreCase(rec) ? nextEnd.plusYears(1) : nextEnd.plusMonths(1);
                        }
                        exp.setStartsAt(nextStart.toInstant());
                        exp.setEndsAt(nextEnd.toInstant());
                        exp.setStatus("SCHEDULED");
                    } else {
                        exp.setStatus("ENDED");
                    }
                } else {
                    exp.setStatus("ENDED");
                }
                exp.setUpdatedAt(now);
                experienceRepository.save(exp);
                touchedStores.add(exp.getStoreId());

                auditLogService.record(
                        exp.getStoreId(), null, "system:scheduler",
                        "EXPERIENCE_AUTO_ENDED", "SEASONAL_EXPERIENCE", exp.getId().toString(),
                        Map.of("status", status),
                        Map.of("status", exp.getStatus(), "slug", exp.getSlug()),
                        Map.of(), null
                );
                log.info("Auto-transitioned ended seasonal experience {} -> {}", exp.getName(), exp.getStatus());
            }
        }

        for (UUID storeId : touchedStores) {
            experienceService.evictActiveCache(storeId);
        }
    }

    private static ZoneId safeZone(String raw) {
        try {
            return ZoneId.of(raw != null ? raw : "UTC");
        } catch (Exception ex) {
            return ZoneId.of("UTC");
        }
    }
}
