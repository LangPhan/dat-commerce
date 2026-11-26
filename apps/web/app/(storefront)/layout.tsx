import type { ReactNode } from "react";
import { StorefrontShell } from "@/features/storefront/StorefrontShell";
import { fetchStoreNavigation, fetchStoreTheme } from "@/lib/store-server";

export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, navigation] = await Promise.all([
    fetchStoreTheme(),
    fetchStoreNavigation("main"),
  ]);

  return (
    <StorefrontShell initialTheme={theme} initialNavigation={navigation}>
      {children}
    </StorefrontShell>
  );
}
