"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import { formatDate, newId, usd, usdExact } from "@/lib/format";
import type {
  CartItem,
  CustomerProfile,
  Discount,
  Order,
  OrderReceipt,
  Product,
} from "@/types/commerce";

export function CartPage({
  items,
  total,
  shippingThreshold,
  shippingCost,
  updateQty,
  removeLine,
}: {
  items: (CartItem & { product: Product })[];
  total: number;
  shippingThreshold: number;
  shippingCost: number;
  updateQty: (id: string, variant: string, qty: number) => void;
  removeLine: (id: string, variant: string) => void;
}) {
  const remaining = Math.max(0, shippingThreshold - total);
  const progress = Math.min(100, Math.round((total / Math.max(1, shippingThreshold)) * 100));

  return (
    <div className="store-container">
      <h1>Shopping cart</h1>
      {items.length ? (
        <div className="cart-layout" style={{ marginTop: 20 }}>
          <div>
            <div className="shipping-progress">
              {remaining === 0 ? (
                <strong className="success">
                  You unlocked complimentary carbon-neutral shipping.
                </strong>
              ) : (
                <span>
                  Add <strong>{usd(remaining)}</strong> more for free shipping.
                </span>
              )}
              <progress value={progress} max={100} aria-label="Free shipping progress" />
            </div>

            {items.map((item) => (
              <div className="cart-line" key={item.id + item.variant}>
                <img src={item.product.image} alt={item.product.name} />
                <div>
                  <Link href={`/store/product/${item.id}`}>
                    <strong>{item.product.name}</strong>
                  </Link>
                  <p className="muted" style={{ fontSize: 12 }}>
                    {item.variant}
                  </p>
                </div>
                <div className="qty-stepper">
                  <button
                    type="button"
                    aria-label={`Decrease ${item.product.name} quantity`}
                    onClick={() =>
                      updateQty(item.id, item.variant, Math.max(1, item.qty - 1))
                    }
                  >
                    <Minus size={13} />
                  </button>
                  <span>{item.qty}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${item.product.name} quantity`}
                    onClick={() =>
                      updateQty(
                        item.id,
                        item.variant,
                        Math.min(item.product.stock, item.qty + 1)
                      )
                    }
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <strong>{usdExact(item.product.price * item.qty)}</strong>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${item.product.name}`}
                  onClick={() => removeLine(item.id, item.variant)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          <aside className="panel form-stack">
            <h2>Order summary</h2>
            <div className="checkout-summary-row">
              <span className="muted">Subtotal</span>
              <strong>{usdExact(total)}</strong>
            </div>
            <div className="checkout-summary-row">
              <span className="muted">Estimated shipping</span>
              <strong>{shippingCost === 0 ? "Free" : usdExact(shippingCost)}</strong>
            </div>
            <div
              className="checkout-summary-row"
              style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}
            >
              <strong>Estimated total</strong>
              <strong style={{ fontSize: 17 }}>{usdExact(total + shippingCost)}</strong>
            </div>
            <Link className="btn primary btn-lg" href="/store/checkout">
              Proceed to checkout <ArrowRight size={15} />
            </Link>
            <Link className="btn" href="/store/shop">
              Continue shopping
            </Link>
          </aside>
        </div>
      ) : (
        <Empty
          title="Your cart is empty"
          text="Explore footwear, laptops, phones, and outdoor apparel to get started."
          action={
            <Link className="btn primary" href="/store/shop">
              Shop all products
            </Link>
          }
        />
      )}
    </div>
  );
}

export function CheckoutPage({
  items,
  total,
  baseShipping,
  offers,
  profile,
  onComplete,
  notify,
}: {
  items: (CartItem & { product: Product })[];
  total: number;
  baseShipping: number;
  offers: Discount[];
  profile: CustomerProfile;
  onComplete: (receipt: OrderReceipt, merchantOrder: Order) => void;
  notify: (msg: string) => void;
}) {
  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [codeError, setCodeError] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express">("standard");

  const today = new Date().toISOString().slice(0, 10);
  const shipping = deliveryMethod === "express" ? 24 : baseShipping;
  const offer = offers.find(
    (o) =>
      o.code === coupon &&
      o.status === "Active" &&
      o.start <= today &&
      o.end >= today
  );
  const eligibleTotal = offer
    ? items
        .filter(
          (i) =>
            offer.eligible === "All products" ||
            [i.product.name, i.product.category].includes(offer.eligible)
        )
        .reduce((sum, i) => sum + i.qty * i.product.price, 0)
    : 0;
  const discount =
    offer && eligibleTotal
      ? Math.min(
          eligibleTotal,
          offer.type === "Percentage"
            ? (eligibleTotal * offer.value) / 100
            : offer.value
        )
      : 0;

  if (!items.length) {
    return (
      <div className="store-container">
        <h1>Checkout</h1>
        <Empty
          title="Your cart is empty"
          text="Add items to your cart before checking out."
          action={
            <Link className="btn primary" href="/store/shop">
              Browse products
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="store-container">
      <h1>Checkout</h1>
      <div className="checkout-grid">
        <form
          className="form-stack panel"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const id = "TR-" + newId().slice(0, 6).toUpperCase();
            const customer = String(fd.get("name"));
            const email = String(fd.get("email"));
            const address = `${fd.get("address")}, ${fd.get("city")} ${fd.get("postal")}`;
            const finalTotal = Math.max(0, total + shipping - discount);

            const receipt: OrderReceipt = {
              id,
              email,
              total: finalTotal,
              discount,
              shipping,
              date: new Date().toISOString(),
              items: items.map((i) => ({
                name: i.product.name,
                variant: i.variant,
                qty: i.qty,
                price: i.product.price,
              })),
            };

            const merchantOrder: Order = {
              id,
              customer,
              email,
              date: today,
              subtotal: total,
              shippingCost: shipping,
              discountAmount: discount,
              total: finalTotal,
              payment: "Paid",
              fulfillment: "Unfulfilled",
              tracking: "",
              shippingAddress: address,
              items: items.map((i) => ({
                name: `${i.product.name} · ${i.variant}`,
                qty: i.qty,
                price: i.product.price,
              })),
              timeline: [
                {
                  label: "Order placed",
                  detail: coupon ? `Promo code ${coupon} applied` : "Storefront checkout",
                  timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
                  kind: "placed",
                },
                {
                  label: "Payment captured",
                  detail: `${usdExact(finalTotal)} settled`,
                  timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
                  kind: "payment",
                },
              ],
            };
            onComplete(receipt, merchantOrder);
          }}
        >
          <h2>Contact & delivery</h2>
          <div className="form-pair">
            <label>
              Full name
              <input name="name" autoComplete="name" defaultValue={profile.name} required />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={profile.email} required />
            </label>
          </div>
          <label>
            Street address
            <input name="address" autoComplete="street-address" required />
          </label>
          <div className="form-pair">
            <label>
              City
              <input name="city" autoComplete="address-level2" required />
            </label>
            <label>
              Postal code
              <input name="postal" autoComplete="postal-code" required />
            </label>
          </div>

          <h2>Shipping method</h2>
          <div className="form-pair">
            <button
              type="button"
              className={"variant-pill " + (deliveryMethod === "standard" ? "active" : "")}
              onClick={() => setDeliveryMethod("standard")}
            >
              Standard ({baseShipping === 0 ? "Free" : usdExact(baseShipping)})
            </button>
            <button
              type="button"
              className={"variant-pill " + (deliveryMethod === "express" ? "active" : "")}
              onClick={() => setDeliveryMethod("express")}
            >
              Express 2-Day ({usdExact(24)})
            </button>
          </div>

          <h2>Payment</h2>
          <label>
            Method
            <select>
              <option>Demo card · •••• 4242</option>
              <option>Apple Pay (Demo)</option>
            </select>
          </label>

          <Button variant="primary" size="lg" type="submit">
            Place order · {usdExact(Math.max(0, total + shipping - discount))}
          </Button>
        </form>

        <aside className="panel form-stack">
          <h2>Order summary</h2>
          {items.map((item) => (
            <div key={item.id + item.variant} className="checkout-summary-row">
              <span>
                {item.product.name} × {item.qty}
                <small className="muted" style={{ display: "block", fontSize: 11 }}>
                  {item.variant}
                </small>
              </span>
              <strong>{usdExact(item.product.price * item.qty)}</strong>
            </div>
          ))}

          <form
            className="button-row"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              const candidate = offers.find(
                (o) =>
                  o.code === codeInput.toUpperCase().trim() &&
                  o.status === "Active" &&
                  o.start <= today &&
                  o.end >= today
              );
              if (
                !candidate ||
                !items.some(
                  (i) =>
                    candidate.eligible === "All products" ||
                    [i.product.name, i.product.category].includes(candidate.eligible)
                )
              ) {
                setCodeError("Code invalid, expired, or ineligible for cart items.");
                setCoupon("");
                return;
              }
              setCoupon(candidate.code);
              setCodeError("");
              notify(`Promo ${candidate.code} applied`);
            }}
          >
            <input
              aria-label="Discount code"
              placeholder="Discount code (try TRAIL10)"
              style={{ flex: 1 }}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
            />
            <Button type="submit">Apply</Button>
          </form>
          {codeError ? (
            <p className="danger" role="alert" style={{ fontSize: 12 }}>
              {codeError}
            </p>
          ) : null}

          <div className="checkout-summary-row">
            <span className="muted">Subtotal</span>
            <span>{usdExact(total)}</span>
          </div>
          <div className="checkout-summary-row">
            <span className="muted">Shipping</span>
            <span>{shipping === 0 ? "Free" : usdExact(shipping)}</span>
          </div>
          {discount > 0 ? (
            <div className="checkout-summary-row success">
              <span>Discount ({coupon})</span>
              <span>−{usdExact(discount)}</span>
            </div>
          ) : null}
          <div
            className="checkout-summary-row"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}
          >
            <strong>Total</strong>
            <strong style={{ fontSize: 18 }}>
              {usdExact(Math.max(0, total + shipping - discount))}
            </strong>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ConfirmationPage({ receipt }: { receipt: OrderReceipt }) {
  return (
    <div className="store-container" style={{ maxWidth: 720 }}>
      <div className="panel form-stack">
        <div className="button-row">
          <CheckCircle2 size={28} className="success" />
          <div>
            <span className="muted" style={{ fontSize: 12 }}>
              Order confirmation
            </span>
            <h1 style={{ fontSize: 28, margin: 0 }}>Thank you for your order</h1>
          </div>
        </div>
        <p className="muted">
          Order <strong>{receipt.id}</strong> placed on {formatDate(receipt.date)}. A
          confirmation has been recorded for <strong>{receipt.email}</strong>.
        </p>

        {receipt.items?.length ? (
          <div>
            <h3>Items ordered</h3>
            {receipt.items.map((item, idx) => (
              <div key={idx} className="line-item">
                <span>
                  {item.name} ({item.variant}) × {item.qty}
                </span>
                <strong>{usdExact(item.price * item.qty)}</strong>
              </div>
            ))}
          </div>
        ) : null}

        <div className="line-item">
          <strong>Total paid</strong>
          <strong>{usdExact(receipt.total)}</strong>
        </div>

        <div className="button-row">
          <Link className="btn primary" href="/store/history">
            View order history
          </Link>
          <Link className="btn" href="/store/shop">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
