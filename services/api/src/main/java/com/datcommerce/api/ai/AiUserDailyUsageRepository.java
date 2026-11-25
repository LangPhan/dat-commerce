package com.datcommerce.api.ai;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AiUserDailyUsageRepository
        extends JpaRepository<AiUserDailyUsageEntity, AiUserDailyUsageEntity.DailyUsageId> {

    List<AiUserDailyUsageEntity> findAllByIdStoreIdAndIdUsageDateOrderByTotalTokensDesc(
            UUID storeId,
            LocalDate usageDate
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            value = """
                    INSERT INTO ai_user_daily_token_usage
                        (store_id, user_id, usage_date, prompt_tokens, completion_tokens, total_tokens, request_count, updated_at)
                    VALUES
                        (:storeId, :userId, :usageDate, :promptTokens, :completionTokens, :totalTokens, 1, :updatedAt)
                    ON CONFLICT (store_id, user_id, usage_date)
                    DO UPDATE SET
                        prompt_tokens = ai_user_daily_token_usage.prompt_tokens + EXCLUDED.prompt_tokens,
                        completion_tokens = ai_user_daily_token_usage.completion_tokens + EXCLUDED.completion_tokens,
                        total_tokens = ai_user_daily_token_usage.total_tokens + EXCLUDED.total_tokens,
                        request_count = ai_user_daily_token_usage.request_count + 1,
                        updated_at = EXCLUDED.updated_at
                    """,
            nativeQuery = true
    )
    void incrementDailyUsage(
            @Param("storeId") UUID storeId,
            @Param("userId") UUID userId,
            @Param("usageDate") LocalDate usageDate,
            @Param("promptTokens") long promptTokens,
            @Param("completionTokens") long completionTokens,
            @Param("totalTokens") long totalTokens,
            @Param("updatedAt") Instant updatedAt
    );
}
