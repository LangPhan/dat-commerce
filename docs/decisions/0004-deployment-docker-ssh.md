# ADR 0004: Docker Compose Full-Stack Deployment on Ubuntu SSH Host

- **Status:** Accepted
- **Date:** 2026-11-23

## Context
The target development and staging environment is a Linux Ubuntu host (`laxng@100.98.214.94`) accessed over SSH/Tailscale, without a host-installed JDK/Maven and sharing RAM (~4.9 GiB available headroom) with existing Docker workloads.

## Decision
1. **Containerized Full-Stack Compose (`dat-commerce`):**
   - `caddy` (`caddy:2.10-alpine`): single public entry point on `${APP_PORT:-8088}:80` routing `/api/*`, `/actuator/health*`, `/swagger-ui*`, `/v3/api-docs*` to `api`, `/storage/*` to `silo`, and `/*` to `web`.
   - `web` (`node:22-alpine`): Next.js standalone runtime.
   - `api` (`maven:3.9-eclipse-temurin-21` build → `eclipse-temurin:21-jre` runtime): Spring Boot modular monolith.
   - `postgres` (`postgres:16-alpine`), `redis` (`redis:7-alpine`), `silo` (`pgsty/silo`, S3-compatible MinIO drop-in): bound exclusively to internal bridge network `dat-commerce-net`.
2. **Resource Caps:** Every service carries explicit memory limits and JVM heap bounds (`-XX:MaxRAMPercentage=70.0 -Xmx512m`) so total stack footprint stays well within available server headroom.
3. **Static Asset Separation:** Built-in storefront assets stay under `apps/web/public/media/*` (`/media/*`), while user-uploaded media stored in Silo/MinIO is routed via `/storage/*`.

## Consequences
- Zero host-level Java/Maven installation required; builds and Testcontainers/integration tests run reproducibly inside Docker.
- Promoting from dev (`:8088`) to production HTTPS only requires replacing the site block in `infra/caddy/Caddyfile` with the production domain.
