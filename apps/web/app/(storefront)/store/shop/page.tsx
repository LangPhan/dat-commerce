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

export const revalidate = 60;

export const metadata: Metadata = buildStoreMetadata({
  title: "Shop All Products",
  description:
    "Browse the full product catalog with dynamic filters, pricing, and availability.",
  canonical: "/store/shop",
});

export default async function ShopPage() {
  const initialUrlState = parseListingSearchParams({});
  const [initialProducts, initialCategories] = await Promise.all([
    fetchStoreProducts({
      sort: initialUrlState.sort,
      page: 0,
      size: 6,
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
