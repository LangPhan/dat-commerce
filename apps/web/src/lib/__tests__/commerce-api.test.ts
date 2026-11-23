import { afterEach, describe, expect, it, vi } from "vitest";
import { storeApi } from "@/lib/commerce-api";

describe("commerce-api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes attribute facets and skips auth refresh for store listing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          page: 0,
          size: 12,
          totalElements: 0,
          totalPages: 0,
          facets: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await storeApi.listProducts({
      q: "runner",
      category: "running-shoes",
      maxPrice: 200,
      sort: "price-asc",
      page: 1,
      size: 12,
      attrs: { gender: "Men", waterproof: "true" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe("/api/v1/store/products");
    expect(parsed.searchParams.get("q")).toBe("runner");
    expect(parsed.searchParams.get("category")).toBe("running-shoes");
    expect(parsed.searchParams.get("maxPrice")).toBe("200");
    expect(parsed.searchParams.get("sort")).toBe("price-asc");
    expect(parsed.searchParams.get("attr.gender")).toBe("Men");
    expect(parsed.searchParams.get("attr.waterproof")).toBe("true");
    expect(init.credentials).toBe("include");
  });

  it("forwards Idempotency-Key and cart session on checkout", async () => {
    window.sessionStorage.setItem("dc_cart_session_token", "cart-sess-123");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "o1", orderNumber: "DC-1001" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await storeApi.checkout(
      {
        customerName: "Alex Mercer",
        customerEmail: "alex@example.com",
        address: {
          line1: "420 Pine St",
          city: "Seattle",
          postalCode: "98101",
          country: "US",
        },
        shippingMethod: "standard",
      },
      "idem-key-999"
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/store/checkout");
    const headers = new Headers(init.headers);
    expect(headers.get("Idempotency-Key")).toBe("idem-key-999");
    expect(headers.get("X-Cart-Session")).toBe("cart-sess-123");
  });
});
