"use client";

import { AppErrorView } from "@/components/app-error-view";

export default function AdminError({
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
      title="Admin workspace encountered an error"
      description="An unexpected error occurred in the merchant workspace. Your saved data is unaffected."
      homeHref="/admin"
      homeLabel="Admin dashboard"
      secondaryHref="/"
      secondaryLabel="Public storefront"
    />
  );
}
