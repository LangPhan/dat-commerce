import type { Metadata } from "next";
import { ConfirmationView } from "@/features/storefront/views/TransactionalViews";
import { buildStoreMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Order Confirmation",
  description: "View your order receipt and shipment summary.",
  noindex: true,
  nofollow: true,
});

export default function ConfirmationIndexPage() {
  return <ConfirmationView />;
}
