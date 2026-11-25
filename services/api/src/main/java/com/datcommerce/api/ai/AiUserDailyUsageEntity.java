package com.datcommerce.api.ai;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "ai_user_daily_token_usage")
public class AiUserDailyUsageEntity {

    @EmbeddedId
    private DailyUsageId id;

    @Column(name = "prompt_tokens", nullable = false)
    private long promptTokens;

    @Column(name = "completion_tokens", nullable = false)
    private long completionTokens;

    @Column(name = "total_tokens", nullable = false)
    private long totalTokens;

    @Column(name = "request_count", nullable = false)
    private int requestCount;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public DailyUsageId getId() {
        return id;
    }

    public void setId(DailyUsageId id) {
        this.id = id;
    }

    public long getPromptTokens() {
        return promptTokens;
    }

    public void setPromptTokens(long promptTokens) {
        this.promptTokens = promptTokens;
    }

    public long getCompletionTokens() {
        return completionTokens;
    }

    public void setCompletionTokens(long completionTokens) {
        this.completionTokens = completionTokens;
    }

    public long getTotalTokens() {
        return totalTokens;
    }

    public void setTotalTokens(long totalTokens) {
        this.totalTokens = totalTokens;
    }

    public int getRequestCount() {
        return requestCount;
    }

    public void setRequestCount(int requestCount) {
        this.requestCount = requestCount;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Embeddable
    public static class DailyUsageId implements Serializable {

        @Column(name = "store_id", nullable = false)
        private UUID storeId;

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        @Column(name = "usage_date", nullable = false)
        private LocalDate usageDate;

        public DailyUsageId() {
        }

        public DailyUsageId(UUID storeId, UUID userId, LocalDate usageDate) {
            this.storeId = storeId;
            this.userId = userId;
            this.usageDate = usageDate;
        }

        public UUID getStoreId() {
            return storeId;
        }

        public void setStoreId(UUID storeId) {
            this.storeId = storeId;
        }

        public UUID getUserId() {
            return userId;
        }

        public void setUserId(UUID userId) {
            this.userId = userId;
        }

        public LocalDate getUsageDate() {
            return usageDate;
        }

        public void setUsageDate(LocalDate usageDate) {
            this.usageDate = usageDate;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof DailyUsageId that)) return false;
            return Objects.equals(storeId, that.storeId)
                    && Objects.equals(userId, that.userId)
                    && Objects.equals(usageDate, that.usageDate);
        }

        @Override
        public int hashCode() {
            return Objects.hash(storeId, userId, usageDate);
        }
    }
}
