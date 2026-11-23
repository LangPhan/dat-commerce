package com.datcommerce.api.audit;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLogEntity, UUID> {

    @Query("""
            SELECT a FROM AuditLogEntity a
            WHERE a.storeId = :storeId
              AND (:action IS NULL OR a.action = :action)
              AND (:resourceType IS NULL OR a.resourceType = :resourceType)
            ORDER BY a.createdAt DESC
            """)
    Page<AuditLogEntity> findFiltered(
            @Param("storeId") UUID storeId,
            @Param("action") String action,
            @Param("resourceType") String resourceType,
            Pageable pageable
    );
}
