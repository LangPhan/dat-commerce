import type { Metadata } from "next";
import { CmsPageView } from "@/features/storefront/views/CmsPageView";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildStoreMetadata,
} from "@/lib/seo";
import {
  fetchStoreAnimationPresets,
  fetchStoreCategories,
  fetchStorePage,
  fetchStoreProducts,
} from "@/lib/store-server";
import { pageTemplates } from "@/mocks/pages";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await fetchStorePage("about");
  return buildStoreMetadata({
    title: cmsPage?.seoTitle || cmsPage?.title || "About",
    description:
      cmsPage?.seoDescription ||
      "Learn more about our brand story, craft, and mission.",
    canonical: "/store/about",
  });
}

export default async function AboutPage() {
  const [cmsPage, catalogRes, categories, presets] = await Promise.all([
    fetchStorePage("about"),
    fetchStoreProducts({ size: 24 }),
    fetchStoreCategories(),
    fetchStoreAnimationPresets(),
  ]);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: cmsPage?.title || "About", path: "/store/about" },
        ])}
      />
      <CmsPageView
        slug="about"
        initialPage={cmsPage}
        initialCatalog={catalogRes?.items}
        initialCategories={categories}
        initialPresets={presets}
        fallbackBlocks={pageTemplates["About page"] || []}
      />
    </>
  );
}
