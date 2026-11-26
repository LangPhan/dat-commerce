import type { Metadata } from "next";
import { ConfirmationView } from "@/features/storefront/views/TransactionalViews";
import { buildStoreMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Order Confirmation",
  description: "View your order receipt and shipment summary.",
  noindex: true,
  nofollow: true,
});

export default async function ConfirmationDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return <ConfirmationView orderNumber={orderNumber} />;
}
