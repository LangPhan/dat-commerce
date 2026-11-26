"use client";

import { AppErrorView } from "@/components/app-error-view";

export default function RootError({
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
      title="Something went wrong"
      description="We ran into an unexpected error loading this page. Try reloading the view or return home."
      homeHref="/"
      homeLabel="Back to home"
    />
  );
}
