import type { ReactNode } from "react";
import { StorefrontShell } from "@/features/storefront/StorefrontShell";
import {
  fetchStoreActiveExperience,
  fetchStoreNavigation,
  fetchStoreTheme,
} from "@/lib/store-server";


export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, navigation, activeExperience] = await Promise.all([
    fetchStoreTheme(),
    fetchStoreNavigation("main"),
    fetchStoreActiveExperience(),
  ]);

  return (
    <StorefrontShell
      initialTheme={theme}
      initialNavigation={navigation}
      initialExperience={activeExperience}
    >
      {children}
    </StorefrontShell>
  );
}
