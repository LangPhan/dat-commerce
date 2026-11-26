import type { Metadata } from "next";
import type { ProductDto } from "@/types/api-commerce";
import { getSiteUrl } from "./site-url";

export function truncateDescription(
  text: string | null | undefined,
  max = 160
): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

export function buildStoreMetadata({
  title,
  description,
  canonical,
  image,
  imageAlt,
  noindex = false,
  nofollow = false,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  imageAlt?: string;
  noindex?: boolean;
  nofollow?: boolean;
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    ...(noindex || nofollow
      ? {
          robots: {
            index: !noindex,
            follow: !nofollow,
          },
        }
      : {}),
    openGraph: {
      title,
      description,
      ...(canonical ? { url: canonical } : {}),
      type: "website",
      ...(image
        ? { images: [{ url: image, ...(imageAlt ? { alt: imageAlt } : {}) }] }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

export function toAbsoluteUrl(pathOrUrl: string, siteUrl = getSiteUrl()): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${normalized}`;
}

export function buildOrganizationJsonLd(
  storeName = "Dat Commerce",
  contactEmail = "hello@datcommerce.local",
  siteUrl = getSiteUrl()
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: storeName,
    url: siteUrl,
    ...(contactEmail
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            email: contactEmail,
            contactType: "customer support",
          },
        }
      : {}),
  };
}

export function buildWebSiteJsonLd(
  storeName = "Dat Commerce",
  siteUrl = getSiteUrl()
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: storeName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/store/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  siteUrl = getSiteUrl()
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path, siteUrl),
    })),
  };
}

export function buildCollectionPageJsonLd(
  {
    name,
    description,
    path,
  }: {
    name: string;
    description: string;
    path: string;
  },
  siteUrl = getSiteUrl()
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: toAbsoluteUrl(path, siteUrl),
  };
}

export function buildItemListJsonLd(
  items: Array<{ name: string; path: string }>,
  siteUrl = getSiteUrl()
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      url: toAbsoluteUrl(item.path, siteUrl),
    })),
  };
}

export function buildProductJsonLd(
  product: ProductDto,
  siteUrl = getSiteUrl()
): Record<string, unknown> {
  const images = (
    product.images?.length
      ? product.images.map((i) => i.url)
      : product.primaryImageUrl
        ? [product.primaryImageUrl]
        : []
  ).map((u) => toAbsoluteUrl(u, siteUrl));

  const firstVariant = product.variants?.[0];
  const inStock =
    product.variants?.some((v) => (v.availableStock ?? 0) > 0) ?? true;
  const url = toAbsoluteUrl(
    `/store/product/${encodeURIComponent(product.slug)}`,
    siteUrl
  );

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description:
      truncateDescription(product.seoDescription || product.description, 320) ||
      product.name,
    ...(images.length ? { image: images } : {}),
    ...(firstVariant?.sku ? { sku: firstVariant.sku } : {}),
    ...(product.brand
      ? {
          brand: {
            "@type": "Brand",
            name: product.brand,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: Number(firstVariant?.price ?? product.minPrice ?? 0),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}
