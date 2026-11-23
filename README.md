# Dat Commerce

AI-Native Multi-Category Ecommerce, Schema-Driven CMS & Controlled AI Operator Platform (`dat-commerce`).

## Architecture

```text
Next.js 16 (Storefront + Admin + Visual Editor)
                     |  (HTTP / SSE via Caddy :8088)
                     v
      Spring Boot 3.4 Modular Monolith (Java 21)
      +--------------------+--------------------+
      |                    |                    |
   Commerce               CMS              AI Operator
(Products, Variants,  (Pages, Versions,   (9Router Gateway,
 Dynamic Attrs,       Theme Tokens,       20 Tools, SSE,
 Cart, Checkout)      Navigation)         Change Plans + Rollback)
      |                    |                    |
      +--------------------+--------------------+
             |             |             |
        PostgreSQL 16    Redis 7    Silo (S3)
```

## Monorepo Layout

- `apps/web` — Next.js 16 App Router + TypeScript (Storefront `/store`, Admin Dashboard `/admin`, Visual Store Editor `/`, Auth `/login`)
- `services/api` — Spring Boot 3.4 Modular Monolith + Flyway (`V1`–`V6`) + Micrometer Prometheus metrics + OpenAPI
- `packages/api-contracts` — OpenAPI specifications and generated TypeScript API contracts
- `infra/caddy` — Reverse proxy (`:8088`), SSE unbuffered streaming (`flush_interval -1`), security headers, `/actuator/prometheus` external block
- `infra/monitoring` — Prometheus config, alert rules (`alerts.yml`), Grafana dashboard (`grafana-dashboard.json`), and `docker-compose.monitoring.yml`
- `scripts` — Database backup (`backup-db.sh`), checksummed restore (`restore-db.sh`), and automated E2E verifier (`e2e-demo-verify.py`)
- `docs` — Architecture docs, ADRs (`0001`–`0004`), AI eval dataset/report (`docs/evals/`), deployment & demo runbooks (`docs/runbooks/`)

## Quickstart (Full Docker Stack)

1. Copy `.env.example` to `.env` and set strong secrets (`POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `JWT_SECRET`).
2. Build and start all 6 core services (`postgres`, `redis`, `silo`, `api`, `web`, `caddy`):
   ```bash
   docker compose up -d --build
   ```
3. Access the platform on `http://localhost:8088`:
   - Storefront: `http://localhost:8088/store`
   - Visual Store Editor: `http://localhost:8088/`
   - Admin Login & Workspace: `http://localhost:8088/login` -> `/admin`
   - Swagger UI: `http://localhost:8088/swagger-ui.html`
   - Health: `http://localhost:8088/actuator/health`

Seeded demo accounts (`APP_SEED_ENABLED=true`):
- Owner: `owner@datcommerce.local` / `OwnerPass123!`
- Editor: `editor@datcommerce.local` / `EditorPass123!`
- Viewer: `viewer@datcommerce.local` / `ViewerPass123!`

## Testing, E2E & Operations

### Backend Integration Suite (`services/api`)
```bash
docker run --rm --network dat-commerce_dat-commerce-net \
  -v "$PWD/services/api:/workspace" -v ~/.m2:/root/.m2 -w /workspace \
  -e SPRING_PROFILES_ACTIVE=test -e TEST_POSTGRES_HOST=postgres \
  -e TEST_POSTGRES_DB=dat_commerce_test -e TEST_POSTGRES_USER="$POSTGRES_USER" \
  -e TEST_POSTGRES_PASSWORD="$POSTGRES_PASSWORD" -e TEST_REDIS_HOST=redis \
  maven:3.9-eclipse-temurin-21 mvn -B test
```

### Frontend Verification (`apps/web`, Node 22 LTS)
```bash
cd apps/web
npm run typecheck
npm run lint
npm run test
```

### Live End-to-End Portfolio & Security Suite
```bash
python3 scripts/e2e-demo-verify.py
```

### Backup, Restore & Monitoring
- Backup PostgreSQL (`backups/*.dump` + `.sha256`): `./scripts/backup-db.sh`
- Restore/verify into scratch DB: `./scripts/restore-db.sh backups/<file>.dump dat_commerce_restore_verify`
- Start Prometheus & Grafana overlay (`127.0.0.1:9090` / `127.0.0.1:3001`): `docker compose -f docker-compose.monitoring.yml up -d`

See [`docs/runbooks/deploy-backup-restore.md`](docs/runbooks/deploy-backup-restore.md), [`docs/runbooks/demo-script.md`](docs/runbooks/demo-script.md), and [`docs/evals/eval-report-v1.md`](docs/evals/eval-report-v1.md).
