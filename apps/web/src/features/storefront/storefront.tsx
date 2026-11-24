"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
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
import { ApiError } from "@/lib/api-client";
import { cmsStoreApi } from "@/lib/cms-ai-api";
import { apiBlocksToEditorBlocks, themeTokensToCssVars } from "@/lib/cms-schema";
import { storeApi } from "@/lib/commerce-api";
import { formatDate, usdExact } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { initialBlocks, pageTemplates } from "@/mocks/pages";
import type { OrderDto } from "@/types/api-commerce";
import type { CustomerProfile } from "@/types/commerce";
import { isV2Content } from "@/features/builder/migration";
import { PageRenderer } from "@/features/builder/renderer/PageRenderer";
import { ProductCard, StoreBlock, type StoreProductItem } from "./blocks";
import { CartPage, CheckoutPage, ConfirmationPage } from "./cart-checkout";
import { StoreFooter, StoreHeader } from "./header-footer";
import { Listing } from "./listing";
import { ProductDetail } from "./product-detail";

type StoredOrderSummary = {
  orderNumber: string;
  email: string;
  total: number;
  date: string;
};

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

export function Storefront({ route }: { route: string[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [wishlist, setWishlist] = useStored<string[]>("wishlist", []);
  const [orderHistory, setOrderHistory] = useStored<StoredOrderSummary[]>(
    "store-order-history",
    []
  );
  const [profile, setProfile] = useStored<CustomerProfile>("profile", {
    name: "",
    email: "",
  });
  const [toast, setToast] = useState("");

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

  const themeQuery = useQuery({
    queryKey: ["store-theme"],
    queryFn: () => cmsStoreApi.getTheme(),
  });

  const cmsPageQuery = useQuery({
    queryKey: ["store-cms-page", cmsSlug],
    queryFn: () => cmsStoreApi.getPage(cmsSlug!),
    enabled: Boolean(cmsSlug),
    retry: false,
  });

  const cartQuery = useQuery({
    queryKey: ["store-cart"],
    queryFn: () => storeApi.getCart(),
  });

  const catalogQuery = useQuery({
    queryKey: ["store-home-catalog"],
    queryFn: () => storeApi.listProducts({ size: 24 }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => storeApi.listCategories(),
  });

  const collectionsQuery = useQuery({
    queryKey: ["store-collections"],
    queryFn: () => storeApi.listCollections(),
    enabled: view === "collections" || view === "collection",
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
        setToast("Added item to cart");
      }
    },
    onError: (err) =>
      setToast(err instanceof ApiError ? err.message : "Could not add item to cart"),
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleWishlist = (productId: string) => {
    const exists = wishlist.includes(productId);
    setWishlist((current) =>
      exists
        ? current.filter((value) => value !== productId)
        : [...current, productId]
    );
    setToast(exists ? "Removed from wishlist" : "Saved to wishlist");
  };

  const catalog = catalogQuery.data?.items || [];
  const handleQuickAddToCart = (item: StoreProductItem) => {
    if ("variants" in item && Array.isArray(item.variants) && item.variants[0]?.id) {
      addToCartMutation.mutate({ variantId: item.variants[0].id, qty: 1 });
      return;
    }
    const slug = "slug" in item ? item.slug : item.id;
    router.push(`/store/product/${encodeURIComponent(slug)}`);
  };
  const categories = categoriesQuery.data || [];
  const collections = collectionsQuery.data || [];
  const cart = cartQuery.data;
  const cartCount =
    cart?.items.reduce((sum, line) => sum + line.quantity, 0) || 0;

  const homeBlocks = cmsPageQuery.data
    ? apiBlocksToEditorBlocks(cmsPageQuery.data.content)
    : initialBlocks;

  let content: React.ReactNode;
  if (!view) {
    if (cmsPageQuery.data && isV2Content(cmsPageQuery.data.content)) {
      content = (
        <PageRenderer
          mode="live"
          nodes={cmsPageQuery.data.content.nodes}
          catalog={catalog}
          categories={categories}
          onAddToCart={handleQuickAddToCart}
          onNotify={setToast}
        />
      );
    } else {
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
      <Suspense
        fallback={
          <div className="store-container">
            <Skeleton rows={4} />
          </div>
        }
      >
        <Listing
          key={view + ":" + (id || "")}
          search={view === "search"}
          forcedCategory={view === "category" ? id : undefined}
        />
      </Suspense>
    );
  } else if (view === "product" && id) {
    const related = catalog.filter((p) => p.id !== id && p.slug !== id).slice(0, 4);
    content = (
      <>
        <ProductDetail
          key={id}
          idOrSlug={id}
          onAddToCart={(variantId, qty, buyNow) =>
            addToCartMutation.mutate({ variantId, qty, buyNow })
          }
          adding={addToCartMutation.isPending}
          wished={wishlist.some(
            (w) => w === id || catalog.find((p) => p.id === w)?.slug === id
          )}
          toggleWishlist={toggleWishlist}
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
        notify={setToast}
      />
    );
  } else if (view === "checkout") {
    content = (
      <CheckoutPage
        cart={cart}
        loading={cartQuery.isLoading}
        defaultProfile={profile}
        notify={setToast}
        onOrderPlaced={(order: OrderDto) => {
          setOrderHistory((curr) => [
            {
              orderNumber: order.orderNumber,
              email: order.customerEmail,
              total: Number(order.grandTotal),
              date: order.createdAt,
            },
            ...curr.filter((x) => x.orderNumber !== order.orderNumber),
          ]);
        }}
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
          filteredCollections.map((collection) => (
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
                {catalog
                  .filter((product) => collection.productIds.includes(product.id))
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
              </div>
            </div>
          ))
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
      wishlist.includes(product.id)
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
    content = (
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
            setToast("Account details saved");
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
            Wishlist ({wishlist.length})
          </Link>
        </div>
      </div>
    );
  } else if (view === "history") {
    content = (
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
  } else if (view === "about") {
    if (cmsPageQuery.data && isV2Content(cmsPageQuery.data.content)) {
      content = (
        <PageRenderer
          mode="live"
          nodes={cmsPageQuery.data.content.nodes}
          catalog={catalog}
          categories={categories}
          onAddToCart={handleQuickAddToCart}
          onNotify={setToast}
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
            setToast("Message sent to Dat Commerce support");
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
          catalog={catalog}
          categories={categories}
          onAddToCart={handleQuickAddToCart}
          onNotify={setToast}
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
    <div
      className="store public-store"
      style={themeTokensToCssVars(themeQuery.data?.tokens)}
    >
      <StoreHeader
        cart={cartCount}
        wishlistCount={wishlist.length}
        currentPath={view ? `/store/${view}` : "/store"}
        freeShippingThresholdOverride={cart?.freeShippingThreshold}
      />
      <main>{content}</main>
      <StoreFooter />
      <Toast message={toast} />
    </div>
  );
}
