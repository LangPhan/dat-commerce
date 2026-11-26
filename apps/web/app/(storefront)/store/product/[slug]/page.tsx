import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPageView } from "@/features/storefront/views/ProductPageView";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildStoreMetadata,
  truncateDescription,
} from "@/lib/seo";
import { fetchStoreProduct, fetchStoreProducts } from "@/lib/store-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchStoreProduct(slug);
  if (!product) {
    return buildStoreMetadata({
      title: "Product Not Found",
      description: "The requested product could not be found.",
      noindex: true,
      nofollow: true,
    });
  }

  const title = product.seoTitle || product.name;
  const description =
    truncateDescription(product.seoDescription || product.description) ||
    `Shop ${product.name}${product.brand ? ` by ${product.brand}` : ""}.`;
  const image = product.primaryImageUrl || product.images[0]?.url || undefined;
  const canonical = `/store/product/${encodeURIComponent(product.slug)}`;

  return buildStoreMetadata({
    title,
    description,
    canonical,
    image,
    imageAlt: product.name,
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, catalogRes] = await Promise.all([
    fetchStoreProduct(slug),
    fetchStoreProducts({ size: 24 }),
  ]);

  if (!product) {
    notFound();
  }

  const primaryCat = product.categories[0];
  const breadcrumbItems = [
    { name: "Home", path: "/" },
    ...(primaryCat
      ? [
          {
            name: primaryCat.name,
            path: `/store/category/${encodeURIComponent(primaryCat.slug)}`,
          },
        ]
      : [{ name: "Shop", path: "/store/shop" }]),
    {
      name: product.name,
      path: `/store/product/${encodeURIComponent(product.slug)}`,
    },
  ];

  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbItems)} />
      <JsonLd data={buildProductJsonLd(product)} />
      <ProductPageView
        idOrSlug={slug}
        initialProduct={product}
        initialRelated={catalogRes?.items}
      />
    </>
  );
}
