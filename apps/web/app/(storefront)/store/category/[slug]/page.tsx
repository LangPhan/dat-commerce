import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { Listing } from "@/features/storefront/listing";
import { parseListingSearchParams } from "@/features/storefront/listing-url";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildStoreMetadata,
  truncateDescription,
} from "@/lib/seo";
import { fetchStoreCategories, fetchStoreProducts } from "@/lib/store-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await fetchStoreCategories();
  const category = categories.find((c) => c.slug === slug || c.id === slug);
  if (!category) {
    return buildStoreMetadata({
      title: "Category Not Found",
      description: "The requested product category does not exist.",
      noindex: true,
      nofollow: true,
    });
  }

  return buildStoreMetadata({
    title: category.name,
    description:
      truncateDescription(category.seoDescription || category.description) ||
      `Browse ${category.name} products with dynamic specification filters.`,
    canonical: `/store/category/${encodeURIComponent(category.slug)}`,
    image: category.imageUrl || undefined,
    imageAlt: category.name,
  });
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams]);
  const initialUrlState = parseListingSearchParams(rawSearch, slug);
  const [categories, initialProducts] = await Promise.all([
    fetchStoreCategories(),
    fetchStoreProducts({
      q: initialUrlState.q || undefined,
      category: slug,
      maxPrice: initialUrlState.maxPrice
        ? Number(initialUrlState.maxPrice)
        : undefined,
      sort: initialUrlState.sort,
      page: initialUrlState.page - 1,
      size: 6,
      attrs: initialUrlState.attrs,
    }),
  ]);

  const category = categories.find((c) => c.slug === slug || c.id === slug);
  if (!category) {
    notFound();
  }

  const canonical = `/store/category/${encodeURIComponent(category.slug)}`;

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/store/categories" },
          { name: category.name, path: canonical },
        ])}
      />
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: category.name,
          description:
            truncateDescription(category.seoDescription || category.description) ||
            `Browse ${category.name} products.`,
          path: canonical,
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
          key={`category:${category.slug}`}
          forcedCategory={category.slug}
          initialProducts={initialProducts}
          initialCategories={categories}
          initialUrlState={{ ...initialUrlState, category: category.slug }}
        />
      </Suspense>
    </>
  );
}
