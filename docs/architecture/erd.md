# Entity-Relationship Diagram (ERD) & Domain Model — Dat Commerce

## 1. Core Domain Distinctions

To prevent schema ambiguity across catalog, storefront, and AI tooling:

1. **Product** (`products`): Commercial/editorial entity (e.g., *Ridge Runner GTX*, *FormaBook Pro 14*). Holds general metadata: `name`, `slug`, `brand`, `description`, `status`, SEO fields, and belongs to **one primary `product_type_id`**.
2. **Product Type** (`product_types`): Schema template defining which **dynamic attributes** (`product_type_attributes`) and **variant option dimensions** (`variant_option_definitions`) a product of that type requires or supports (e.g., `Shoes`, `Laptop`, `Phone`).
3. **Variant** (`variants`): A purchasable SKU unit under a Product (e.g., *Ridge Runner GTX — Olive / US 10*, SKU `RR-GTX-OLV-10`). Each Variant carries its own `sku`, option values (`size`, `color`, `ram_config`), `prices`, and `inventory_items`/`inventory_levels`.
4. **Category** (`categories` + `product_categories`): Storefront navigation & taxonomy tree (supports `parent_id`, many-to-many with `products`, and optional `default_product_type_id`). A product can belong to multiple categories (e.g., *Footwear* and *Trail Running*).

### Complete Dynamic Attribute Examples

#### Example A: Product Type `Shoes`
- **Product Attributes** (stored in `product_attribute_values` with typed columns):
  - `material` (`TEXT`, required, filterable, searchable) — e.g., `"Ripstop Mesh & Gore-Tex"`
  - `gender` (`ENUM`, required, filterable: `["Men", "Women", "Unisex"]`) — e.g., `"Unisex"`
  - `waterproof` (`BOOLEAN`, required, filterable) — e.g., `true`
  - `sole_height` (`NUMBER`, optional, unit `"mm"`, min `10`, max `60`) — e.g., `32`
- **Variant Option Definitions** (`variant_option_definitions` → `variant_option_values`):
  - `size`: `"8"`, `"9"`, `"10"`, `"11"`
  - `color`: `"Olive"`, `"Crimson"`, `"Chalk"`

#### Example B: Product Type `Laptop`
- **Product Attributes**:
  - `cpu` (`TEXT`, required, filterable, searchable) — e.g., `"Intel Core i5-1335U"`
  - `ram_gb` (`NUMBER`, required, filterable, unit `"GB"`, min `4`, max `256`) — e.g., `16`
  - `storage_gb` (`NUMBER`, required, filterable, unit `"GB"`, min `128`, max `8192`) — e.g., `512`
  - `screen_inches` (`NUMBER`, required, filterable, unit `"inch"`, min `11`, max `18`) — e.g., `15.6`
- **Variant Option Definitions**:
  - `ram_config`: `"16GB"`, `"32GB"`
  - `storage_config`: `"512GB"`, `"1TB"`

---

## 2. Identity, Store & Audit Domain

```mermaid
erDiagram
    stores ||--o{ admin_users : employs
    stores ||--o{ audit_logs : records
    admin_users ||--o{ user_roles : has
    roles ||--o{ user_roles : assigned_to
    roles ||--o{ role_permissions : grants
    permissions ||--o{ role_permissions : included_in
    admin_users ||--o{ refresh_tokens : holds
    stores ||--o{ customers : serves
    customers ||--o{ customer_addresses : owns

    stores {
        uuid id PK
        varchar code UK
        varchar name
        varchar default_currency
        varchar locale
        varchar timezone
        varchar contact_email
        varchar public_domain
        varchar status
        jsonb settings_json
    }
    admin_users {
        uuid id PK
        uuid store_id FK
        varchar email UK
        varchar full_name
        varchar password_hash
        varchar status
        timestamptz last_login_at
    }
    roles {
        uuid id PK
        varchar code UK
        varchar name
    }
    permissions {
        uuid id PK
        varchar code UK
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by_id FK
    }
    audit_logs {
        uuid id PK
        uuid store_id FK
        uuid actor_user_id
        varchar actor_email
        varchar action
        varchar resource_type
        varchar resource_id
        varchar request_id
        varchar idempotency_key
        jsonb before_json
        jsonb after_json
        jsonb metadata_json
        timestamptz created_at
    }
```

