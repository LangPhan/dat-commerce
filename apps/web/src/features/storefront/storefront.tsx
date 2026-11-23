"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import { Toast } from "@/components/ui/toast";
import { formatDate, usdExact } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { initialCollections, initialProducts } from "@/mocks/catalog";
import { initialDiscounts, initialOrders } from "@/mocks/operations";
import { initialBlocks, pageTemplates } from "@/mocks/pages";
import type {
  CartItem,
  Collection,
  CustomerProfile,
  Discount,
  Order,
  OrderReceipt,
  Product,
} from "@/types/commerce";
import type { Block } from "@/types/editor";
import { ProductCard, StoreBlock } from "./blocks";
import { CartPage, CheckoutPage, ConfirmationPage } from "./cart-checkout";
import { StoreFooter, StoreHeader } from "./header-footer";
import { Listing } from "./listing";
import { ProductDetail } from "./product-detail";

export function Storefront({ route }: { route: string[] }) {
  const router = useRouter();
  const [blocks] = useStored<Block[]>("published", initialBlocks);
  const [catalog] = useStored<Product[]>("catalog", initialProducts);
  const [publishedPages] = useStored<Record<string, Block[]>>(
    "published-pages",
    pageTemplates
  );
  const [collections] = useStored<Collection[]>("collections", initialCollections);
  const [offers] = useStored<Discount[]>("discounts", initialDiscounts);
  const [, setMerchantOrders] = useStored<Order[]>("orders", initialOrders);
  const [shippingSettings] = useStored<Record<string, string>>(
    "preferences:shipping",
    {}
  );
  const [cart, setCart] = useStored<CartItem[]>("cart", []);
  const [wishlist, setWishlist] = useStored<string[]>("wishlist", []);
  const [orders, setOrders] = useStored<OrderReceipt[]>("receipts", []);
  const [profile, setProfile] = useStored<CustomerProfile>("profile", {
    name: "",
    email: "",
  });
  const [toast, setToast] = useState("");

  const [view, id] = route;
  const selected = catalog.find((product) => product.id === id);

  const items = useMemo(
    () =>
      cart.flatMap((item) => {
        const product = catalog.find((entry) => entry.id === item.id);
        return product ? [{ ...item, product }] : [];
      }),
    [cart, catalog]
  );

  const total = items.reduce((sum, row) => sum + row.qty * row.product.price, 0);
  const threshold = Number(shippingSettings["Free shipping threshold"] || 100);
  const baseShippingFee = Number(shippingSettings["Standard shipping fee"] || 12);
  const shipping = total >= threshold || total === 0 ? 0 : baseShippingFee;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleWishlist = (productId: string) => {
    setWishlist((current) =>
      current.includes(productId)
        ? current.filter((value) => value !== productId)
        : [...current, productId]
    );
    setToast(
      wishlist.includes(productId) ? "Removed from wishlist" : "Saved to wishlist"
    );
  };

  function add(product: Product, qty: number, variant: string, buyNow = false) {
    setCart((current) => {
      const line = current.find(
        (item) => item.id === product.id && item.variant === variant
      );
      return line
        ? current.map((item) =>
            item === line
              ? { ...item, qty: Math.min(product.stock, item.qty + qty) }
              : item
          )
        : [...current, { id: product.id, qty, variant }];
    });
    if (buyNow) router.push("/store/checkout");
    else setToast(`Added ${product.name} to cart`);
  }

  let content: React.ReactNode;
  if (!view) {
    content = blocks
      .filter((block) => block.visible)
      .map((block) => (
        <StoreBlock key={block.id} block={block} catalog={catalog} />
      ));
  } else if (view === "shop" || view === "search") {
    content = <Listing key={view} catalog={catalog} search={view === "search"} />;
  } else if (view === "product" && selected) {
    content = (
      <>
        <ProductDetail
          key={selected.id}
          product={selected}
          add={(qty, variant, buyNow) => add(selected, qty, variant, buyNow)}
          wished={wishlist.includes(selected.id)}
          toggleWishlist={() => toggleWishlist(selected.id)}
        />
        <div className="store-container" style={{ paddingTop: 0 }}>
          <h2>Related products</h2>
          <div className="store-products">
            {catalog
              .filter((item) => item.id !== id)
              .sort(
                (a, b) =>
                  Number(b.category === selected.category) -
                  Number(a.category === selected.category)
              )
              .slice(0, 4)
              .map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
          </div>
        </div>
      </>
    );
  } else if (view === "cart") {
    content = (
      <CartPage
        items={items}
        total={total}
        shippingThreshold={threshold}
        shippingCost={shipping}
        updateQty={(itemId, variant, qty) =>
          setCart((curr) =>
            curr.map((line) =>
              line.id === itemId && line.variant === variant
                ? { ...line, qty }
                : line
            )
          )
        }
        removeLine={(itemId, variant) =>
          setCart((curr) =>
            curr.filter(
              (line) => line.id !== itemId || line.variant !== variant
            )
          )
        }
      />
    );
  } else if (view === "checkout") {
    content = (
      <CheckoutPage
        items={items}
        total={total}
        baseShipping={shipping}
        offers={offers}
        profile={profile}
        notify={setToast}
        onComplete={(receipt, merchantOrder) => {
          setOrders((prev) => [receipt, ...prev]);
          setMerchantOrders((prev) => [merchantOrder, ...prev]);
          setCart([]);
          router.push("/store/confirmation/" + receipt.id);
        }}
      />
    );
  } else if (view === "confirmation") {
    const receipt = orders.find((o) => o.id === id);
    content = receipt ? (
      <ConfirmationPage receipt={receipt} />
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
        <p className="muted">Browse every product line with dynamic specification filters.</p>
        <StoreBlock block={{ ...initialBlocks[1], columns: 4 }} catalog={catalog} />
      </div>
    );
  } else if (view === "collections") {
    content = (
      <>
        {(publishedPages["Collections page"] || [])
          .filter((block) => block.visible)
          .map((block) => (
            <StoreBlock key={block.id} block={block} catalog={catalog} />
          ))}
        {collections.map((collection) => (
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
                .filter((product) => collection.products.includes(product.id))
                .map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
            </div>
          </div>
        ))}
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
            Order history ({orders.length})
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
        {orders.length ? (
          <div className="receipt-list" style={{ marginTop: 18 }}>
            {orders.map((order) => (
              <Link
                className="panel"
                href={`/store/confirmation/${order.id}`}
                key={order.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <strong>{order.id}</strong>
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
    content = (publishedPages["About page"] || [])
      .filter((block) => block.visible)
      .map((block) => (
        <StoreBlock key={block.id} block={block} catalog={catalog} />
      ));
  } else if (view === "contact") {
    content = (
      <div className="store-container">
        <h1>Contact support</h1>
        <p className="muted">Questions about sizing, hardware specs, or an existing order?</p>
        <form
          className="panel form-stack account-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.currentTarget.reset();
            setToast("Message sent to Terrain & Forma support");
          }}
        >
          <label>
            Email
            <input type="email" required />
          </label>
          <label>
            Topic
            <select>
              <option>Order & shipping</option>
              <option>Product specifications</option>
              <option>Returns & warranty</option>
            </select>
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
    <div className="store public-store">
      <StoreHeader
        cart={cart.reduce((sum, item) => sum + item.qty, 0)}
        wishlistCount={wishlist.length}
        currentPath={view ? `/store/${view}` : "/store"}
      />
      <main>{content}</main>
      <StoreFooter />
      <Toast message={toast} />
    </div>
  );
}
