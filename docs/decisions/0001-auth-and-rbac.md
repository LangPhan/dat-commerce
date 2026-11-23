# ADR 0001: Authentication, Session Lifecycle, and RBAC

- **Status:** Accepted
- **Date:** 2026-11-23

## Context
The merchant admin workspace and AI operator can modify prices, inventory, orders, and published storefront pages. The platform needs strong authentication and fine-grained authorization without storing sensitive tokens in `localStorage` (XSS risk).

## Decision
1. **Short-Lived JWT Access Token (In-Memory Only):**
   - Issued on login/refresh with a 15-minute TTL (`JWT_ACCESS_TTL_SECONDS=900`).
   - Kept strictly in React application memory (`api-client.ts`) and sent via `Authorization: Bearer <token>`. Never persisted to `localStorage` or `sessionStorage`.
2. **Rotating HttpOnly Refresh Token Cookie:**
   - Cryptographically random opaque token stored as a SHA-256 hash in PostgreSQL (`refresh_tokens`) and returned in an `HttpOnly`, `SameSite=Lax` cookie (`dc_refresh_token`, `Path=/api/v1/auth`).
   - Every `/auth/refresh` call rotates the token (`revoked_at` + `replaced_by_id`). If an already-revoked token is replayed, all active sessions for that user are revoked and an `AUTH_REFRESH_REUSE_DETECTED` audit log is recorded.
   - Logout marks the DB token revoked and caches its hash in Redis (`auth:revoked:<hash>`) until natural expiry.
3. **6-Role RBAC with Fine-Grained Permissions:**
   - Roles (`OWNER`, `ADMIN`, `CATALOG_MANAGER`, `CONTENT_EDITOR`, `ORDER_MANAGER`, `VIEWER`) map to explicit permission authorities enforced via Spring Security `@PreAuthorize`.
   - Frontend hides/disables unauthorized controls for UX, while backend security remains the authoritative enforcement boundary.

## Consequences
- Frontend and backend share a single origin via Caddy (`/api/*` → `api`, `/*` → `web`), eliminating cross-origin cookie headaches in both dev and production.
- Refresh reuse detection protects against stolen refresh cookies.
