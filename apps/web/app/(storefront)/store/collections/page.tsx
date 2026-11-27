import type { Metadata } from "next";
import { CollectionsView } from "@/features/storefront/views/CollectionsView";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildStoreMetadata,
} from "@/lib/seo";
import {
  fetchStoreCollections,
  fetchStorePage,
  fetchStoreProducts,
} from "@/lib/store-server";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await fetchStorePage("collections");
  return buildStoreMetadata({
    title: cmsPage?.seoTitle || cmsPage?.title || "Collections",
    description:
      cmsPage?.seoDescription ||
      "Discover curated seasonal and editorial product collections.",
    canonical: "/store/collections",
  });
}

export default async function CollectionsPage() {
  const [cmsPage, collections, catalogRes] = await Promise.all([
    fetchStorePage("collections"),
    fetchStoreCollections(),
    fetchStoreProducts({ size: 24 }),
  ]);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Collections", path: "/store/collections" },
        ])}
      />
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: cmsPage?.title || "Collections",
          description:
            cmsPage?.seoDescription ||
            "Discover curated seasonal and editorial product collections.",
          path: "/store/collections",
        })}
      />
      <CollectionsView
        initialPage={cmsPage}
        initialCollections={collections}
        initialCatalog={catalogRes?.items}
      />
    </>
  );
}
