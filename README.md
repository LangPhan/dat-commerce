# Dat Commerce

AI-Native Ecommerce Platform (`dat-commerce`) featuring a customer storefront, merchant admin dashboard, visual store editor, and controlled AI operations.

## Monorepo Layout

- `apps/web` — Next.js App Router + TypeScript (Storefront, Admin Dashboard, Visual Store Editor)
- `services/api` — Spring Boot (Java 21 LTS) Modular Monolith backend (built & run via Docker)
- `packages/api-contracts` — OpenAPI specifications and generated TypeScript API contracts
- `infra/` — Docker, Caddy reverse proxy, and monitoring configurations
- `docs/` — Architecture specs (`architecture/`), ADRs (`decisions/`), AI evals (`evals/`), and runbooks (`runbooks/`)

## Planned Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, TanStack Query/Table, React Hook Form + Zod
- **Backend:** Spring Boot (Java 21 LTS via Docker), Flyway, OpenAPI/Swagger
- **Data & Storage:** PostgreSQL, Redis, MinIO (S3-compatible object storage)
- **AI Gateway & Edge:** 9Router (server-side only via `AiModelGateway`), Caddy reverse proxy

## Running `apps/web` on the Server

Use Node 22 LTS (nvm):

```bash
export PATH="/home/laxng/.nvm/versions/node/v22.23.4/bin:$PATH"
cd apps/web
npm install
npm run typecheck
npm run dev
```
