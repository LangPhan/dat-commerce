"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storeApi } from "@/lib/commerce-api";
import { formatDate, usdExact } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { readStoredValue, writeStoredValue } from "@/lib/theme";
import type { OrderDto } from "@/types/api-commerce";
import type { CustomerProfile } from "@/types/commerce";
import { ProductCard } from "../blocks";
import { CartPage, CheckoutPage, ConfirmationPage } from "../cart-checkout";
import { useStorefront } from "../storefront-context";

type StoredOrderSummary = {
  orderNumber: string;
  email: string;
  total: number;
  date: string;
};

const EMPTY_PROFILE: CustomerProfile = { name: "", email: "" };
const EMPTY_ORDER_HISTORY: StoredOrderSummary[] = [];

const CONTACT_TOPIC_ITEMS = [
  { value: "shipping", label: "Order & shipping" },
  { value: "specs", label: "Product specifications" },
  { value: "returns", label: "Returns & warranty" },
];

export function CartView() {
  const { cart, cartLoading, notify } = useStorefront();
  return <CartPage cart={cart} loading={cartLoading} notify={notify} />;
}

export function CheckoutView() {
  const { cart, cartLoading, notify } = useStorefront();
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
      loading={cartLoading}
      defaultProfile={profile}
      notify={notify}
      onOrderPlaced={handleOrderPlaced}
    />
  );
}

export function ConfirmationView({ orderNumber }: { orderNumber?: string }) {
  if (!orderNumber) {
    return (
      <div className="store-container">
        <h1>Order not found</h1>
        <Link className="btn primary" href="/store/history">
          View order history
        </Link>
      </div>
    );
  }
  return <ConfirmationPage orderNumber={orderNumber} />;
}

export function WishlistView() {
  const { wishlistSet } = useStorefront();
  const catalogQuery = useQuery({
    queryKey: ["store-home-catalog"],
    queryFn: () => storeApi.listProducts({ size: 24 }),
    staleTime: 60_000,
  });

  const savedProducts = (catalogQuery.data?.items || []).filter((p) =>
    wishlistSet.has(p.id)
  );

  return (
    <div className="store-container">
      <h1>Wishlist</h1>
      {savedProducts.length ? (
        <div className="store-products" style={{ marginTop: 18 }}>
          {savedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <Empty
          title="No saved items yet"
          text="Tap the heart icon on any product to bookmark it here."
          action={
            <Link className="btn primary" href="/store/shop">
              Browse products
            </Link>
          }
        />
      )}
    </div>
  );
}

export function AccountView() {
  const { wishlist, notify } = useStorefront();
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
          Wishlist ({wishlist.length})
        </Link>
      </div>
    </div>
  );
}

export function HistoryView() {
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

export function ContactView() {
  const { notify } = useStorefront();
  return (
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
          notify("Message sent to Dat Commerce support");
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
}
