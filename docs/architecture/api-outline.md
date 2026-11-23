# API Outline & Standards — Dat Commerce

## 1. Conventions

- **Base path:** `/api/v1`
- **Authentication:** `Authorization: Bearer <accessToken>` (15-min TTL JWT) + `HttpOnly` rotating refresh token cookie `dc_refresh_token` scoped to `Path=/api/v1/auth` (7-day TTL).
- **Correlation ID:** Every request accepts or generates `X-Request-Id` and returns it in the response header and error body.
- **Idempotency:** Mutating execution endpoints (checkout, change plan apply) support/require `Idempotency-Key`.
- **Optimistic Locking:** Concurrent edits to products, inventory, and CMS pages validate `version` and reject stale updates with `409 CONFLICT`.

### Unified Error Response (`ApiErrorResponse`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "fieldErrors": [
    { "field": "email", "message": "must be a well-formed email address" }
  ],
  "requestId": "9f8c2a1e-4b11-4f88-9022-7d3e8f021a11",
  "timestamp": "2026-11-23T11:45:00Z"
}
```

### Standard Pagination (`PageResponse<T>`)
```json
{
  "items": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

---

## 2. Endpoint Roadmap by Phase

### Phase 1 — Identity, Store & Audit
- `POST /api/v1/auth/login` (public)
- `POST /api/v1/auth/refresh` (public via `dc_refresh_token` cookie)
- `POST /api/v1/auth/logout` (revokes refresh token + clears cookie)
- `GET /api/v1/admin/me` (authenticated)
- `GET /api/v1/admin/users` (`users:read`)
- `POST /api/v1/admin/users` (`users:write`)
- `PATCH /api/v1/admin/users/{userId}` (`users:write`)
- `GET /api/v1/admin/store` (`store:read`)
- `PATCH /api/v1/admin/store` (`store:write`)
- `GET /api/v1/admin/audit-logs` (`audit:read`)
- `GET /actuator/health` (public health probe), `/v3/api-docs` & `/swagger-ui.html` (OpenAPI)

### Phase 2 — Catalog, Product Types, Attributes & Media
- `GET /api/v1/store/products`, `GET /api/v1/store/products/{slug}`, `GET /api/v1/store/categories`
- `GET/POST /api/v1/admin/product-types`, `GET/PATCH /api/v1/admin/product-types/{typeId}`
- `POST /api/v1/admin/product-types/{typeId}/attributes`, `PATCH/DELETE /api/v1/admin/attributes/{attributeId}`
- `GET/POST /api/v1/admin/categories`, `PATCH /api/v1/admin/categories/{categoryId}`
- `GET/POST /api/v1/admin/products`, `GET/PATCH /api/v1/admin/products/{productId}`, `POST /api/v1/admin/products/{productId}/variants`
- `GET/POST /api/v1/admin/media`, `DELETE /api/v1/admin/media/{mediaId}`

### Phase 3 — Pricing, Inventory, Promotions & Orders
- `GET /api/v1/admin/inventory`, `POST /api/v1/admin/inventory/adjustments`
- `GET/POST /api/v1/admin/promotions`, `PATCH /api/v1/admin/promotions/{promotionId}`
- `GET/POST /api/v1/store/cart`, `POST /api/v1/store/checkout`
- `GET /api/v1/admin/orders`, `GET /api/v1/admin/orders/{orderId}`, `PATCH /api/v1/admin/orders/{orderId}/status`, `POST /api/v1/admin/orders/{orderId}/cancel`

### Phase 4 — CMS & Theme
- `GET /api/v1/store/pages/{slug}`, `GET /api/v1/store/theme`, `GET /api/v1/store/navigation/{menuKey}`
- `GET/POST /api/v1/admin/pages`, `GET /api/v1/admin/pages/{pageId}`
- `POST /api/v1/admin/pages/{pageId}/versions`, `POST /api/v1/admin/pages/{pageId}/preview`, `POST /api/v1/admin/pages/{pageId}/publish`
- `GET /api/v1/admin/pages/{pageId}/versions`, `POST /api/v1/admin/pages/{pageId}/rollback/{versionId}`
- `GET /api/v1/admin/theme`, `POST /api/v1/admin/theme/versions`, `POST /api/v1/admin/theme/publish`, `POST /api/v1/admin/theme/rollback/{versionId}`

### Phase 5–7 — AI Admin & SSE
- `POST/GET /api/v1/admin/ai/conversations`, `GET /api/v1/admin/ai/conversations/{conversationId}`
- `POST /api/v1/admin/ai/conversations/{conversationId}/messages` (SSE stream: `message.delta`, `tool.started`, `tool.completed`, `plan.created`, `approval.required`, `operation.completed`, `error`)
- `GET /api/v1/admin/ai/change-plans/{planId}`
- `POST /api/v1/admin/ai/change-plans/{planId}/apply` (requires `Idempotency-Key`)
- `POST /api/v1/admin/ai/change-plans/{planId}/reject`
