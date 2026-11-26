"use client";

import { AppErrorView } from "@/components/app-error-view";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorView
      error={error}
      reset={reset}
      title="We could not load this storefront view"
      description="Something interrupted rendering this page. Please try again or continue shopping from the catalog."
      homeHref="/"
      homeLabel="Storefront home"
      secondaryHref="/store/shop"
      secondaryLabel="Browse catalog"
    />
  );
}
