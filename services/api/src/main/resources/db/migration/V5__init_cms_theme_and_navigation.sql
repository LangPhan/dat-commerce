-- Phase 4: CMS Pages, Page Versions, Theme Configs & Navigation Menus

CREATE TABLE pages (
    id                      UUID PRIMARY KEY,
    store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    slug                    VARCHAR(120) NOT NULL,
    title                   VARCHAR(160) NOT NULL,
    status                  VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    seo_title               VARCHAR(255),
    seo_description         TEXT,
    published_version_id    UUID,
    latest_version_number   INT NOT NULL DEFAULT 1,
    version                 BIGINT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, slug)
);

CREATE TABLE page_versions (
    id                      UUID PRIMARY KEY,
    page_id                 UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    version_number          INT NOT NULL,
    content_json            JSONB NOT NULL,
    change_summary          VARCHAR(255),
    created_by              UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (page_id, version_number)
);

CREATE TABLE theme_configs (
    id                      UUID PRIMARY KEY,
    store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    version_number          INT NOT NULL,
    status                  VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    tokens_json             JSONB NOT NULL,
    note                    VARCHAR(255),
    created_by              UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    published_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, version_number)
);

CREATE TABLE navigation_menus (
    id                      UUID PRIMARY KEY,
    store_id                UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    menu_key                VARCHAR(64) NOT NULL,
    items_json              JSONB NOT NULL,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, menu_key)
);

CREATE INDEX idx_pages_store ON pages(store_id, slug);
CREATE INDEX idx_page_versions_page ON page_versions(page_id, version_number DESC);
CREATE INDEX idx_theme_configs_store ON theme_configs(store_id, version_number DESC);
