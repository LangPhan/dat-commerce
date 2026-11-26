import type { Metadata } from "next";
import { ContactView } from "@/features/storefront/views/TransactionalViews";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildStoreMetadata,
} from "@/lib/seo";

export const metadata: Metadata = buildStoreMetadata({
  title: "Contact Support",
  description:
    "Reach out with questions about sizing, product specifications, or existing orders.",
  canonical: "/store/contact",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact Support", path: "/store/contact" },
        ])}
      />
      <ContactView />
    </>
  );
}
