import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { Listing } from "@/features/storefront/listing";
import { parseListingSearchParams } from "@/features/storefront/listing-url";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildStoreMetadata,
} from "@/lib/seo";
import { fetchStoreCategories, fetchStoreProducts } from "@/lib/store-server";

export const metadata: Metadata = buildStoreMetadata({
  title: "Shop All Products",
  description:
    "Browse the full product catalog with dynamic filters, pricing, and availability.",
  canonical: "/store/shop",
});

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialUrlState = parseListingSearchParams(await searchParams);
  const [initialProducts, initialCategories] = await Promise.all([
    fetchStoreProducts({
      q: initialUrlState.q || undefined,
      category: initialUrlState.category || undefined,
      maxPrice: initialUrlState.maxPrice
        ? Number(initialUrlState.maxPrice)
        : undefined,
      sort: initialUrlState.sort,
      page: initialUrlState.page - 1,
      size: 6,
      attrs: initialUrlState.attrs,
    }),
    fetchStoreCategories(),
  ]);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/store/shop" },
        ])}
      />
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: "Shop All Products",
          description:
            "Browse the full product catalog with dynamic filters, pricing, and availability.",
          path: "/store/shop",
        })}
      />
      <Suspense
        fallback={
          <div className="store-container">
            <Skeleton rows={4} />
          </div>
        }
      >
        <Listing
          initialProducts={initialProducts}
          initialCategories={initialCategories}
          initialUrlState={initialUrlState}
        />
      </Suspense>
    </>
  );
}
