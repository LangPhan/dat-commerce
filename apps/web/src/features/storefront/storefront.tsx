"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ApiError } from "@/lib/api-client";
import { cmsStoreApi } from "@/lib/cms-ai-api";
import { apiBlocksToEditorBlocks, themeTokensToCssVars } from "@/lib/cms-schema";
import { storeApi } from "@/lib/commerce-api";
import { formatDate, usdExact } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { readStoredValue, writeStoredValue } from "@/lib/theme";
import { initialBlocks, pageTemplates } from "@/mocks/pages";
import type { OrderDto, CartResponse } from "@/types/api-commerce";
import type { CustomerProfile } from "@/types/commerce";
import { isV2Content } from "@/features/builder/migration";
import type { ElementNode } from "@/features/builder/types";
import { dtoToPresetDefinition } from "@/features/motion/presets";
import type { AnimationPresetDefinition, GlobalMotionSettings } from "@/features/motion/types";
import { GlobalTypographyStyleTag } from "@/features/typography/GlobalTypographyStyleTag";
import type { GlobalTypographyTokens } from "@/features/typography/types";
import {
  ProductCard,
  StoreBlock,
  type StoreCategoryItem,
  type StoreProductItem,
} from "./blocks";
import { StoreFooter, StoreHeader } from "./header-footer";
import { extractPreloadImageUrls, StorePageReveal } from "./page-reveal";

const storeSkeletonFallback = () => (
  <div className="store-container">
    <Skeleton rows={4} />
  </div>
);

const PageRenderer = dynamic(
  () => import("@/features/builder/renderer/PageRenderer").then((m) => m.PageRenderer),
  { loading: () => <div className="store-boot-placeholder" aria-hidden="true" /> }
);
const Listing = dynamic(
  () => import("./listing").then((m) => m.Listing),
  { loading: storeSkeletonFallback }
);
const ProductDetail = dynamic(
  () => import("./product-detail").then((m) => m.ProductDetail),
  { loading: storeSkeletonFallback }
);
const CartPage = dynamic(
  () => import("./cart-checkout").then((m) => m.CartPage),
  { loading: storeSkeletonFallback }
);
const CheckoutPage = dynamic(
  () => import("./cart-checkout").then((m) => m.CheckoutPage),
  { loading: storeSkeletonFallback }
);
const ConfirmationPage = dynamic(
  () => import("./cart-checkout").then((m) => m.ConfirmationPage),
  { loading: storeSkeletonFallback }
);
const StorefrontAiAssistant = dynamic(
  () => import("./StorefrontAiAssistant").then((m) => m.StorefrontAiAssistant),
  { ssr: false }
);

type StoredOrderSummary = {
  orderNumber: string;
  email: string;
  total: number;
  date: string;
};

const EMPTY_PROFILE: CustomerProfile = { name: "", email: "" };
const EMPTY_STRING_LIST: string[] = [];
const EMPTY_ORDER_HISTORY: StoredOrderSummary[] = [];

const CONTACT_TOPIC_ITEMS = [
  { value: "shipping", label: "Order & shipping" },
  { value: "specs", label: "Product specifications" },
  { value: "returns", label: "Returns & warranty" },
];

const BUILTIN_VIEWS = new Set([
  "",
  "shop",
  "search",
  "category",
  "product",
  "cart",
  "checkout",
  "confirmation",
  "categories",
  "collections",
  "collection",
  "wishlist",
  "account",
  "history",
  "about",
  "contact",
]);

// Isolated store toast pub/sub so toasts never re-render the entire Storefront tree.
let currentStoreToast = "";
let storeToastTimer: ReturnType<typeof setTimeout> | null = null;
const storeToastListeners = new Set<() => void>();

