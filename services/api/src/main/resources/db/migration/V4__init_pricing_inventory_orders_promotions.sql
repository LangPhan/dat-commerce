CREATE TABLE prices (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    amount NUMERIC(14,2) NOT NULL,
    compare_at_amount NUMERIC(14,2),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (variant_id, currency)
);

CREATE TABLE stock_locations (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    address VARCHAR(512),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, code)
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    variant_id UUID NOT NULL UNIQUE REFERENCES variants(id) ON DELETE CASCADE,
    sku VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_levels (
    id UUID PRIMARY KEY,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    stock_location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
    stocked_quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_item_id, stock_location_id)
);

CREATE TABLE inventory_reservations (
    id UUID PRIMARY KEY,
    inventory_level_id UUID NOT NULL REFERENCES inventory_levels(id) ON DELETE CASCADE,
    order_id UUID,
    quantity INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_adjustments (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    inventory_level_id UUID NOT NULL REFERENCES inventory_levels(id) ON DELETE CASCADE,
    delta INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    actor_user_id UUID,
    actor_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE promotions (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    type VARCHAR(32) NOT NULL,
    value NUMERIC(14,2) NOT NULL,
    scope_type VARCHAR(32) NOT NULL DEFAULT 'ALL',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    usage_limit INT,
    per_customer_limit INT,
    used_count INT NOT NULL DEFAULT 0,
    stackable BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, code)
);

CREATE TABLE promotion_targets (
    id UUID PRIMARY KEY,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    target_type VARCHAR(32) NOT NULL,
    target_id UUID NOT NULL,
    UNIQUE (promotion_id, target_type, target_id)
);

CREATE TABLE carts (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    session_token VARCHAR(128) NOT NULL UNIQUE,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    promotion_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY,
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    UNIQUE (cart_id, variant_id)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id),
    order_number VARCHAR(64) NOT NULL UNIQUE,
    customer_name VARCHAR(160) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    payment_status VARCHAR(32) NOT NULL,
    fulfillment_status VARCHAR(32) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    subtotal NUMERIC(14,2) NOT NULL,
    discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    shipping_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(14,2) NOT NULL,
    promotion_code VARCHAR(64),
    tracking_number VARCHAR(128),
    idempotency_key VARCHAR(128) UNIQUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    variant_title VARCHAR(255) NOT NULL,
    sku VARCHAR(128) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    quantity INT NOT NULL,
    line_total NUMERIC(14,2) NOT NULL
);

CREATE TABLE order_addresses (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    line1 VARCHAR(255) NOT NULL,
    city VARCHAR(120) NOT NULL,
    state VARCHAR(120),
    postal_code VARCHAR(32) NOT NULL,
    country VARCHAR(64) NOT NULL DEFAULT 'US'
);

CREATE TABLE order_events (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    label VARCHAR(160) NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    external_ref VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_store_created ON orders(store_id, created_at DESC);
CREATE INDEX idx_orders_email ON orders(customer_email);
CREATE INDEX idx_inventory_levels_item ON inventory_levels(inventory_item_id);
CREATE INDEX idx_promotions_store_code ON promotions(store_id, code);
