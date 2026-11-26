import type { Metadata } from "next";
import { WishlistView } from "@/features/storefront/views/TransactionalViews";
import { buildStoreMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Wishlist",
  description: "View products you saved to your wishlist.",
  noindex: true,
  nofollow: true,
});

export default function WishlistRoutePage() {
  return <WishlistView />;
}
