package com.datcommerce.api.ai;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "ai_tool_calls")
public class AiToolCallEntity {

    @Id
    private UUID id;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "tool_name", nullable = false, length = 100)
    private String toolName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "arguments_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> argumentsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_summary_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> resultSummaryJson;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "duration_ms", nullable = false)
    private int durationMs;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public String getToolName() {
        return toolName;
    }

    public void setToolName(String toolName) {
        this.toolName = toolName;
    }

    public Map<String, Object> getArgumentsJson() {
        return argumentsJson;
    }

    public void setArgumentsJson(Map<String, Object> argumentsJson) {
        this.argumentsJson = argumentsJson;
    }

    public Map<String, Object> getResultSummaryJson() {
        return resultSummaryJson;
    }

    public void setResultSummaryJson(Map<String, Object> resultSummaryJson) {
        this.resultSummaryJson = resultSummaryJson;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(int durationMs) {
        this.durationMs = durationMs;
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
}
