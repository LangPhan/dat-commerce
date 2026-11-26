import type { Metadata } from "next";
import { HistoryView } from "@/features/storefront/views/TransactionalViews";
import { buildStoreMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Order History",
  description: "Review recent orders placed in this storefront.",
  noindex: true,
  nofollow: true,
});

export default function HistoryRoutePage() {
  return <HistoryView />;
}
