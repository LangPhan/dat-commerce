# Dat Commerce — AI Evaluation & Hardening Report (v1)

Dataset definition: [`ai-eval-dataset-v1.json`](./ai-eval-dataset-v1.json)

## Scope & Methodology

Evaluations execute continuously via Spring Boot integration suites against real PostgreSQL 16 (Flyway V1–V6), Redis 7, and pgsty/Silo object storage, supplemented by an end-to-end verification run against the containerized deployment behind Caddy (`http://127.0.0.1:8088`).

## Eval Matrix Summary

| Case ID | Scenario | Automated Verification | Status |
|---|---|---|---|
| `eval-01` | Catalog Search Grounding & Zero Hallucination | `AiRuntimeAndEvalIntegrationTest` | PASS |
| `eval-02` | Ambiguous Prompt Clarification | `AiRuntimeAndEvalIntegrationTest` | PASS |
| `eval-03` | Bulk Price Plan -> Preview -> Apply -> Rollback | `AiRuntimeAndEvalIntegrationTest`, `e2e-demo-verify.py` | PASS |
| `eval-04` | CMS Page Add Section -> Draft Only (No Auto-Publish) | `AiRuntimeAndEvalIntegrationTest`, `e2e-demo-verify.py` | PASS |
| `eval-05` | CMS Selected Block Context Edit -> Preview -> Rollback | `e2e-demo-verify.py` | PASS |
| `eval-06` | `VIEWER` Role RBAC Enforcement (HTTP 403) | `AuthAndRbacIntegrationTest`, `AiRuntimeAndEvalIntegrationTest`, `e2e-demo-verify.py` | PASS |
| `eval-07` | Prompt Injection Immunity (`<untrusted_store_data>`) | `AiRuntimeAndEvalIntegrationTest`, `e2e-demo-verify.py` | PASS |
| `eval-08` | Apply Idempotency Replay & Plan Expiry Guard | `AiRuntimeAndEvalIntegrationTest`, `e2e-demo-verify.py` | PASS |
| `eval-09` | SSE Streaming Turn (`text/event-stream`) | `AiRuntimeAndEvalIntegrationTest`, `e2e-demo-verify.py` | PASS |
| `eval-10` | 9Router Retry, Model Fallback & Circuit Breaker + Brute-Force RL | `HardeningAndObservabilityIntegrationTest` | PASS |

## Latest Verified Run

- **Backend Maven Integration Suite (`mvn -B test`, 6 suites):** `Tests run: 12, Failures: 0, Errors: 0, Skipped: 0` (`CommerceCheckoutAndOrdersIntegrationTest`, `AuthAndRbacIntegrationTest`, `CmsAndThemeIntegrationTest`, `AiRuntimeAndEvalIntegrationTest`, `CatalogAndMediaIntegrationTest`, `HardeningAndObservabilityIntegrationTest`).
- **Frontend Verification (`apps/web`, Node `v22.23.4`):** `npm run typecheck` (0 errors), `npm run lint` (0 errors; 2 legacy warnings in `postcss.config.mjs` and `src/lib/storage.ts`), `npm run test` (`Test Files 3 passed (3)`, `Tests 8 passed (8)`).
- **Live End-to-End Portfolio & Security Suite (`scripts/e2e-demo-verify.py` against `http://127.0.0.1:8088`):** All 6 portfolio scenarios, guest cart + idempotent checkout + merchant cancel (stock restore), Caddy security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), and external `/actuator/prometheus` `403` block **PASS**.
- **PostgreSQL Backup & Restore Parity Drill (`scripts/backup-db.sh` + `scripts/restore-db.sh`):** Custom-format `.dump` + SHA-256 checksum verified; restored `dat_commerce_restore_verify` matched live row counts 100% (`products: 12`, `variants: 19`, `pages: 3`, `page_versions: 11`, `theme_configs: 1`, `admin_users: 5`).
- **Client Bundle Secret Scan (`/app/.next/static` inside `dat-commerce-web-1`):** 0 matches for `AI_GATEWAY_API_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD`, or `MINIO_ROOT_PASSWORD`.

## Security & Hardening Controls Verified

- Server-side `AI_GATEWAY_API_KEY` isolation (never present in `.next/static` or browser requests).
- Redis per-user AI rate limit (`30 req/min`) and daily per-store token budget (`AI_DAILY_TOKEN_BUDGET`).
- Redis login brute-force protection (`auth:rl:login:*`, HTTP `429 RATE_LIMITED` after 10 failures).
- Caddy response security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) and external block (`403`) on `/actuator/prometheus*` and `/actuator/metrics*`.
- 9Router Contract Checklist for live upstream switching: see [`deploy-backup-restore.md`](../runbooks/deploy-backup-restore.md).
