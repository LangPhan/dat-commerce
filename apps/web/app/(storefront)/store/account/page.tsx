import type { Metadata } from "next";
import { AccountView } from "@/features/storefront/views/TransactionalViews";
import { buildStoreMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Account",
  description: "Manage your customer profile and shipping defaults.",
  noindex: true,
  nofollow: true,
});

export default function AccountRoutePage() {
  return <AccountView />;
}
