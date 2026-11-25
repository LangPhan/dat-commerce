-- Animation & Motion Builder: Reusable Store Animation Presets

CREATE TABLE animation_presets (
    id              UUID PRIMARY KEY,
    store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    preset_key      VARCHAR(80) NOT NULL,
    name            VARCHAR(120) NOT NULL,
    category        VARCHAR(32) NOT NULL,
    description     TEXT,
    config_json     JSONB NOT NULL,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite     BOOLEAN NOT NULL DEFAULT FALSE,
    version         BIGINT NOT NULL DEFAULT 0,
    created_by      UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, preset_key)
);

CREATE INDEX idx_animation_presets_store_category
    ON animation_presets(store_id, category, updated_at DESC);
