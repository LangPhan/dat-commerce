import { describe, expect, it } from "vitest";
import type { ProductDto } from "@/types/api-commerce";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildStoreMetadata,
  serializeJsonLd,
} from "../seo";

describe("SEO metadata & JSON-LD builders", () => {
  it("builds metadata with canonical, OpenGraph, Twitter, and optional noindex", () => {
    const meta = buildStoreMetadata({
      title: "Trail Shoe",
      description: "Lightweight trail shoe.",
      canonical: "/store/product/trail-shoe",
      image: "https://cdn.example.com/shoe.jpg",
      imageAlt: "Trail Shoe",
    });

    expect(meta.title).toBe("Trail Shoe");
    expect(meta.alternates?.canonical).toBe("/store/product/trail-shoe");
    expect(meta.openGraph?.url).toBe("/store/product/trail-shoe");
    expect((meta.twitter as { card?: string } | undefined)?.card).toBe("summary_large_image");
    expect(meta.robots).toBeUndefined();

    const privateMeta = buildStoreMetadata({
      title: "Cart",
      description: "Shopping cart",
      noindex: true,
      nofollow: true,
    });
    expect(privateMeta.robots).toEqual({ index: false, follow: false });
  });

  it("escapes < characters when serializing JSON-LD to prevent script injection", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
  });

  it("builds Product, BreadcrumbList, CollectionPage, and Organization schemas", () => {
    const product = {
      id: "p1",
      slug: "trail-blazer",
      name: "Trail Blazer",
      brand: "Terrain",
      description: "Waterproof hiking boot.",
      status: "ACTIVE",
      minPrice: 189,
      primaryImageUrl: "/media/boot.jpg",
      images: [],
      categories: [],
      variants: [
        {
          id: "v1",
          sku: "TB-42",
          title: "EU 42",
          price: 189,
          currency: "USD",
          status: "ACTIVE",
          options: {},
          version: 1,
          availableStock: 5,
        },
      ],
    } as unknown as ProductDto;

    const prodLd = buildProductJsonLd(product, "https://store.example.com");
    expect(prodLd["@type"]).toBe("Product");
    expect(prodLd.sku).toBe("TB-42");
    expect((prodLd.offers as Record<string, unknown>).price).toBe(189);
    expect((prodLd.offers as Record<string, unknown>).availability).toBe(
      "https://schema.org/InStock"
    );

    const crumb = buildBreadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name: "Trail Blazer", path: "/store/product/trail-blazer" },
      ],
      "https://store.example.com"
    );
    expect(crumb["@type"]).toBe("BreadcrumbList");
    expect(crumb.itemListElement).toHaveLength(2);

    const col = buildCollectionPageJsonLd(
      { name: "Shop", description: "All items", path: "/store/shop" },
      "https://store.example.com"
    );
    expect(col["@type"]).toBe("CollectionPage");
    expect(col.url).toBe("https://store.example.com/store/shop");

    const org = buildOrganizationJsonLd(
      "Terrain Supply",
      "hi@terrain.example",
      "https://store.example.com"
    );
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("Terrain Supply");
  });
});