function emitStoreToast(next: string) {
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

function HomePageRenderer({
  nodes,
  typography,
  globalMotion,
  customPresets,
  catalog,
  categories,
  onAddToCart,
  onNotify,
}: {
  nodes: ElementNode[];
  typography?: GlobalTypographyTokens;
  globalMotion?: GlobalMotionSettings;
  customPresets?: AnimationPresetDefinition[];
  catalog: StoreProductItem[];
  categories: StoreCategoryItem[];
  onAddToCart: (item: StoreProductItem) => void;
  onNotify: (msg: string) => void;
}) {
  const isMobile = useMediaQuery("(max-width: 56.24em)");
  return (
    <PageRenderer
      mode="live"
      forceViewport={isMobile ? "mobile" : undefined}
      nodes={nodes}
      typography={typography}
      globalMotion={globalMotion}
      customPresets={customPresets}
      catalog={catalog}
      categories={categories}
      onAddToCart={onAddToCart}
      onNotify={onNotify}
    />
  );
}

function CheckoutView({
  cart,
  loading,
  notify,
}: {
  cart?: CartResponse;
  loading: boolean;
  notify: (msg: string) => void;
}) {
  const [profile] = useStored<CustomerProfile>("profile", EMPTY_PROFILE);

  const handleOrderPlaced = useCallback((order: OrderDto) => {
    const current = readStoredValue<StoredOrderSummary[]>(
      "store-order-history",
      EMPTY_ORDER_HISTORY
    );
    const next: StoredOrderSummary[] = [
      {
        orderNumber: order.orderNumber,
        email: order.customerEmail,
        total: Number(order.grandTotal),
        date: order.createdAt,
      },
      ...current.filter((x) => x.orderNumber !== order.orderNumber),
    ];
    writeStoredValue("store-order-history", next);
  }, []);

  return (
    <CheckoutPage
      cart={cart}
      loading={loading}
      defaultProfile={profile}
      notify={notify}
      onOrderPlaced={handleOrderPlaced}
    />
  );
}

function AccountView({
  wishlistCount,
  notify,
}: {
  wishlistCount: number;
  notify: (msg: string) => void;
}) {
  const [profile, setProfile] = useStored<CustomerProfile>("profile", EMPTY_PROFILE);
  const [orderHistory] = useStored<StoredOrderSummary[]>(
    "store-order-history",
    EMPTY_ORDER_HISTORY
  );

  return (
    <div className="store-container">
      <h1>Customer account</h1>
      <form
        className="panel form-stack account-form"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          setProfile({
            name: String(values.get("name")),
            email: String(values.get("email")),
            defaultAddress: String(values.get("address") || ""),
          });
          notify("Account details saved");
        }}
      >
        <label>
          Full name
          <input name="name" defaultValue={profile.name} required />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={profile.email} required />
        </label>
        <label>
          Default shipping address
          <input name="address" defaultValue={profile.defaultAddress || ""} />
        </label>
        <div>
          <Button variant="primary" type="submit">
            Save details
          </Button>
        </div>
      </form>
      <div className="button-row">
        <Link className="btn" href="/store/history">
          Order history ({orderHistory.length})
        </Link>
        <Link className="btn" href="/store/wishlist">
          Wishlist ({wishlistCount})
        </Link>
      </div>
    </div>
  );
}

