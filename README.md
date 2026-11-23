# Dat Commerce

AI-Native Ecommerce Platform (`dat-commerce`) featuring a customer storefront, merchant admin dashboard, visual store editor, and controlled AI operations.

## Monorepo Layout

- `apps/web` — Next.js 16 App Router + TypeScript (Storefront, Admin Dashboard, Visual Store Editor, Login/Auth)
- `services/api` — Spring Boot 3.4 (Java 21 LTS) Modular Monolith backend + Flyway migrations + Dockerfile
- `packages/api-contracts` — OpenAPI specifications and generated TypeScript API contracts
- `infra/caddy` — Reverse proxy routing `/api/*`, `/actuator/health*`, `/swagger-ui*`, `/storage/*`, and `/*`
- `docs/architecture` — ERD, Block Schema v1, AI Tool Policy v1, API Outline
- `docs/decisions` — Architecture Decision Records (ADRs 0001–0004)

## Running Full Stack with Docker Compose

1. Create `.env` from `.env.example` and replace secret values (`POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `JWT_SECRET`).
2. Start all services (`postgres`, `redis`, `silo`, `api`, `web`, `caddy`):

```bash
docker compose up -d --build
```

3. Verify service health and access the app via Caddy (`APP_PORT`, default `8088`):
   - Public Storefront: `http://localhost:8088/store`
   - Admin Login: `http://localhost:8088/login`
   - Swagger UI: `http://localhost:8088/swagger-ui.html`
   - Health check: `http://localhost:8088/actuator/health`

## Development & Test Commands

### Frontend (`apps/web`, Node 22 LTS)
```bash
export PATH="/home/laxng/.nvm/versions/node/v22.23.4/bin:$PATH"
cd apps/web
npm install
npm run typecheck
npm run lint
npm run test
```

### Backend (`services/api`, via Docker `maven:3.9-eclipse-temurin-21`)
Run integration tests against `postgres` and `redis` on `dat-commerce-net`:
```bash
docker run --rm \
  --network dat-commerce_dat-commerce-net \
  -v "$PWD/services/api:/workspace" \
  -v dat_commerce_m2:/root/.m2 \
  -w /workspace \
  -e SPRING_PROFILES_ACTIVE=test \
  -e TEST_POSTGRES_HOST=postgres \
  -e TEST_POSTGRES_DB=dat_commerce_test \
  -e TEST_POSTGRES_USER="$POSTGRES_USER" \
  -e TEST_POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e TEST_REDIS_HOST=redis \
  maven:3.9-eclipse-temurin-21 mvn -B test
```
