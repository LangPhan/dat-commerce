import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { Listing } from "@/features/storefront/listing";
import { parseListingSearchParams } from "@/features/storefront/listing-url";
import { buildStoreMetadata } from "@/lib/seo";
import { fetchStoreCategories, fetchStoreProducts } from "@/lib/store-server";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const q = (await searchParams).q?.trim();
  return buildStoreMetadata({
    title: q ? `Search: ${q}` : "Search Catalog",
    description:
      "Search products, categories, and specifications across the store.",
    canonical: "/store/search",
    noindex: true,
    nofollow: false,
  });
}

export default async function SearchPage({
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
    <Suspense
      fallback={
        <div className="store-container">
          <Skeleton rows={4} />
        </div>
      }
    >
      <Listing
        search
        initialProducts={initialProducts}
        initialCategories={initialCategories}
        initialUrlState={initialUrlState}
      />
    </Suspense>
  );
}