function HistoryView() {
  const [orderHistory] = useStored<StoredOrderSummary[]>(
    "store-order-history",
    EMPTY_ORDER_HISTORY
  );

  return (
    <div className="store-container">
      <h1>Order history</h1>
      {orderHistory.length ? (
        <div className="receipt-list" style={{ marginTop: 18 }}>
          {orderHistory.map((order) => (
            <Link
              className="panel"
              href={`/store/confirmation/${encodeURIComponent(order.orderNumber)}`}
              key={order.orderNumber}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{order.orderNumber}</strong>
                <p className="muted" style={{ fontSize: 12 }}>
                  {formatDate(order.date)} · {order.email}
                </p>
              </div>
              <strong>{usdExact(order.total)}</strong>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="No orders yet"
          text="Orders you place during this session will appear here."
        />
      )}
    </div>
  );
}

export function Storefront({ route }: { route: string[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [wishlist, setWishlist] = useStored<string[]>("wishlist", EMPTY_STRING_LIST);
  const [view = "", id] = route;
  const cmsSlug = !view
    ? "home"
    : view === "about"
      ? "about"
      : view === "collections"
        ? "collections"
        : !BUILTIN_VIEWS.has(view)
          ? view
          : null;

  const needsCatalog =
    !view ||
    Boolean(cmsSlug) ||
    view === "product" ||
    view === "categories" ||
    view === "collections" ||
    view === "collection" ||
    view === "wishlist";
  const needsCategories =
    !view ||
    Boolean(cmsSlug) ||
    view === "categories" ||
    view === "collections";
  const needsPresets = !view || Boolean(cmsSlug);

  const [subViewReady, setSubViewReady] = useState(false);
  const handleSubViewReady = useCallback(() => {
    setSubViewReady(true);
  }, []);

  const themeQuery = useQuery({
    queryKey: ["store-theme"],
    queryFn: () => cmsStoreApi.getTheme(),
    staleTime: 60_000,
  });

  const presetsQuery = useQuery({
    queryKey: ["store-animation-presets"],
    queryFn: () => cmsStoreApi.listAnimationPresets(),
    enabled: needsPresets,
    staleTime: 60_000,
    retry: false,
  });

  const storeCustomPresets = useMemo(
    () => (presetsQuery.data || []).map(dtoToPresetDefinition),
    [presetsQuery.data]
  );

  const navQuery = useQuery({
    queryKey: ["store-nav", "main"],
    queryFn: () => cmsStoreApi.getNavigation("main"),
    staleTime: 60_000,
  });

  const cmsPageQuery = useQuery({
    queryKey: ["store-cms-page", cmsSlug],
    queryFn: () => cmsStoreApi.getPage(cmsSlug!),
    enabled: Boolean(cmsSlug),
    staleTime: 60_000,
    retry: false,
  });

  const cartQuery = useQuery({
    queryKey: ["store-cart"],
    queryFn: () => storeApi.getCart(),
  });

  const catalogQuery = useQuery({
    queryKey: ["store-home-catalog"],
    queryFn: () => storeApi.listProducts({ size: 24 }),
    enabled: needsCatalog,
    staleTime: 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => storeApi.listCategories(),
    enabled: needsCategories,
    staleTime: 60_000,
  });

  const collectionsQuery = useQuery({
    queryKey: ["store-collections"],
    queryFn: () => storeApi.listCollections(),
    enabled: view === "collections" || view === "collection",
    staleTime: 60_000,
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

  const wishlistSet = useMemo(() => new Set(wishlist), [wishlist]);

  const catalog = catalogQuery.data?.items || [];
  const handleQuickAddToCart = useCallback(
    (item: StoreProductItem) => {
      if ("variants" in item && Array.isArray(item.variants) && item.variants[0]?.id) {
        addToCartMutation.mutate({ variantId: item.variants[0].id, qty: 1 });
        return;
      }
      const slug = "slug" in item ? item.slug : item.id;
      router.push(`/store/product/${encodeURIComponent(slug)}`);
    },
    [addToCartMutation, router]
  );

  const categories = categoriesQuery.data || [];
  const collections = collectionsQuery.data || [];
  const cart = cartQuery.data;
  const cartCount =
    cart?.items.reduce((sum, line) => sum + line.quantity, 0) || 0;

  const coreReady =
    !themeQuery.isPending && !navQuery.isPending && !cartQuery.isPending;
  const routeReady = !view
    ? !cmsPageQuery.isPending &&
      !catalogQuery.isPending &&
      !categoriesQuery.isPending
    : cmsSlug
      ? !cmsPageQuery.isPending &&
        !catalogQuery.isPending &&
        !categoriesQuery.isPending
      : view === "shop" ||
          view === "search" ||
          view === "category" ||
          view === "product"
        ? subViewReady
        : view === "categories"
          ? !categoriesQuery.isPending
          : view === "collection"
            ? !collectionsQuery.isPending && !catalogQuery.isPending
            : true;
  const pageReady = coreReady && routeReady;

  const preloadImageUrls = useMemo(() => {
    if (cmsPageQuery.data && isV2Content(cmsPageQuery.data.content)) {
      return extractPreloadImageUrls(cmsPageQuery.data.content.nodes);
    }
    return [];
  }, [cmsPageQuery.data]);

  const themeCssVars = useMemo(
    () => themeTokensToCssVars(themeQuery.data?.tokens),
    [themeQuery.data?.tokens]
  );

  let content: React.ReactNode;
  if (!view) {
    if (cmsPageQuery.isPending) {
      content = <div className="store-boot-placeholder" aria-hidden="true" />;
    } else if (cmsPageQuery.data && isV2Content(cmsPageQuery.data.content)) {
      content = (
        <HomePageRenderer
          nodes={cmsPageQuery.data.content.nodes}
          typography={themeQuery.data?.tokens?.typography}
          globalMotion={themeQuery.data?.tokens?.motion}
          customPresets={storeCustomPresets}
          catalog={catalog}
          categories={categories}
          onAddToCart={handleQuickAddToCart}
          onNotify={emitStoreToast}
        />
      );
    } else {
      const homeBlocks = cmsPageQuery.data
        ? apiBlocksToEditorBlocks(cmsPageQuery.data.content)
        : initialBlocks;
      content = homeBlocks
        .filter((block) => block.visible)
        .map((block) => (
          <StoreBlock
            key={block.id}
            block={block}
            catalog={catalog}
            categories={categories}
          />
        ));
    }
  } else if (view === "shop" || view === "search" || view === "category") {
    content = (
      <Suspense fallback={storeSkeletonFallback()}>
        <Listing
          key={view + ":" + (id || "")}
          search={view === "search"}
          forcedCategory={view === "category" ? id : undefined}
          onReady={handleSubViewReady}
        />
      </Suspense>
    );
  } else if (view === "product" && id) {
    const related = catalog.filter((p) => p.id !== id && p.slug !== id).slice(0, 4);
    const matchedProduct = catalog.find((p) => p.id === id || p.slug === id);
    const isWished =
      wishlistSet.has(id) ||
      (matchedProduct ? wishlistSet.has(matchedProduct.id) : false);
    content = (
      <>
        <ProductDetail
          key={id}
          idOrSlug={id}
          onAddToCart={(variantId, qty, buyNow) =>
            addToCartMutation.mutate({ variantId, qty, buyNow })
          }
          adding={addToCartMutation.isPending}
          wished={isWished}
          toggleWishlist={toggleWishlist}
          onReady={handleSubViewReady}
        />
        {related.length ? (
          <div className="store-container" style={{ paddingTop: 0 }}>
            <h2>Related products</h2>
            <div className="store-products">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  } else if (view === "cart") {
    content = (
      <CartPage
        cart={cart}
        loading={cartQuery.isLoading}
        notify={emitStoreToast}
      />
    );
  } else if (view === "checkout") {
    content = (
      <CheckoutView
        cart={cart}
        loading={cartQuery.isLoading}
        notify={emitStoreToast}
      />
    );
  } else if (view === "confirmation") {
    content = id ? (
      <ConfirmationPage orderNumber={id} />
    ) : (
      <div className="store-container">
        <h1>Order not found</h1>
        <Link className="btn primary" href="/store/history">
          View order history
        </Link>
      </div>
    );
  } else if (view === "categories") {
    content = (
      <div className="store-container">
        <h1>Shop by category</h1>
        <p className="muted">
          Browse every product line with dynamic specification filters.
        </p>
        <StoreBlock
          block={{ ...initialBlocks[1], columns: 4 }}
          catalog={catalog}
          categories={categories}
        />
      </div>
    );
  } else if (view === "collections" || (view === "collection" && id)) {
    const filteredCollections =
      view === "collection" && id
        ? collections.filter((c) => c.slug === id || c.id === id)
        : collections;
    const colHeaderBlocks =
      view === "collections" && cmsPageQuery.data
        ? apiBlocksToEditorBlocks(cmsPageQuery.data.content)
        : pageTemplates["Collections page"] || [];
    content = (
      <>
        {view === "collections"
          ? colHeaderBlocks
              .filter((block) => block.visible)
              .map((block) => (
                <StoreBlock
                  key={block.id}
                  block={block}
                  catalog={catalog}
                  categories={categories}
                />
              ))
          : null}
        {collectionsQuery.isLoading ? (
          <div className="store-container">
            <Skeleton rows={4} />
          </div>
        ) : filteredCollections.length ? (
          filteredCollections.map((collection) => {
            const productIdSet = new Set(collection.productIds);
            return (
              <div className="store-container" key={collection.id}>
                <div className="store-section-head">
                  <div>
                    <h2>{collection.name}</h2>
                    {collection.description ? (
                      <p className="muted">{collection.description}</p>
                    ) : null}
                  </div>
                  <Link href="/store/shop">
                    Shop all <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="store-products">
                  {catalog.flatMap((product) =>
                    productIdSet.has(product.id)
                      ? [<ProductCard key={product.id} product={product} />]
                      : []
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="store-container">
            <Empty
              title="No collections found"
              text="Check back soon for new curated seasonal collections."
            />
          </div>
        )}
      </>
    );
  } else if (view === "wishlist") {
    const wishedProducts = catalog.filter((product) =>
      wishlistSet.has(product.id)
    );
    content = (
      <div className="store-container">
        <h1>Wishlist</h1>
        {wishedProducts.length ? (
          <div className="store-products" style={{ marginTop: 18 }}>
            {wishedProducts.map((product) => (
              <div key={product.id} className="form-stack">
                <ProductCard product={product} />
                <Button size="sm" onClick={() => toggleWishlist(product.id)}>
                  Remove from wishlist
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Save products you love"
            text="Use the heart icon on any product page to build your wishlist."
            action={
              <Link className="btn primary" href="/store/shop">
                Explore catalog
              </Link>
            }
          />
        )}
      </div>
    );
  } else if (view === "account") {
    content = <AccountView wishlistCount={wishlist.length} notify={emitStoreToast} />;
  } else if (view === "history") {
    content = <HistoryView />;
  } else if (view === "about") {
    if (cmsPageQuery.isPending) {
      content = <div className="store-boot-placeholder" aria-hidden="true" />;
    } else if (cmsPageQuery.data && isV2Content(cmsPageQuery.data.content)) {
      content = (
        <PageRenderer
          mode="live"
          nodes={cmsPageQuery.data.content.nodes}
          typography={themeQuery.data?.tokens?.typography}
          globalMotion={themeQuery.data?.tokens?.motion}
          customPresets={storeCustomPresets}
          catalog={catalog}
          categories={categories}
          onAddToCart={handleQuickAddToCart}
          onNotify={emitStoreToast}
        />
      );
    } else {
      const aboutBlocks = cmsPageQuery.data
        ? apiBlocksToEditorBlocks(cmsPageQuery.data.content)
        : pageTemplates["About page"] || [];
      content = aboutBlocks
        .filter((block) => block.visible)
        .map((block) => (
          <StoreBlock
            key={block.id}
            block={block}
            catalog={catalog}
            categories={categories}
          />
        ));
    }
  } else if (view === "contact") {
    content = (
      <div className="store-container">
        <h1>Contact support</h1>
        <p className="muted">
          Questions about sizing, hardware specs, or an existing order?
        </p>
        <form
          className="panel form-stack account-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.currentTarget.reset();
            emitStoreToast("Message sent to Dat Commerce support");
          }}
        >
          <label>
            Email
            <input type="email" required />
          </label>
          <label>
            Topic
            <Select
              items={CONTACT_TOPIC_ITEMS}
              defaultValue={CONTACT_TOPIC_ITEMS[0].value}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TOPIC_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Message
            <textarea required rows={4} />
          </label>
          <div>
            <Button variant="primary" type="submit">
              Submit message
            </Button>
          </div>
        </form>
      </div>
    );
  } else if (cmsPageQuery.isLoading) {
    content = (
      <div className="store-container">
        <Skeleton rows={4} />
      </div>
    );
  } else if (cmsPageQuery.data) {
    if (isV2Content(cmsPageQuery.data.content)) {
      content = (
        <PageRenderer
          mode="live"
          nodes={cmsPageQuery.data.content.nodes}
          typography={themeQuery.data?.tokens?.typography}
          globalMotion={themeQuery.data?.tokens?.motion}
          customPresets={storeCustomPresets}
          catalog={catalog}
          categories={categories}
          onAddToCart={handleQuickAddToCart}
          onNotify={emitStoreToast}
        />
      );
    } else {
      content = apiBlocksToEditorBlocks(cmsPageQuery.data.content)
        .filter((block) => block.visible)
        .map((block) => (
          <StoreBlock
            key={block.id}
            block={block}
            catalog={catalog}
            categories={categories}
          />
        ));
    }
  } else {
    content = (
      <div className="store-container">
        <h1>Page not found</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          The page you requested does not exist or has moved.
        </p>
        <Link className="btn primary" href="/store">
          Return home
        </Link>
      </div>
    );
  }

  return (
    <div className="store public-store" style={themeCssVars}>
      <GlobalTypographyStyleTag
        typography={themeQuery.data?.tokens?.typography}
        scopeId="storefront"
        scopeSelector=".store.public-store"
      />
      <StorePageReveal ready={pageReady} preloadImageUrls={preloadImageUrls}>
        <StoreHeader
          cart={cartCount}
          wishlistCount={wishlist.length}
          currentPath={view ? `/store/${view}` : "/"}
          freeShippingThresholdOverride={cart?.freeShippingThreshold}
        />
        <main>{content}</main>
        <StoreFooter />
        <StoreToastHost />
      </StorePageReveal>
      <StorefrontAiAssistant
        currentPath={
          view
            ? `/store/${view}${id ? `/${encodeURIComponent(id)}` : ""}`
            : "/"
        }
        productSlug={view === "product" ? id : undefined}
        onNotify={emitStoreToast}
      />
    </div>
  );
}
