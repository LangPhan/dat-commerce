-- Seasonal & Event Experience Builder: Experiences, Version Snapshots & Store Settings

CREATE TABLE seasonal_experiences (
    id                      UUID PRIMARY KEY,
    store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    slug                    VARCHAR(100) NOT NULL,
    name                    VARCHAR(140) NOT NULL,
    description             TEXT,
    category                VARCHAR(32) NOT NULL,
    preset_key              VARCHAR(80),
    status                  VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    activation_mode         VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    manual_override         BOOLEAN NOT NULL DEFAULT FALSE,
    starts_at               TIMESTAMPTZ,
    ends_at                 TIMESTAMPTZ,
    timezone                VARCHAR(64) NOT NULL DEFAULT 'UTC',
    recurrence_rule         VARCHAR(32) NOT NULL DEFAULT 'NONE',
    priority                INT NOT NULL DEFAULT 50,
    blend_mode              VARCHAR(32) NOT NULL DEFAULT 'OVERRIDE',
    exclusive_groups_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_pages_json       JSONB NOT NULL DEFAULT '["*"]'::jsonb,
    max_particle_budget     INT NOT NULL DEFAULT 120,
    active_version_id       UUID,
    latest_version_number   INT NOT NULL DEFAULT 1,
    version                 BIGINT NOT NULL DEFAULT 0,
    created_by              UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, slug)
);

CREATE TABLE seasonal_experience_versions (
    id                      UUID PRIMARY KEY,
    experience_id           UUID NOT NULL REFERENCES seasonal_experiences(id) ON DELETE CASCADE,
    version_number          INT NOT NULL,
    config_json             JSONB NOT NULL,
    change_summary          VARCHAR(255),
    created_by              UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (experience_id, version_number)
);

CREATE TABLE seasonal_experience_settings (
    store_id                    UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    enabled                     BOOLEAN NOT NULL DEFAULT TRUE,
    conflict_strategy           VARCHAR(32) NOT NULL DEFAULT 'PRIORITY_STACK',
    max_concurrent_experiences  INT NOT NULL DEFAULT 2,
    global_particle_cap         INT NOT NULL DEFAULT 160,
    mobile_performance_mode     VARCHAR(32) NOT NULL DEFAULT 'ADAPTIVE',
    respect_reduced_motion      BOOLEAN NOT NULL DEFAULT TRUE,
    fallback_behavior           VARCHAR(32) NOT NULL DEFAULT 'REVERT_DEFAULT_THEME',
    default_experience_id       UUID REFERENCES seasonal_experiences(id) ON DELETE SET NULL,
    allow_customer_dismiss      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seasonal_exp_store_status
    ON seasonal_experiences(store_id, status, priority DESC);

CREATE INDEX idx_seasonal_exp_schedule
    ON seasonal_experiences(activation_mode, status, starts_at, ends_at);

CREATE INDEX idx_seasonal_exp_versions
    ON seasonal_experience_versions(experience_id, version_number DESC);
