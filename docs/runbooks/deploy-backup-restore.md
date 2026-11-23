# Dat Commerce — Deployment, Backup, Restore & Observability Runbook

## 1. Prerequisites & Environment Configuration

Required software on host: Docker Engine + Docker Compose v2, Python 3 (for E2E verification), `curl`.

1. Copy `.env.example` to `.env` in the repository root and replace all placeholder secrets:
   - `POSTGRES_PASSWORD` — strong PostgreSQL password
   - `MINIO_ROOT_PASSWORD` — strong Silo (S3-compatible) password
   - `JWT_SECRET` — random secret at least 64 characters long
   - `APP_CORS_ALLOWED_ORIGINS` — comma-separated origin whitelist (e.g. `https://shop.example.com,http://localhost:8088`)
   - `APP_AUTH_LOGIN_MAX_FAILURES` (default `10`), `APP_AUTH_LOGIN_WINDOW_SECONDS` (default `300`)
   - `AI_GATEWAY_MODE` — `mock` (offline deterministic gateway for dev/tests) or `9router` (live OpenAI-compatible 9Router endpoint)
   - `AI_GATEWAY_BASE_URL` & `AI_GATEWAY_API_KEY` — server-only credentials when `AI_GATEWAY_MODE=9router`
   - `AI_DAILY_TOKEN_BUDGET` (default `2000000`), `AI_RETRY_MAX_ATTEMPTS` (default `3`), `AI_CIRCUIT_BREAKER_THRESHOLD` (default `5`)
2. Never commit `.env` (guarded by `.gitignore` and CI).

## 2. Build, Deploy & Verify Health

```bash
cd ~/Dev/dat-commerce
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose up -d --build
docker compose ps
```

Verify core endpoints via Caddy (`:8088`):
- Storefront: `curl -sf http://127.0.0.1:8088/store >/dev/null`
- Backend health: `curl -sf http://127.0.0.1:8088/actuator/health` -> `{"status":"UP"}`
- External Prometheus block check: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8088/actuator/prometheus` -> `403`
- Client bundle secret check:
  `docker compose exec -T web grep -rnE "AI_GATEWAY_API_KEY|JWT_SECRET|POSTGRES_PASSWORD|MINIO_ROOT_PASSWORD" /app/.next/static` (must return no matches)

## 3. Switching 9Router Gateway (`mock` -> `9router` Live Mode)

Before enabling live mode on production:
1. Verify upstream 9Router endpoint supports OpenAI `chat/completions` with `tools` (`function` definitions), `tool_calls` extraction, and `usage` token counters.
2. Update `.env`:
   ```env
   AI_GATEWAY_MODE=9router
   AI_GATEWAY_BASE_URL=https://your-9router-host/v1
   AI_GATEWAY_API_KEY=<server-only-token>
   AI_DEFAULT_MODEL=claude-sonnet-4
   AI_FAST_TASK_MODEL=forma-fast
   ```
3. Recreate only the API container: `docker compose up -d api`
4. Run smoke check: create a conversation and run a read-only prompt (`"Find Nike Pegasus"`), inspecting API logs (`docker compose logs --tail=50 api`) for clean tool execution without secret exposure.

## 4. PostgreSQL Backup & Restore Drill

### Take a verified backup
```bash
./scripts/backup-db.sh
```
This dumps `$POSTGRES_DB` in PostgreSQL custom format (`-Fc`) into `backups/<db>_<timestamp>.dump`, writes `<dump>.sha256`, and prunes dumps older than `RETENTION_DAYS` (default `7`).

### Verify backup via safe non-destructive restore
```bash
./scripts/restore-db.sh backups/<db>_<timestamp>.dump dat_commerce_restore_verify
```
The script verifies the SHA-256 checksum, recreates `dat_commerce_restore_verify`, restores with `--no-owner --no-acl`, and prints row counts across key tables (`products`, `variants`, `pages`, `page_versions`, `theme_configs`, `admin_users`).

### Emergency restore over live database
```bash
docker compose stop api web
./scripts/restore-db.sh backups/<db>_<timestamp>.dump "$POSTGRES_DB" --force-live
docker compose start api web
```

### Clean up verification DB after drill
```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS dat_commerce_restore_verify;"
```

## 5. Observability Stack (Prometheus & Grafana Overlay)

Micrometer exposes internal metrics on `http://api:8080/actuator/prometheus` (blocked externally by Caddy).

To start optional internal Prometheus (`127.0.0.1:9090`) and Grafana (`127.0.0.1:3001`):
```bash
docker compose -f docker-compose.monitoring.yml up -d
```
- Alert definitions: `infra/monitoring/alerts.yml` (covers API down, HTTP 5xx > 5%, AI turn failure > 15%, AI p95 > 15s, rate-limit spikes, JVM heap > 85%).
- Grafana dashboard import: `infra/monitoring/grafana-dashboard.json`.

## 6. Deployment Rollback Procedure

1. Identify previous working git commit (`git log -n 5 --oneline`).
2. Check out target commit on deployment branch and rebuild:
   ```bash
   git checkout <commit_sha>
   docker compose up -d --build
   ```
3. If database migration rollback is required, restore pre-upgrade `.dump` using `--force-live` above.
