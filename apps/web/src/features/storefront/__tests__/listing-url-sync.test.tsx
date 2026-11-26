import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeApi } from "@/lib/commerce-api";
import { Listing } from "../listing";
import {
  buildListingHref,
  parseListingSearchParams,
  serializeListingSearchParams,
} from "../listing-url";

const pushMock = vi.fn();
const replaceMock = vi.fn();
let currentSearch = "";
let currentPathname = "/store/shop";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderListing() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Listing />
    </QueryClientProvider>
  );
}

describe("listing-url helpers", () => {
  it("parses search, filters, attrs, view, sort, and page with safe defaults", () => {
    const parsed = parseListingSearchParams(
      new URLSearchParams(
        "q=%20trail%20&category=footwear&maxPrice=300&sort=low&attr.waterproof=true&attr.brand=Salomon&view=list&page=3"
      )
    );
    expect(parsed).toEqual({
      q: "trail",
      category: "footwear",
      maxPrice: "300",
      sort: "low",
      attrs: { brand: "Salomon", waterproof: "true" },
      view: "list",
      page: 3,
    });

    const invalid = parseListingSearchParams({
      maxPrice: "-5",
      sort: "unknown",
      page: "0",
      view: "compact",
      "attr.empty": "   ",
    });
    expect(invalid).toEqual({
      q: "",
      category: "",
      maxPrice: "",
      sort: "featured",
      attrs: {},
      view: "grid",
      page: 1,
    });
  });

  it("serializes canonically and omits default values and forcedCategory", () => {
    const qs = serializeListingSearchParams(
      {
        q: "trail",
        category: "footwear",
        maxPrice: "300",
        sort: "featured",
        attrs: { waterproof: "true", brand: "Salomon" },
        view: "grid",
        page: 1,
      },
      { forcedCategory: "footwear" }
    );
    expect(qs).toBe("q=trail&maxPrice=300&attr.brand=Salomon&attr.waterproof=true");

    expect(
      buildListingHref("/store/shop", {
        q: "",
        category: "",
        maxPrice: "",
        sort: "featured",
        attrs: {},
        view: "grid",
        page: 1,
      })
    ).toBe("/store/shop");
  });
});

describe("Listing URL sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    replaceMock.mockReset();
    currentSearch = "";
    currentPathname = "/store/shop";

    vi.spyOn(storeApi, "listCategories").mockResolvedValue([
      {
        id: "cat-1",
        slug: "footwear",
        name: "Footwear",
        description: "Trail & running shoes",
        seoDescription: null,
        imageUrl: null,
        parentId: null,
        defaultProductTypeId: null,
        productCount: 12,
        updatedAt: "2026-11-20T00:00:00Z",
      },
    ]);

    vi.spyOn(storeApi, "listProducts").mockResolvedValue({
      items: [
        {
          id: "prod-1",
          productTypeId: "pt-1",
          productTypeName: "Footwear",
          productTypeCode: "footwear",
          slug: "trail-runner-1",
          name: "Trail Runner 1",
          brand: "Terrain",
          description: "Waterproof trail shoe",
          status: "ACTIVE",
          primaryImageUrl: "/media/shoe.jpg",
          rating: 4.9,
          reviewCount: 14,
          variants: [
            {
              id: "var-1",
              sku: "TR-1",
              title: "Default",
              status: "ACTIVE",
              currency: "USD",
              price: 180,
              compareAtPrice: null,
              availableStock: 10,
              version: 0,
              options: {},
            },
          ],
          categories: [{ id: "cat-1", slug: "footwear", name: "Footwear" }],
          attributes: [],
          images: [],
          minPrice: 180,
          maxPrice: 180,
          totalStock: 10,
          version: 0,
          createdAt: "2026-11-20T00:00:00Z",
          updatedAt: "2026-11-20T00:00:00Z",
        },
      ],
      facets: [
        { code: "waterproof", name: "Waterproof", dataType: "TEXT", unit: null, values: ["Yes"] },
      ],
      page: 0,
      size: 6,
      totalElements: 18,
      totalPages: 3,
    });
  });

  it("hydrates query, filters, sort, view, and page from URL searchParams", async () => {
    currentSearch =
      "q=trail&category=footwear&maxPrice=300&sort=low&attr.waterproof=Yes&view=list&page=2";

    renderListing();

    await waitFor(() => {
      expect(storeApi.listProducts).toHaveBeenCalledWith({
        q: "trail",
        category: "footwear",
        maxPrice: 300,
        sort: "low",
        page: 1,
        size: 6,
        attrs: { waterproof: "Yes" },
      });
    });

    const input = screen.getByLabelText("Search products") as HTMLInputElement;
    expect(input.value).toBe("trail");
    expect(screen.getByLabelText("List view").getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => {
      expect(screen.getByText("Category: Footwear")).toBeTruthy();
    });
    expect(screen.getByText("Max $300")).toBeTruthy();
  });

  it("syncs debounced search to router.replace and pagination/view/clear to router", async () => {
    currentSearch = "page=2&maxPrice=300";
    renderListing();

    await waitFor(() => {
      expect(screen.getByText("Trail Runner 1")).toBeTruthy();
    });

    vi.useFakeTimers();
    const input = screen.getByLabelText("Search products");
    fireEvent.change(input, { target: { value: "headlamp" } });

    await act(async () => {
      vi.advanceTimersByTime(320);
    });
    vi.useRealTimers();

    expect(replaceMock).toHaveBeenCalledWith(
      "/store/shop?q=headlamp&maxPrice=300",
      { scroll: false }
    );

    fireEvent.click(screen.getByLabelText("List view"));
    expect(replaceMock).toHaveBeenCalledWith(
      "/store/shop?maxPrice=300&view=list&page=2",
      { scroll: false }
    );

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(pushMock).toHaveBeenCalledWith(
      "/store/shop?maxPrice=300&page=3",
      { scroll: false }
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(pushMock).toHaveBeenCalledWith("/store/shop", { scroll: false });
  });
});
