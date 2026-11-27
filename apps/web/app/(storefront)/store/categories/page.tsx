import type { Metadata } from "next";
import { CategoriesIndexView } from "@/features/storefront/views/CategoriesIndexView";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  buildStoreMetadata,
} from "@/lib/seo";
import { fetchStoreCategories, fetchStoreProducts } from "@/lib/store-server";

export const revalidate = 60;

export const metadata: Metadata = buildStoreMetadata({
  title: "Categories",
  description: "Explore every product category with specification filters.",
  canonical: "/store/categories",
});

export default async function CategoriesPage() {
  const [categories, catalogRes] = await Promise.all([
    fetchStoreCategories(),
    fetchStoreProducts({ size: 24 }),
  ]);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/store/categories" },
        ])}
      />
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: "Categories",
          description: "Explore every product category with specification filters.",
          path: "/store/categories",
        })}
      />
      {categories.length > 0 ? (
        <JsonLd
          data={buildItemListJsonLd(
            categories.map((c) => ({
              name: c.name,
              path: `/store/category/${encodeURIComponent(c.slug)}`,
            }))
          )}
        />
      ) : null}
      <CategoriesIndexView
        initialCategories={categories}
        initialCatalog={catalogRes?.items}
      />
    </>
  );
}
