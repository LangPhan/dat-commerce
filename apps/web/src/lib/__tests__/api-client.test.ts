import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, getAccessToken, setAccessToken } from "../api-client";

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("attaches Authorization bearer token and Idempotency-Key header", async () => {
    setAccessToken("token-123");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiFetch<{ ok: boolean }>("/api/v1/admin/store", {
      method: "PATCH",
      body: { name: "Terrain Supply" },
      idempotencyKey: "idem-001",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer token-123");
    expect(headers["Idempotency-Key"]).toBe("idem-001");
    expect(init.credentials).toBe("include");
  });

  it("refreshes access token once on 401 and retries original request", async () => {
    setAccessToken("expired-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "fresh-token",
            expiresInSeconds: 900,
            user: {
              id: "u1",
              storeId: "s1",
              storeName: "Terrain Supply",
              email: "owner@datcommerce.local",
              fullName: "Alex Morgan",
              roles: ["OWNER"],
              permissions: ["store:read"],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "Terrain Supply" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = await apiFetch<{ name: string }>("/api/v1/admin/store");
    expect(store.name).toBe("Terrain Supply");
    expect(getAccessToken()).toBe("fresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
  });

  it("parses structured ApiErrorResponse payloads into ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "FORBIDDEN",
          message: "You do not have permission",
          fieldErrors: [{ field: "role", message: "forbidden" }],
          requestId: "req-42",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch("/api/v1/admin/users")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      code: "FORBIDDEN",
      message: "You do not have permission",
      requestId: "req-42",
    });

    try {
      await apiFetch("/api/v1/admin/users");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});
