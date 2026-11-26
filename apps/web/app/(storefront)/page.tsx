import type { Metadata } from "next";
import { CmsPageView } from "@/features/storefront/views/CmsPageView";
import {
  JsonLd,
  buildOrganizationJsonLd,
  buildStoreMetadata,
  buildWebSiteJsonLd,
} from "@/lib/seo";
import {
  fetchStoreAnimationPresets,
  fetchStoreCategories,
  fetchStorePage,
  fetchStoreProducts,
  fetchStoreTheme,
} from "@/lib/store-server";
import { initialBlocks } from "@/mocks/pages";

const DEFAULT_DESCRIPTION =
  "AI-native ecommerce platform for designing, merchandising, and operating your store.";

export async function generateMetadata(): Promise<Metadata> {
  const homePage = await fetchStorePage("home");
  const title = homePage?.seoTitle || homePage?.title || "Dat Commerce";
  const description = homePage?.seoDescription || DEFAULT_DESCRIPTION;

  return buildStoreMetadata({
    title,
    description,
    canonical: "/",
    absoluteTitle: Boolean(homePage?.seoTitle || homePage?.title),
  });
}

export default async function HomePage() {
  const [homePage, catalogRes, categories, presets, theme] = await Promise.all([
    fetchStorePage("home"),
    fetchStoreProducts({ size: 24 }),
    fetchStoreCategories(),
    fetchStoreAnimationPresets(),
    fetchStoreTheme(),
  ]);

  const storeName =
    theme?.tokens?.footer?.brand?.name ||
    theme?.tokens?.header?.logo?.text ||
    "Dat Commerce";
  const contactEmail =
    theme?.tokens?.footer?.bottomBar?.contactEmail || "hello@datcommerce.local";

  return (
    <>
      <JsonLd data={buildOrganizationJsonLd(storeName, contactEmail)} />
      <JsonLd data={buildWebSiteJsonLd(storeName)} />
      <CmsPageView
        slug="home"
        initialPage={homePage}
        initialCatalog={catalogRes?.items}
        initialCategories={categories}
        initialPresets={presets}
        fallbackBlocks={initialBlocks}
      />
    </>
  );
}
