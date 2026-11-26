import type { Metadata } from "next";
import { Storefront } from "@/features/storefront/storefront";
import { fetchStorePage } from "@/lib/store-server";

const DEFAULT_DESCRIPTION =
  "AI-native ecommerce platform for designing, merchandising, and operating your store.";

export async function generateMetadata(): Promise<Metadata> {
  const homePage = await fetchStorePage("home");
  const title = homePage?.seoTitle || homePage?.title || "Dat Commerce";
  const description = homePage?.seoDescription || DEFAULT_DESCRIPTION;

  return {
    title: homePage?.seoTitle || homePage?.title ? { absolute: title } : undefined,
    description,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title,
      description,
      url: "/",
      type: "website",
    },
  };
}

export default function HomePage() {
  return <Storefront route={[]} />;
}
