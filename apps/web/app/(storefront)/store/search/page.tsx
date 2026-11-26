import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { Listing } from "@/features/storefront/listing";
import { buildStoreMetadata } from "@/lib/seo";

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

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="store-container">
          <Skeleton rows={4} />
        </div>
      }
    >
      <Listing search />
    </Suspense>
  );
}
