package com.datcommerce.api.ai;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "ai_change_plans")
public class AiChangePlanEntity {

    @Id
    private UUID id;

    @Column(name = "store_id", nullable = false)
    private UUID storeId;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "plan_type", nullable = false, length = 64)
    private String planType;

    @Column(name = "risk_level", nullable = false, length = 16)
    private String riskLevel;

    @Column(name = "request_summary", nullable = false, columnDefinition = "text")
    private String requestSummary;

    @Column(nullable = false, length = 32)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "operations_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> operationsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "preview_json", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> previewJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "affected_resources_json", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> affectedResourcesJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rollback_snapshot_json", columnDefinition = "jsonb")
    private Map<String, Object> rollbackSnapshotJson;

    @Column(nullable = false)
    private boolean reversible;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "applied_at")
    private Instant appliedAt;

    @Column(name = "rolled_back_at")
    private Instant rolledBackAt;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getStoreId() {
        return storeId;
    }

    public void setStoreId(UUID storeId) {
        this.storeId = storeId;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public void setConversationId(UUID conversationId) {
        this.conversationId = conversationId;
    }

    public UUID getMessageId() {
        return messageId;
    }

    public void setMessageId(UUID messageId) {
        this.messageId = messageId;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }

    public String getPlanType() {
        return planType;
    }

    public void setPlanType(String planType) {
        this.planType = planType;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getRequestSummary() {
        return requestSummary;
    }

    public void setRequestSummary(String requestSummary) {
        this.requestSummary = requestSummary;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Map<String, Object> getOperationsJson() {
        return operationsJson;
    }

    public void setOperationsJson(Map<String, Object> operationsJson) {
        this.operationsJson = operationsJson;
    }

    public List<Map<String, Object>> getPreviewJson() {
        return previewJson;
    }

    public void setPreviewJson(List<Map<String, Object>> previewJson) {
        this.previewJson = previewJson;
    }

    public List<Map<String, Object>> getAffectedResourcesJson() {
        return affectedResourcesJson;
    }

    public void setAffectedResourcesJson(List<Map<String, Object>> affectedResourcesJson) {
        this.affectedResourcesJson = affectedResourcesJson;
    }

    public Map<String, Object> getRollbackSnapshotJson() {
        return rollbackSnapshotJson;
    }

    public void setRollbackSnapshotJson(Map<String, Object> rollbackSnapshotJson) {
        this.rollbackSnapshotJson = rollbackSnapshotJson;
    }

    public boolean isReversible() {
        return reversible;
    }

    public void setReversible(boolean reversible) {
        this.reversible = reversible;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public UUID getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(UUID approvedBy) {
        this.approvedBy = approvedBy;
    }

    public Instant getAppliedAt() {
        return appliedAt;
    }

    public void setAppliedAt(Instant appliedAt) {
        this.appliedAt = appliedAt;
    }

    public Instant getRolledBackAt() {
        return rolledBackAt;
    }

    public void setRolledBackAt(Instant rolledBackAt) {
        this.rolledBackAt = rolledBackAt;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
