import type { Metadata } from "next";
import { CheckoutView } from "@/features/storefront/views/TransactionalViews";
import { buildStoreMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Checkout",
  description: "Complete your order securely.",
  noindex: true,
  nofollow: true,
});

export default function CheckoutRoutePage() {
  return <CheckoutView />;
}
