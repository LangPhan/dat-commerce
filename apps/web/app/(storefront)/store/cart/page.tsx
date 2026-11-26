import type { Metadata } from "next";
import { CartView } from "@/features/storefront/views/TransactionalViews";
import { buildStoreMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Shopping Cart",
  description: "Review items in your shopping cart before checkout.",
  noindex: true,
  nofollow: true,
});

export default function CartRoutePage() {
  return <CartView />;
}
