"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Toast } from "@/components/ui/toast";
import { GlobalTypographyStyleTag } from "@/features/typography/GlobalTypographyStyleTag";
import { ApiError } from "@/lib/api-client";
import { cmsStoreApi } from "@/lib/cms-ai-api";
import { themeTokensToCssVars } from "@/lib/cms-schema";
import { storeApi } from "@/lib/commerce-api";
import { useStored } from "@/lib/storage";
import type { NavigationMenuDto, ThemeVersionDto } from "@/types/api-cms-ai";
import type { StoreProductItem } from "./blocks";
import { StoreFooter, StoreHeader } from "./header-footer";
import { StorePageReveal } from "./page-reveal";
import { StorefrontProvider } from "./storefront-context";

const StorefrontAiAssistant = dynamic(
  () => import("./StorefrontAiAssistant").then((m) => m.StorefrontAiAssistant),
  { ssr: false }
);

const EMPTY_STRING_LIST: string[] = [];

// Isolated store toast pub/sub so toasts never re-render the entire Storefront tree.
let currentStoreToast = "";
let storeToastTimer: ReturnType<typeof setTimeout> | null = null;
const storeToastListeners = new Set<() => void>();

export function emitStoreToast(next: string) {
  currentStoreToast = next;
  if (storeToastTimer) {
    clearTimeout(storeToastTimer);
    storeToastTimer = null;
  }
  if (next) {
    storeToastTimer = setTimeout(() => {
      currentStoreToast = "";
      storeToastTimer = null;
      for (const listener of storeToastListeners) listener();
    }, 2800);
  }
  for (const listener of storeToastListeners) listener();
}

function subscribeStoreToast(listener: () => void) {
  storeToastListeners.add(listener);
  return () => {
    storeToastListeners.delete(listener);
  };
}

function getStoreToastSnapshot() {
  return currentStoreToast;
}

function getStoreToastServerSnapshot() {
  return "";
}

function StoreToastHost() {
  const message = useSyncExternalStore(
    subscribeStoreToast,
    getStoreToastSnapshot,
    getStoreToastServerSnapshot
  );

  useEffect(() => {
    return () => {
      if (storeToastTimer && storeToastListeners.size === 0) {
        clearTimeout(storeToastTimer);
        storeToastTimer = null;
      }
    };
  }, []);

  return <Toast message={message} />;
}

export function StorefrontShell({
  initialTheme,
  initialNavigation,
  children,
}: {
  initialTheme?: ThemeVersionDto | null;
  initialNavigation?: NavigationMenuDto | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const queryClient = useQueryClient();
  const [wishlist, setWishlist] = useStored<string[]>("wishlist", EMPTY_STRING_LIST);

  const themeQuery = useQuery({
    queryKey: ["store-theme"],
    queryFn: () => cmsStoreApi.getTheme(),
    initialData: initialTheme ?? undefined,
    staleTime: 60_000,
  });

  const navQuery = useQuery({
    queryKey: ["store-nav", "main"],
    queryFn: () => cmsStoreApi.getNavigation("main"),
    initialData: initialNavigation ?? undefined,
    staleTime: 60_000,
  });

  const cartQuery = useQuery({
    queryKey: ["store-cart"],
    queryFn: () => storeApi.getCart(),
  });

  const addToCartMutation = useMutation({
    mutationFn: ({
      variantId,
      qty,
    }: {
      variantId: string;
      qty: number;
      buyNow?: boolean;
    }) => storeApi.addCartItem(variantId, qty),
    onSuccess: (nextCart, vars) => {
      queryClient.setQueryData(["store-cart"], nextCart);
      if (vars.buyNow) {
        router.push("/store/checkout");
      } else {
        emitStoreToast("Added item to cart");
      }
    },
    onError: (err) =>
      emitStoreToast(
        err instanceof ApiError ? err.message : "Could not add item to cart"
      ),
  });

  const toggleWishlist = useCallback(
    (productId: string) => {
      let removed = false;
      setWishlist((current) => {
        removed = current.includes(productId);
        return removed
          ? current.filter((value) => value !== productId)
          : [...current, productId];
      });
      emitStoreToast(removed ? "Removed from wishlist" : "Saved to wishlist");
    },
    [setWishlist]
  );

  const handleQuickAddToCart = useCallback(
    (item: StoreProductItem) => {
      const variantId =
        "defaultVariantId" in item && typeof (item as { defaultVariantId?: unknown }).defaultVariantId === "string" ? (item as { defaultVariantId: string }).defaultVariantId : undefined;
      if (variantId) {
        addToCartMutation.mutate({ variantId, qty: 1 });
        return;
      }
      const rawSlug = "slug" in item ? (item as { slug?: unknown }).slug : undefined;
      const slug = typeof rawSlug === "string" && rawSlug ? rawSlug : item.id;
      router.push(`/store/product/${encodeURIComponent(slug)}`);
    },
    [addToCartMutation, router]
  );

  const cart = cartQuery.data;
  const cartCount = useMemo(
    () => (cart?.items || []).reduce((sum, item) => sum + item.quantity, 0),
    [cart?.items]
  );
  const wishlistSet = useMemo(() => new Set(wishlist), [wishlist]);
  const themeCssVars = useMemo(
    () => themeTokensToCssVars(themeQuery.data?.tokens),
    [themeQuery.data?.tokens]
  );

  const productSlugMatch = pathname.match(/^\/store\/product\/([^/?#]+)/);
  const productSlug = productSlugMatch
    ? decodeURIComponent(productSlugMatch[1])
    : undefined;

  const contextValue = useMemo(
    () => ({
      cart,
      cartLoading: cartQuery.isLoading,
      cartCount,
      wishlist,
      wishlistSet,
      toggleWishlist,
      addToCart: (args: { variantId: string; qty: number; buyNow?: boolean }) =>
        addToCartMutation.mutate(args),
      addingToCart: addToCartMutation.isPending,
      quickAddToCart: handleQuickAddToCart,
      notify: emitStoreToast,
      theme: themeQuery.data,
    }),
    [
      cart,
      cartQuery.isLoading,
      cartCount,
      wishlist,
      wishlistSet,
      toggleWishlist,
      addToCartMutation,
      handleQuickAddToCart,
      themeQuery.data,
    ]
  );

  const pageReady = !themeQuery.isPending;
  const brandName =
    themeQuery.data?.tokens?.header?.logo?.text || "TERRAIN";

  return (
    <StorefrontProvider value={contextValue}>
      <div className="store public-store" style={themeCssVars}>
        <GlobalTypographyStyleTag
          typography={themeQuery.data?.tokens?.typography}
          scopeId="storefront"
          scopeSelector=".store.public-store"
        />
        <StorePageReveal ready={pageReady} brandName={brandName}>
          <StoreHeader
            cart={cartCount}
            wishlistCount={wishlist.length}
            currentPath={pathname}
            freeShippingThresholdOverride={cart?.freeShippingThreshold}
            headerConfig={themeQuery.data?.tokens?.header}
            initialNavItems={navQuery.data?.items}
          />
          <main>{children}</main>
          <StoreFooter
            footerConfig={themeQuery.data?.tokens?.footer}
            onNotify={emitStoreToast}
          />
          <StoreToastHost />
        </StorePageReveal>
        <StorefrontAiAssistant
          currentPath={pathname}
          productSlug={productSlug}
          onNotify={emitStoreToast}
        />
      </div>
    </StorefrontProvider>
  );
}
