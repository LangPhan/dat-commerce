package com.datcommerce.api.experience;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "seasonal_experiences")
public class SeasonalExperienceEntity {

    @Id
    private UUID id;

    @Column(name = "store_id", nullable = false)
    private UUID storeId;

    @Column(nullable = false, length = 100)
    private String slug;

    @Column(nullable = false, length = 140)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false, length = 32)
    private String category;

    @Column(name = "preset_key", length = 80)
    private String presetKey;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "activation_mode", nullable = false, length = 32)
    private String activationMode;

    @Column(name = "manual_override", nullable = false)
    private boolean manualOverride;

    @Column(name = "starts_at")
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(nullable = false, length = 64)
    private String timezone;

    @Column(name = "recurrence_rule", nullable = false, length = 32)
    private String recurrenceRule;

    @Column(nullable = false)
    private int priority;

    @Column(name = "blend_mode", nullable = false, length = 32)
    private String blendMode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "exclusive_groups_json", nullable = false, columnDefinition = "jsonb")
    private List<String> exclusiveGroupsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "target_pages_json", nullable = false, columnDefinition = "jsonb")
    private List<String> targetPagesJson;

    @Column(name = "max_particle_budget", nullable = false)
    private int maxParticleBudget;

    @Column(name = "active_version_id")
    private UUID activeVersionId;

    @Column(name = "latest_version_number", nullable = false)
    private int latestVersionNumber;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getStoreId() { return storeId; }
    public void setStoreId(UUID storeId) { this.storeId = storeId; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPresetKey() { return presetKey; }
    public void setPresetKey(String presetKey) { this.presetKey = presetKey; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getActivationMode() { return activationMode; }
    public void setActivationMode(String activationMode) { this.activationMode = activationMode; }

    public boolean isManualOverride() { return manualOverride; }
    public void setManualOverride(boolean manualOverride) { this.manualOverride = manualOverride; }

    public Instant getStartsAt() { return startsAt; }
    public void setStartsAt(Instant startsAt) { this.startsAt = startsAt; }

    public Instant getEndsAt() { return endsAt; }
    public void setEndsAt(Instant endsAt) { this.endsAt = endsAt; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getRecurrenceRule() { return recurrenceRule; }
    public void setRecurrenceRule(String recurrenceRule) { this.recurrenceRule = recurrenceRule; }

    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }

    public String getBlendMode() { return blendMode; }
    public void setBlendMode(String blendMode) { this.blendMode = blendMode; }

    public List<String> getExclusiveGroupsJson() { return exclusiveGroupsJson; }
    public void setExclusiveGroupsJson(List<String> exclusiveGroupsJson) { this.exclusiveGroupsJson = exclusiveGroupsJson; }

    public List<String> getTargetPagesJson() { return targetPagesJson; }
    public void setTargetPagesJson(List<String> targetPagesJson) { this.targetPagesJson = targetPagesJson; }

    public int getMaxParticleBudget() { return maxParticleBudget; }
    public void setMaxParticleBudget(int maxParticleBudget) { this.maxParticleBudget = maxParticleBudget; }

    public UUID getActiveVersionId() { return activeVersionId; }
    public void setActiveVersionId(UUID activeVersionId) { this.activeVersionId = activeVersionId; }

    public int getLatestVersionNumber() { return latestVersionNumber; }
    public void setLatestVersionNumber(int latestVersionNumber) { this.latestVersionNumber = latestVersionNumber; }

    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
