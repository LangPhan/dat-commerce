import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoreFooter, StoreHeader } from "../header-footer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useOptionalAuth: () => ({ user: null, logout: vi.fn() }),
  isAdminUser: () => false,
}));

describe("Editable StoreHeader & StoreFooter", () => {
  it("renders custom announcement, logo image, sticky class, and action visibility in StoreHeader", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <StoreHeader
          preview
          cart={3}
          wishlistCount={2}
          freeShippingThresholdOverride={150}
          headerConfig={{
            announcement: {
              enabled: true,
              text: "Free shipping over {freeShippingThreshold}",
              bgColor: "#112233",
              textColor: "#FFFFFF",
            },
            logo: {
              text: "ALPINE",
              imageUrl: "/media/alpine-logo.png",
              showIcon: false,
              heightPx: 32,
            },
            layout: {
              sticky: true,
              heightPx: 70,
            },
            actions: {
              showSearch: true,
              showWishlist: false,
              showAccount: true,
              showCart: true,
            },
          }}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("Free shipping over $150")).toBeInTheDocument();
    expect(screen.getByAltText("ALPINE")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Wishlist/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cart (3)")).toBeInTheDocument();
    const header = container.querySelector(".store-header") as HTMLElement;
    expect(header.style.getPropertyValue("--store-header-h")).toBe("70px");
  });

  it("renders custom footer columns, social links, newsletter, and {year} copyright", () => {
    render(
      <StoreFooter
        preview
        footerConfig={{
          brand: {
            name: "Alpine Studio",
            description: "Technical outerwear.",
          },
          columns: [
            {
              id: "c1",
              title: "Explore",
              links: [{ id: "l1", label: "Shop All", url: "/store/shop" }],
            },
          ],
          newsletter: {
            enabled: true,
            title: "Join our dispatch",
            placeholder: "email@alpine.test",
            buttonLabel: "Join",
          },
          socialLinks: [
            { id: "s1", platform: "instagram", url: "https://instagram.com/alpine" },
          ],
          bottomBar: {
            copyrightText: "© {year} Alpine Studio",
            contactEmail: "support@alpine.test",
          },
        }}
      />
    );

    expect(screen.getByText("ALPINE STUDIO")).toBeInTheDocument();
    expect(screen.getByText("Technical outerwear.")).toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop All" })).toHaveAttribute(
      "href",
      "/store/shop"
    );
    expect(screen.getByText("Join our dispatch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/alpine"
    );
    const year = String(new Date().getFullYear());
    expect(screen.getByText(`© ${year} Alpine Studio`)).toBeInTheDocument();
    expect(screen.getByText("support@alpine.test")).toBeInTheDocument();
  });
});
