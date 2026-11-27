"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Toast } from "@/components/ui/toast";
import { experienceStoreApi } from "@/features/experiences/api";
import {
  matchesTargetPages,
  mergeExperienceHeaderConfig,
  mergeExperienceThemeVars,
} from "@/features/experiences/theme-merge";
import type { ResolvedStorefrontExperienceDto } from "@/features/experiences/types";
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

const ExperienceTopSlot = dynamic(
  () =>
    import("@/features/experiences/runtime/ExperienceRuntime").then(
      (m) => m.ExperienceTopSlot
    ),
  { ssr: false }
);
const ExperienceHeaderFrameSlot = dynamic(
  () =>
    import("@/features/experiences/runtime/ExperienceRuntime").then(
      (m) => m.ExperienceHeaderFrameSlot
    ),
  { ssr: false }
);
const ExperienceHeroSlot = dynamic(
  () =>
    import("@/features/experiences/runtime/ExperienceRuntime").then(
      (m) => m.ExperienceHeroSlot
    ),
  { ssr: false }
);
const ExperienceFooterSlot = dynamic(
  () =>
    import("@/features/experiences/runtime/ExperienceRuntime").then(
      (m) => m.ExperienceFooterSlot
    ),
  { ssr: false }
);
const ExperienceOverlayRuntime = dynamic(
  () =>
    import("@/features/experiences/runtime/ExperienceRuntime").then(
      (m) => m.ExperienceOverlayRuntime
    ),
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
  initialExperience,
  children,
}: {
  initialTheme?: ThemeVersionDto | null;
  initialNavigation?: NavigationMenuDto | null;
  initialExperience?: ResolvedStorefrontExperienceDto | null;
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
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const prevInitialThemeIdRef = useRef(initialTheme?.id);
  useEffect(() => {
    if (initialTheme && initialTheme.id !== prevInitialThemeIdRef.current) {
      prevInitialThemeIdRef.current = initialTheme.id;
      queryClient.setQueryData(["store-theme"], initialTheme);
    }
  }, [initialTheme, queryClient]);

  const navQuery = useQuery({
    queryKey: ["store-nav", "main"],
    queryFn: () => cmsStoreApi.getNavigation("main"),
    initialData: initialNavigation ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const experienceQuery = useQuery({
    queryKey: ["store-active-experience"],
    queryFn: () => experienceStoreApi.getActive(),
    initialData: initialExperience ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const activeExperience = experienceQuery.data;

  // Auto-switch live storefront right when a scheduled experience starts or ends
  useEffect(() => {
    const nextIso = activeExperience?.nextTransitionAt;
    if (!nextIso) return;
    const targetMs = Date.parse(nextIso);
    if (!Number.isFinite(targetMs)) return;
    const delayMs = targetMs - Date.now() + 1200;
    if (delayMs <= 0) {
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      return;
    }
    const clampedDelay = Math.min(delayMs, 2_147_483_000);
    const timer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
    }, clampedDelay);
    return () => window.clearTimeout(timer);
  }, [activeExperience?.nextTransitionAt, queryClient]);

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

  const routeMatchesExperience = useMemo(() => {
    if (!activeExperience?.enabled || !activeExperience.activeExperiences?.length) {
      return false;
    }
    return activeExperience.activeExperiences.some((exp) =>
      matchesTargetPages(pathname, exp.targetPages)
    );
  }, [activeExperience, pathname]);

  const effectiveThemeOverride = routeMatchesExperience
    ? activeExperience?.effectiveThemeOverride
    : null;

  const themeCssVars = useMemo(() => {
    const base = themeTokensToCssVars(themeQuery.data?.tokens);
    return mergeExperienceThemeVars(base, effectiveThemeOverride);
  }, [themeQuery.data?.tokens, effectiveThemeOverride]);

  const mergedHeaderConfig = useMemo(
    () =>
      mergeExperienceHeaderConfig(
        themeQuery.data?.tokens?.header,
        effectiveThemeOverride
      ),
    [themeQuery.data?.tokens?.header, effectiveThemeOverride]
  );

  const isExperienceDark =
    Boolean(effectiveThemeOverride?.enabled) &&
    effectiveThemeOverride?.mode === "dark_luxe";
  const ctaHighlight = effectiveThemeOverride?.enabled
    ? effectiveThemeOverride.ctaHighlight
    : null;
  const hasVisibleExperience =
    routeMatchesExperience &&
    Boolean(
      activeExperience?.layers?.length || effectiveThemeOverride?.enabled
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
      <div
        className="store public-store"
        style={themeCssVars}
        data-experience-dark={isExperienceDark ? "true" : undefined}
        data-experience-cta-shimmer={
          ctaHighlight?.enabled && ctaHighlight.shimmer ? "true" : undefined
        }
        data-experience-cta-badge={
          ctaHighlight?.enabled && ctaHighlight.badgeText
            ? ctaHighlight.badgeText
            : undefined
        }
      >
        <GlobalTypographyStyleTag
          typography={themeQuery.data?.tokens?.typography}
          scopeId="storefront"
          scopeSelector=".store.public-store"
        />
        <StorePageReveal ready={pageReady} brandName={brandName}>
          {hasVisibleExperience ? (
            <ExperienceTopSlot
              experience={activeExperience}
              currentPath={pathname}
            />
          ) : null}
          <div className="exp-header-anchor">
            <StoreHeader
              cart={cartCount}
              wishlistCount={wishlist.length}
              currentPath={pathname}
              freeShippingThresholdOverride={cart?.freeShippingThreshold}
              headerConfig={mergedHeaderConfig}
              initialNavItems={navQuery.data?.items}
            />
            {hasVisibleExperience ? (
              <ExperienceHeaderFrameSlot
                experience={activeExperience}
                currentPath={pathname}
              />
            ) : null}
          </div>
          {hasVisibleExperience ? (
            <ExperienceHeroSlot
              experience={activeExperience}
              currentPath={pathname}
            />
          ) : null}
          <main>{children}</main>
          {hasVisibleExperience ? (
            <ExperienceFooterSlot
              experience={activeExperience}
              currentPath={pathname}
            />
          ) : null}
          <StoreFooter
            footerConfig={themeQuery.data?.tokens?.footer}
            onNotify={emitStoreToast}
          />
          {hasVisibleExperience ? (
            <ExperienceOverlayRuntime
              experience={activeExperience}
              currentPath={pathname}
            />
          ) : null}
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
