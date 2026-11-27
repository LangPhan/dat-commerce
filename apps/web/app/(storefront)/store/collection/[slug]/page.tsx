import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionsView } from "@/features/storefront/views/CollectionsView";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildStoreMetadata,
  truncateDescription,
} from "@/lib/seo";
import { fetchStoreCollections, fetchStoreProducts } from "@/lib/store-server";

export const revalidate = 60;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const collections = await fetchStoreCollections();
  return collections.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collections = await fetchStoreCollections();
  const collection = collections.find((c) => c.slug === slug || c.id === slug);
  if (!collection) {
    return buildStoreMetadata({
      title: "Collection Not Found",
      description: "The requested collection does not exist.",
      noindex: true,
      nofollow: true,
    });
  }

  return buildStoreMetadata({
    title: collection.name,
    description:
      truncateDescription(collection.description) ||
      `Explore the ${collection.name} curated collection.`,
    canonical: `/store/collection/${encodeURIComponent(collection.slug)}`,
  });
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [collections, catalogRes] = await Promise.all([
    fetchStoreCollections(),
    fetchStoreProducts({ size: 24 }),
  ]);

  const collection = collections.find((c) => c.slug === slug || c.id === slug);
  if (!collection) {
    notFound();
  }

  const canonical = `/store/collection/${encodeURIComponent(collection.slug)}`;

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Collections", path: "/store/collections" },
          { name: collection.name, path: canonical },
        ])}
      />
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: collection.name,
          description:
            truncateDescription(collection.description) ||
            `Explore the ${collection.name} curated collection.`,
          path: canonical,
        })}
      />
      <CollectionsView
        collectionSlug={collection.slug}
        initialCollections={collections}
        initialCatalog={catalogRes?.items}
      />
    </>
  );
}
