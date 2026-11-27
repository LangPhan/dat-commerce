package com.datcommerce.api.experience;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "seasonal_experience_settings")
public class SeasonalExperienceSettingsEntity {

    @Id
    @Column(name = "store_id", nullable = false)
    private UUID storeId;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "conflict_strategy", nullable = false, length = 32)
    private String conflictStrategy;

    @Column(name = "max_concurrent_experiences", nullable = false)
    private int maxConcurrentExperiences;

    @Column(name = "global_particle_cap", nullable = false)
    private int globalParticleCap;

    @Column(name = "mobile_performance_mode", nullable = false, length = 32)
    private String mobilePerformanceMode;

    @Column(name = "respect_reduced_motion", nullable = false)
    private boolean respectReducedMotion;

    @Column(name = "fallback_behavior", nullable = false, length = 32)
    private String fallbackBehavior;

    @Column(name = "default_experience_id")
    private UUID defaultExperienceId;

    @Column(name = "allow_customer_dismiss", nullable = false)
    private boolean allowCustomerDismiss;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getStoreId() { return storeId; }
    public void setStoreId(UUID storeId) { this.storeId = storeId; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getConflictStrategy() { return conflictStrategy; }
    public void setConflictStrategy(String conflictStrategy) { this.conflictStrategy = conflictStrategy; }

    public int getMaxConcurrentExperiences() { return maxConcurrentExperiences; }
    public void setMaxConcurrentExperiences(int maxConcurrentExperiences) { this.maxConcurrentExperiences = maxConcurrentExperiences; }

    public int getGlobalParticleCap() { return globalParticleCap; }
    public void setGlobalParticleCap(int globalParticleCap) { this.globalParticleCap = globalParticleCap; }

    public String getMobilePerformanceMode() { return mobilePerformanceMode; }
    public void setMobilePerformanceMode(String mobilePerformanceMode) { this.mobilePerformanceMode = mobilePerformanceMode; }

    public boolean isRespectReducedMotion() { return respectReducedMotion; }
    public void setRespectReducedMotion(boolean respectReducedMotion) { this.respectReducedMotion = respectReducedMotion; }

    public String getFallbackBehavior() { return fallbackBehavior; }
    public void setFallbackBehavior(String fallbackBehavior) { this.fallbackBehavior = fallbackBehavior; }

    public UUID getDefaultExperienceId() { return defaultExperienceId; }
    public void setDefaultExperienceId(UUID defaultExperienceId) { this.defaultExperienceId = defaultExperienceId; }

    public boolean isAllowCustomerDismiss() { return allowCustomerDismiss; }
    public void setAllowCustomerDismiss(boolean allowCustomerDismiss) { this.allowCustomerDismiss = allowCustomerDismiss; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
