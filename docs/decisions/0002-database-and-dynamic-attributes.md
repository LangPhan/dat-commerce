# ADR 0002: PostgreSQL, Flyway, and Relational Dynamic Attributes

- **Status:** Accepted
- **Date:** 2026-11-23

## Context
Dat Commerce supports diverse product categories (Footwear, Laptops, Phones, Apparel) where each `Product Type` defines its own custom attributes (`RAM`, `Screen Size`, `Material`, `Waterproof`, etc.) used for validation, admin editing, and storefront faceted filtering.

## Decision
1. **PostgreSQL 16 + Flyway:** All schema changes live in versioned SQL migrations under `services/api/src/main/resources/db/migration/` with Hibernate `ddl-auto: validate` ensuring entity-schema parity.
2. **Relational Attribute Definitions + Typed Value Columns:**
   - Rather than dumping all product specifications into one opaque `JSONB` column, attribute schemas live in `attribute_definitions`, `attribute_options`, and `product_type_attributes`, while values live in `product_attribute_values` using typed columns (`value_text`, `value_number`, `value_boolean`, `value_date`, `value_json`).
   - `JSONB` is reserved for schema-validated documents such as `page_versions.content_json`, `theme_configs.tokens_json`, `ai_change_plans.operations_json`, and `audit_logs` snapshots.
3. **Safe Attribute Lifecycle:** Deleting an attribute already referenced by products archives/deactivates it (`archived_at`) rather than destroying existing product data.

## Consequences
- Storefront filters (e.g., numeric ranges for `ram_gb >= 16`, boolean `waterproof = true`, enum selects) run with native SQL indexes and strict type integrity.
- Product-type switching can safely detect and validate incompatible attributes before committing.
