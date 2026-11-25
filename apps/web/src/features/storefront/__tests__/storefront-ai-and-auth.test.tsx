import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storefrontAiApi } from "@/lib/cms-ai-api";
import { storeApi } from "@/lib/commerce-api";
import type { AuthUser } from "@/types/auth";
import type { CartResponse } from "@/types/api-commerce";
import { CheckoutPage } from "../cart-checkout";
import { useCheckoutPrefillStore } from "../checkout-prefill-store";
import { StorefrontAiAssistant } from "../StorefrontAiAssistant";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockAuthUser: AuthUser | null = null;
vi.mock("@/features/auth/auth-context", () => ({
  useOptionalAuth: () =>
    mockAuthUser
      ? {
          user: mockAuthUser,
          loading: false,
          hasPermission: () => false,
        }
      : { user: null, loading: false, hasPermission: () => false },
}));

const sampleCart: CartResponse = {
  id: "cart-1",
  sessionToken: "sess-1",
  currency: "USD",
  promotionCode: null,
  subtotal: 149,
  discountTotal: 0,
  shippingTotal: 0,
  freeShippingThreshold: 100,
  grandTotal: 149,
  items: [
    {
      variantId: "var-1",
      productId: "prod-1",
      productSlug: "trail-blazer-gtx",
      productName: "Trail Blazer GTX",
      variantTitle: "EU 42 / Moss",
      sku: "TB-GTX-42",
      imageUrl: "/media/shoe.jpg",
      unitPrice: 149,
      quantity: 1,
      lineTotal: 149,
      availableStock: 10,
    },
  ],
};

describe("Phase 4 — Storefront Shopping AI Widget, Auth Gate & Safe Checkout Prefill", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockAuthUser = null;
    useCheckoutPrefillStore.getState().clearPrefill();
  });

  it("shows Sign In and Create Account gate for guests without calling customer AI API", async () => {
    const quotaSpy = vi.spyOn(storefrontAiApi, "getQuota");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <StorefrontAiAssistant currentPath="/store/shop" />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Shopping AI" }));
    expect(await screen.findByTestId("storefront-ai-auth-gate")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign In" }).getAttribute("href")).toBe(
      "/login?next=%2Fstore%2Fshop"
    );
    expect(
      screen.getByRole("link", { name: "Create Account" }).getAttribute("href")
    ).toBe("/login?tab=register&next=%2Fstore%2Fshop");
    expect(quotaSpy).not.toHaveBeenCalled();
  });

  it("renders quota meter, adds product recommendations to cart, and stores prefill CTA for signed-in customer", async () => {
    mockAuthUser = {
      id: "cust-1",
      storeId: "store-1",
      storeName: "Terrain Supply",
      email: "customer@datcommerce.local",
      fullName: "Samir Patel",
      roles: [],
      permissions: [],
    };

    vi.spyOn(storefrontAiApi, "getQuota").mockResolvedValue({
      enabled: true,
      dailyLimit: 20000,
      usedTokens: 500,
      remainingTokens: 19500,
      requestCount: 1,
      resetsAt: "2026-11-26T00:00:00Z",
      modelId: "gpt-6-luna",
    });
    vi.spyOn(storefrontAiApi, "listConversations").mockResolvedValue([]);
    vi.spyOn(storefrontAiApi, "chat").mockResolvedValue({
      conversationId: "conv-1",
      reply: "Added Trail Blazer GTX and prepared your checkout draft.",
      model: "gpt-6-luna",
      promptTokens: 140,
      completionTokens: 60,
      recommendedProducts: [
        {
          productId: "prod-1",
          defaultVariantId: "var-1",
          slug: "trail-blazer-gtx",
          name: "Trail Blazer GTX",
          brand: "Terrain",
          price: 149,
          imageUrl: "/media/shoe.jpg",
          variantTitle: "EU 42 / Moss",
          sku: "TB-GTX-42",
          availableStock: 10,
        },
      ],
      updatedCart: sampleCart,
      checkoutPrefill: {
        customerName: "Samir Patel",
        customerEmail: "customer@datcommerce.local",
        line1: "123 Nguyen Hue",
        city: "Ho Chi Minh City",
        state: "HCM",
        postalCode: "700000",
        shippingMethod: "express",
        promotionCode: "WELCOME15",
        note: "",
      },
      checkoutAutoSubmit: false,
      quota: {
        enabled: true,
        dailyLimit: 20000,
        usedTokens: 700,
        remainingTokens: 19300,
        requestCount: 2,
        resetsAt: "2026-11-26T00:00:00Z",
        modelId: "gpt-6-luna",
      },
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const notify = vi.fn();

    render(
      <QueryClientProvider client={qc}>
        <StorefrontAiAssistant currentPath="/" onNotify={notify} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Shopping AI" }));
    expect(await screen.findByTestId("storefront-ai-quota-bar")).toBeTruthy();

    const textarea = screen.getByLabelText("Ask Shopping AI");
    fireEvent.change(textarea, {
      target: { value: "Add Trail Blazer GTX and prefill checkout" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByTestId("ai-checkout-prefill-card")).toBeTruthy();
    expect(qc.getQueryData(["store-cart"])).toEqual(sampleCart);

    fireEvent.click(screen.getByRole("button", { name: /Review & Place Order/i }));
    expect(mockPush).toHaveBeenCalledWith("/store/checkout");
    expect(useCheckoutPrefillStore.getState().prefill?.line1).toBe("123 Nguyen Hue");
  });

  it("hydrates CheckoutPage from prefill store with review banner and never auto-submits order", async () => {
    const checkoutSpy = vi.spyOn(storeApi, "checkout");
    useCheckoutPrefillStore.getState().setPrefill({
      customerName: "Samir Patel",
      customerEmail: "customer@datcommerce.local",
      line1: "123 Nguyen Hue",
      city: "Ho Chi Minh City",
      state: "HCM",
      postalCode: "700000",
      shippingMethod: "express",
      promotionCode: "WELCOME15",
      note: "",
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <CheckoutPage
          cart={sampleCart}
          loading={false}
          defaultProfile={{ name: "Guest", email: "" }}
          onOrderPlaced={vi.fn()}
          notify={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByTestId("checkout-ai-prefill-banner")).toBeTruthy();
    expect(
      (screen.getByLabelText(/Full name/i) as HTMLInputElement).value
    ).toBe("Samir Patel");
    expect(
      (screen.getByLabelText(/Street address/i) as HTMLInputElement).value
    ).toBe("123 Nguyen Hue");
    expect((screen.getByLabelText(/City/i) as HTMLInputElement).value).toBe(
      "Ho Chi Minh City"
    );
    expect(checkoutSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Clear prefill/i }));
    await waitFor(() => {
      expect(useCheckoutPrefillStore.getState().prefill).toBeNull();
    });
  });
});
