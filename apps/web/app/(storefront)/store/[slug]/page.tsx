import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageView } from "@/features/storefront/views/CmsPageView";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildStoreMetadata,
  truncateDescription,
} from "@/lib/seo";
import {
  fetchStoreAnimationPresets,
  fetchStoreCategories,
  fetchStorePage,
  fetchStoreProducts,
} from "@/lib/store-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cmsPage = await fetchStorePage(slug);
  if (!cmsPage) {
    return buildStoreMetadata({
      title: "Page Not Found",
      description: "The page you requested does not exist or has moved.",
      noindex: true,
      nofollow: true,
    });
  }

  return buildStoreMetadata({
    title: cmsPage.seoTitle || cmsPage.title,
    description:
      truncateDescription(cmsPage.seoDescription) ||
      `Explore ${cmsPage.title} on Dat Commerce.`,
    canonical: `/store/${encodeURIComponent(cmsPage.slug)}`,
  });
}

export default async function CustomCmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [cmsPage, catalogRes, categories, presets] = await Promise.all([
    fetchStorePage(slug),
    fetchStoreProducts({ size: 24 }),
    fetchStoreCategories(),
    fetchStoreAnimationPresets(),
  ]);

  if (!cmsPage) {
    notFound();
  }

  const canonical = `/store/${encodeURIComponent(cmsPage.slug)}`;

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: cmsPage.title, path: canonical },
        ])}
      />
      <CmsPageView
        slug={cmsPage.slug}
        initialPage={cmsPage}
        initialCatalog={catalogRes?.items}
        initialCategories={categories}
        initialPresets={presets}
      />
    </>
  );
}
