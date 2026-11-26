"use client";

import { createContext, useContext } from "react";
import type { CartResponse } from "@/types/api-commerce";
import type { ThemeVersionDto } from "@/types/api-cms-ai";
import type { StoreProductItem } from "./blocks";

export type StorefrontContextValue = {
  cart?: CartResponse;
  cartLoading: boolean;
  cartCount: number;
  wishlist: string[];
  wishlistSet: Set<string>;
  toggleWishlist: (productId: string) => void;
  addToCart: (args: { variantId: string; qty: number; buyNow?: boolean }) => void;
  addingToCart: boolean;
  quickAddToCart: (item: StoreProductItem) => void;
  notify: (message: string) => void;
  theme?: ThemeVersionDto;
};

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({
  value,
  children,
}: {
  value: StorefrontContextValue;
  children: React.ReactNode;
}) {
  return (
    <StorefrontContext.Provider value={value}>
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) {
    throw new Error("useStorefront must be used inside StorefrontShell");
  }
  return ctx;
}
