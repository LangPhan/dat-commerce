# ADR 0003: Server-Side AI Gateway Abstraction (`AiModelGateway`) and 9Router

- **Status:** Accepted
- **Date:** 2026-11-23

## Context
The platform routes AI admin chat and tool-calling requests through **9Router** so model/provider choices can evolve without rewriting ecommerce domain logic. However, local dev/CI environments must also work deterministically even before live 9Router credentials are configured, and API keys must never leak to the browser.

## Decision
1. **Provider-Agnostic Interface (`AiModelGateway`):**
   - All orchestration code in `com.datcommerce.api.ai` depends exclusively on `AiModelGateway`, never on vendor SDKs inside domain services (`ProductService`, `OrderService`, `PageService`).
2. **Two Implementations Selected via Config (`AI_GATEWAY_MODE`):**
   - `NineRouterAiGateway`: connects server-to-server using `AI_GATEWAY_BASE_URL` and `AI_GATEWAY_API_KEY` with Resilience4j timeouts, retries, circuit breaker, and task-based model routing (`AI_DEFAULT_MODEL`, `AI_COMPLEX_TASK_MODEL`, `AI_FAST_TASK_MODEL`).
   - `MockAiModelGateway`: deterministic gateway implementation used in `mock` mode and automated CI suites when external LLM access is not configured.
3. **Contract Test Requirement:** Before promoting any model behind 9Router to production, contract tests must verify tool calling, tool-result round-trips, SSE streaming, and error payload handling.

## Consequences
- Secrets remain strictly inside backend environment variables.
- Automated AI evaluation and CI pipelines stay fast and reproducible without requiring external API billing for every PR.
