import type { Metadata } from "next";
import { Storefront } from "@/features/storefront/storefront";
import {
  fetchStoreCategories,
  fetchStoreCollections,
  fetchStorePage,
  fetchStoreProduct,
} from "@/lib/store-server";

const PRIVATE_VIEWS = new Set([
  "cart",
  "checkout",
  "confirmation",
  "wishlist",
  "account",
  "history",
]);

const STATIC_VIEW_METADATA: Record<
  string,
  { title: string; description: string }
> = {
  shop: {
    title: "Shop All Products",
    description:
      "Browse the full product catalog with dynamic filters, pricing, and availability.",
  },
  search: {
    title: "Search Catalog",
    description: "Search products, categories, and specifications across the store.",
  },
  categories: {
    title: "Categories",
    description: "Explore every product category with specification filters.",
  },
  collections: {
    title: "Collections",
    description: "Discover curated seasonal and editorial product collections.",
  },
  about: {
    title: "About",
    description: "Learn more about our brand story, craft, and mission.",
  },
  contact: {
    title: "Contact Support",
    description:
      "Reach out with questions about sizing, product specifications, or existing orders.",
  },
  cart: {
    title: "Shopping Cart",
    description: "Review items in your shopping cart before checkout.",
  },
  checkout: {
    title: "Checkout",
    description: "Complete your order securely.",
  },
  confirmation: {
    title: "Order Confirmation",
    description: "View your order receipt and shipment summary.",
  },
  wishlist: {
    title: "Wishlist",
    description: "View products you saved to your wishlist.",
  },
  account: {
    title: "Account",
    description: "Manage your customer profile and shipping defaults.",
  },
  history: {
    title: "Order History",
    description: "Review recent orders placed in this storefront.",
  },
};

function truncateDescription(text: string | null | undefined, max = 160): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ route?: string[] }>;
}): Promise<Metadata> {
  const route = (await params).route || [];
  const [view = "", id] = route;

  if (!view) {
    const homePage = await fetchStorePage("home");
    const title = homePage?.seoTitle || homePage?.title || "Storefront";
    const description =
      homePage?.seoDescription ||
      "Explore featured products, collections, and categories.";
    return {
      title,
      description,
      alternates: { canonical: "/" },
      openGraph: { title, description, url: "/store" },
    };
  }

  if (view === "product" && id) {
    const product = await fetchStoreProduct(id);
    if (!product) {
      return {
        title: "Product",
        description: "View product details, variants, and specifications.",
      };
    }
    const title = product.seoTitle || product.name;
    const description =
      truncateDescription(product.seoDescription || product.description) ||
      `Shop ${product.name}${product.brand ? ` by ${product.brand}` : ""}.`;
    const image = product.primaryImageUrl || product.images[0]?.url || undefined;
    const canonical = `/store/product/${encodeURIComponent(product.slug)}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: "website",
        ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  }

  if (view === "category" && id) {
    const categories = await fetchStoreCategories();
    const category = categories.find((c) => c.slug === id || c.id === id);
    if (category) {
      const title = category.name;
      const description =
        truncateDescription(category.seoDescription || category.description) ||
        `Browse ${category.name} products with dynamic specification filters.`;
      const canonical = `/store/category/${encodeURIComponent(category.slug)}`;
      return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
          title,
          description,
          url: canonical,
          ...(category.imageUrl
            ? { images: [{ url: category.imageUrl, alt: category.name }] }
            : {}),
        },
      };
    }
  }

  if (view === "collection" && id) {
    const collections = await fetchStoreCollections();
    const collection = collections.find((c) => c.slug === id || c.id === id);
    if (collection) {
      const title = collection.name;
      const description =
        truncateDescription(collection.description) ||
        `Explore the ${collection.name} curated collection.`;
      const canonical = `/store/collection/${encodeURIComponent(collection.slug)}`;
      return {
        title,
        description,
        alternates: { canonical },
        openGraph: { title, description, url: canonical },
      };
    }
  }

  if (PRIVATE_VIEWS.has(view)) {
    const meta = STATIC_VIEW_METADATA[view];
    return {
      title: meta.title,
      description: meta.description,
      robots: { index: false, follow: false },
    };
  }

  if (view === "about" || view === "collections") {
    const cmsPage = await fetchStorePage(view);
    const fallback = STATIC_VIEW_METADATA[view];
    const title = cmsPage?.seoTitle || cmsPage?.title || fallback.title;
    const description = cmsPage?.seoDescription || fallback.description;
    const canonical = `/store/${view}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical },
    };
  }

  if (STATIC_VIEW_METADATA[view]) {
    const meta = STATIC_VIEW_METADATA[view];
    const canonical = `/store/${view}`;
    return {
      title: meta.title,
      description: meta.description,
      alternates: { canonical },
      openGraph: { title: meta.title, description: meta.description, url: canonical },
    };
  }

  // Custom CMS page slug
  const cmsPage = await fetchStorePage(view);
  if (cmsPage) {
    const title = cmsPage.seoTitle || cmsPage.title;
    const description =
      truncateDescription(cmsPage.seoDescription) ||
      `Explore ${cmsPage.title} on Dat Commerce.`;
    const canonical = `/store/${encodeURIComponent(cmsPage.slug)}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical },
    };
  }

  return {
    title: "Page Not Found",
    description: "The page you requested does not exist or has moved.",
    robots: { index: false, follow: false },
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ route?: string[] }>;
}) {
  return <Storefront route={(await params).route || []} />;
}
