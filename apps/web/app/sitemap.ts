import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import {
  fetchStoreCategories,
  fetchStoreCollections,
  fetchStoreProductsForSitemap,
} from "@/lib/store-server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/store/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/store/categories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/store/collections`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/store/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/store/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const [products, categories, collections] = await Promise.all([
    fetchStoreProductsForSitemap(100),
    fetchStoreCategories(),
    fetchStoreCollections(),
  ]);

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/store/product/${encodeURIComponent(product.slug)}`,
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    changeFrequency: "daily",
    priority: 0.85,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/store/category/${encodeURIComponent(category.slug)}`,
    lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map(
    (collection) => ({
      url: `${siteUrl}/store/collection/${encodeURIComponent(collection.slug)}`,
      lastModified: collection.updatedAt ? new Date(collection.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.75,
    })
  );

  return [
    ...staticEntries,
    ...productEntries,
    ...categoryEntries,
    ...collectionEntries,
  ];
}
