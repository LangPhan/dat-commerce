CREATE TABLE product_types (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, code)
);

CREATE TABLE attribute_definitions (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    data_type VARCHAR(32) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    filterable BOOLEAN NOT NULL DEFAULT TRUE,
    searchable BOOLEAN NOT NULL DEFAULT TRUE,
    unit VARCHAR(32),
    validation_rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, code)
);

CREATE TABLE attribute_options (
    id UUID PRIMARY KEY,
    attribute_definition_id UUID NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
    value VARCHAR(160) NOT NULL,
    label VARCHAR(160) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE (attribute_definition_id, value)
);

CREATE TABLE product_type_attributes (
    product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
    attribute_definition_id UUID NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    required_override BOOLEAN,
    PRIMARY KEY (product_type_id, attribute_definition_id)
);

CREATE TABLE variant_option_definitions (
    id UUID PRIMARY KEY,
    product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE (product_type_id, code)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    slug VARCHAR(160) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    seo_description TEXT,
    image_url VARCHAR(512),
    default_product_type_id UUID REFERENCES product_types(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, slug)
);

CREATE TABLE media_assets (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    storage_key VARCHAR(512) NOT NULL UNIQUE,
    url VARCHAR(512) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    width INT,
    height INT,
    alt_text VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    product_type_id UUID NOT NULL REFERENCES product_types(id),
    slug VARCHAR(180) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(120) NOT NULL DEFAULT '',
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    primary_image_url VARCHAR(512),
    seo_title VARCHAR(255),
    seo_description TEXT,
    rating NUMERIC(3,2) NOT NULL DEFAULT 4.80,
    review_count INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, slug)
);

CREATE TABLE product_categories (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

CREATE TABLE product_images (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    url VARCHAR(512) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE product_attribute_values (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_definition_id UUID NOT NULL REFERENCES attribute_definitions(id),
    value_text TEXT,
    value_number NUMERIC(18,4),
    value_boolean BOOLEAN,
    value_date DATE,
    value_json JSONB,
    UNIQUE (product_id, attribute_definition_id)
);

CREATE TABLE variants (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, sku)
);

CREATE TABLE variant_option_values (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    option_name VARCHAR(64) NOT NULL,
    option_value VARCHAR(160) NOT NULL,
    UNIQUE (variant_id, option_name)
);

CREATE TABLE collections (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    slug VARCHAR(160) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, slug)
);

CREATE TABLE collection_products (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX idx_products_store_status ON products(store_id, status);
CREATE INDEX idx_products_type ON products(product_type_id);
CREATE INDEX idx_variants_product ON variants(product_id);
CREATE INDEX idx_attr_values_def_text ON product_attribute_values(attribute_definition_id, value_text);
CREATE INDEX idx_attr_values_def_num ON product_attribute_values(attribute_definition_id, value_number);
CREATE INDEX idx_attr_values_def_bool ON product_attribute_values(attribute_definition_id, value_boolean);
