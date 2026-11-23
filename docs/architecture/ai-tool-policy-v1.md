# AI Tool Policy v1 — Dat Commerce

## 1. Core Security Principles

1. **No Direct DB / SQL Access:** The LLM never sees database credentials, generates SQL, or queries PostgreSQL directly.
2. **Server-Side Gateway Only:** Only Spring Boot calls 9Router (`AiModelGateway`). Browser clients never receive `AI_GATEWAY_API_KEY` or internal system prompts.
3. **User-Scoped Permissions:** AI inherits the exact permissions of the authenticated admin user; it never elevates privileges.
4. **Two-Phase Mutation (Plan → Approve → Execute):** AI **never** mutates catalog, pricing, inventory, promotion, or published CMS state directly during chat. Mutating tools only create a `PENDING_APPROVAL` `ai_change_plans` record. Execution happens exclusively when the human admin calls `/apply`.
5. **Backend-Resolved Truth:** For bulk updates or lookups, backend services re-evaluate query filters, enforce `max_records`, compute before/after diffs, and embed `expectedVersion` snapshots. LLM-hallucinated counts or IDs are rejected.
6. **Untrusted Store Data Isolation:** Retrieved product descriptions, reviews, or customer notes are wrapped inside `<untrusted_store_data>...</untrusted_store_data>` and explicitly marked as data, never instructions.

---

## 2. Role × Permission Matrix

| Permission | `OWNER` | `ADMIN` | `CATALOG_MANAGER` | `CONTENT_EDITOR` | `ORDER_MANAGER` | `VIEWER` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `dashboard:read` | Yes | Yes | Yes | Yes | Yes | Yes |
| `catalog:read` | Yes | Yes | Yes | Yes | Yes | Yes |
| `catalog:write` | Yes | Yes | Yes | No | No | No |
| `pricing:write` | Yes | Yes | Yes | No | No | No |
| `inventory:read` | Yes | Yes | Yes | No | Yes | Yes |
| `inventory:write` | Yes | Yes | Yes | No | No | No |
| `order:read` | Yes | Yes | No | No | Yes | Yes |
| `order:write` | Yes | Yes | No | No | Yes | No |
| `order:cancel` | Yes | Yes | No | No | Yes | No |
| `promotion:read` | Yes | Yes | Yes | No | Yes | Yes |
| `promotion:write` | Yes | Yes | Yes | No | No | No |
| `content:read` | Yes | Yes | No | Yes | No | Yes |
| `content:write` | Yes | Yes | No | Yes | No | No |
| `content:publish` | Yes | Yes | No | Yes | No | No |
| `media:write` | Yes | Yes | Yes | Yes | No | No |
| `ai:use` | Yes | Yes | Yes | Yes | Yes | No |
| `audit:read` | Yes | Yes | No | No | No | No |
| `store:read` | Yes | Yes | Yes | Yes | Yes | Yes |
| `store:write` | Yes | Yes | No | No | No | No |
| `users:read` | Yes | Yes | No | No | No | No |
| `users:write` | Yes | No | No | No | No | No |

> Note: `VIEWER` has read-only UI access and no `ai:use` or write permissions. Any unauthorized backend API call or AI tool call returns `403 FORBIDDEN` and writes a denied audit event.

---

## 3. Tool Registry Inventory (20 Planned Tools)

### A. Read-Only Tools (Phase 5 — `requiresApproval = false`, `mutating = false`)

| Tool Name | Required Permission | Risk | Notes |
|---|---|---|---|
| `catalog.search_products` | `catalog:read` | `READ` | Filter by name, SKU, brand, category, status (max 25 rows) |
| `catalog.get_product` | `catalog:read` | `READ` | Product + variants + attributes by ID/slug |
| `catalog.list_categories` | `catalog:read` | `READ` | Category tree |
| `catalog.get_product_type` | `catalog:read` | `READ` | Product Type + required/optional attribute definitions |
| `inventory.get_stock` | `inventory:read` | `READ` | Stock levels by SKU / location |
| `promotion.search` | `promotion:read` | `READ` | Active/draft promotions & codes |
| `orders.search` | `order:read` | `READ` | Orders by status, date range, order number |
| `orders.get_details` | `order:read` | `READ` | Order snapshot + line items + timeline |
| `content.get_page` | `content:read` | `READ` | Page metadata + current draft/published blocks |
| `analytics.get_summary` | `dashboard:read` | `READ` | Pre-computed revenue, AOV, category mix, low-stock count |

### B. Propose Tools (Phase 6 & 7 — `requiresApproval = true`, `mutating = false` until `/apply`)

| Tool Name | Required Permission | Risk | `max_records` | Notes |
|---|---|---|---|---|
| `catalog.propose_create_product` | `catalog:write` | `LOW` | 1 | Validates product type & required attributes |
| `catalog.propose_update_product` | `catalog:write` | `LOW` | 1 | Captures `expectedVersion` |
| `catalog.propose_bulk_price_update` | `pricing:write` | `HIGH` | 100 | Requires explicit filter (asks clarifying question if ambiguous) |
| `catalog.propose_create_category` | `catalog:write` | `LOW` | 1 | Validates parent category |
| `catalog.propose_create_product_type` | `catalog:write` | `MEDIUM` | 1 | Schema mutation |
| `catalog.propose_attribute_definition` | `catalog:write` | `MEDIUM` | 1 | Schema mutation |
| `inventory.propose_stock_adjustment` | `inventory:write` | `MEDIUM` | 20 | Requires non-empty `reason` |
| `promotion.propose_create` | `promotion:write` | `MEDIUM` | 1 | Validates date range & discount bounds |
| `content.propose_page_change` | `content:write` | `LOW` | 1 | Writes draft version only upon apply — never auto-publishes |
| `content.propose_theme_change` | `content:write` | `LOW` | 1 | Allowlisted tokens only; draft only |

---

## 4. Operational Limits & Forbidden Actions

- **Max tool rounds per turn:** `AI_MAX_TOOL_ROUNDS = 6`
- **Request timeout:** `AI_REQUEST_TIMEOUT_SECONDS = 45`
- **Plan expiration:** `15 minutes` (`status` transitions to `EXPIRED` if applied late)
- **Idempotency:** `/api/v1/admin/ai/change-plans/{planId}/apply` requires `Idempotency-Key` header.
- **Explicitly Forbidden in AI Tools:**
  - Canceling orders, issuing refunds, capturing payments.
  - Creating/editing admin users, roles, permissions, or security settings.
  - Generating JSX, HTML, CSS, JavaScript, or arbitrary external URLs.
  - Auto-approving change plans or auto-publishing pages to live storefront.