---

## 3. Catalog & Dynamic Attributes Domain

```mermaid
erDiagram
    stores ||--o{ product_types : defines
    stores ||--o{ attribute_definitions : defines
    stores ||--o{ categories : organizes
    stores ||--o{ products : owns
    stores ||--o{ media_assets : stores

    product_types ||--o{ product_type_attributes : binds
    attribute_definitions ||--o{ product_type_attributes : mapped_in
    attribute_definitions ||--o{ attribute_options : enumerates

    product_types ||--o{ products : classifies
    product_types ||--o{ variant_option_definitions : defines_options
    categories ||--o{ categories : parent_of
    products ||--o{ product_categories : categorized_in
    categories ||--o{ product_categories : contains

    products ||--o{ product_attribute_values : has_values
    attribute_definitions ||--o{ product_attribute_values : defines
    products ||--o{ product_images : displays
    media_assets ||--o{ product_images : referenced_by

    products ||--o{ variants : has_skus
    variants ||--o{ variant_option_values : selects
    variant_option_definitions ||--o{ variant_option_values : defines

    product_attribute_values {
        uuid id PK
        uuid product_id FK
        uuid attribute_definition_id FK
        text value_text
        numeric value_number
        boolean value_boolean
        date value_date
        jsonb value_json
    }
    variants {
        uuid id PK
        uuid product_id FK
        varchar sku UK
        varchar title
        varchar status
        bigint version
    }
```

---

## 4. Pricing, Inventory, Promotion, Cart & Order Domain

```mermaid
erDiagram
    variants ||--o{ prices : priced_by
    variants ||--|| inventory_items : tracked_as
    stock_locations ||--o{ inventory_levels : holds
    inventory_items ||--o{ inventory_levels : stocked_in
    inventory_levels ||--o{ inventory_reservations : reserves
    inventory_levels ||--o{ inventory_adjustments : logs

    promotions ||--o{ promotion_targets : scopes
    carts ||--o{ cart_items : contains
    variants ||--o{ cart_items : added_to

    orders ||--o{ order_items : snapshots
    orders ||--o{ order_addresses : ships_to
    orders ||--o{ order_events : tracks
    orders ||--o{ payments : paid_via

    inventory_levels {
        uuid id PK
        uuid inventory_item_id FK
        uuid stock_location_id FK
        int stocked_quantity
        int reserved_quantity
        bigint version
    }
    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id
        uuid variant_id
        varchar product_name
        varchar variant_title
        varchar sku
        numeric unit_price
        int quantity
        numeric line_total
    }
    orders {
        uuid id PK
        uuid store_id FK
        varchar order_number UK
        varchar status
        varchar payment_status
        varchar fulfillment_status
        numeric subtotal
        numeric discount_total
        numeric shipping_total
        numeric tax_total
        numeric grand_total
        bigint version
    }
```

---

## 5. CMS, Theme & AI Operations Domain

```mermaid
erDiagram
    stores ||--o{ pages : owns
    pages ||--o{ page_versions : snapshots
    stores ||--o{ theme_configs : styles
    stores ||--o{ navigation_menus : links

    stores ||--o{ ai_conversations : hosts
    admin_users ||--o{ ai_conversations : initiates
    ai_conversations ||--o{ ai_messages : contains
    ai_messages ||--o{ ai_tool_calls : triggers
    ai_conversations ||--o{ ai_change_plans : proposes
    admin_users ||--o{ ai_change_plans : creates_or_approves

    pages {
        uuid id PK
        uuid store_id FK
        varchar slug UK
        varchar title
        varchar status
        uuid published_version_id FK
        int latest_version_number
        bigint version
    }
    page_versions {
        uuid id PK
        uuid page_id FK
        int version_number
        jsonb content_json
        uuid created_by FK
        timestamptz created_at
    }
    ai_change_plans {
        uuid id PK
        uuid store_id FK
        uuid conversation_id FK
        uuid created_by FK
        text request_summary
        varchar status
        jsonb operations_json
        jsonb preview_json
        jsonb affected_resources_json
        timestamptz expires_at
        uuid approved_by FK
        varchar idempotency_key
    }
```
