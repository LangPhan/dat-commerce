"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Minus, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOptionalAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type { CheckoutPrefillDto } from "@/types/api-cms-ai";
import { useCheckoutPrefillStore } from "./checkout-prefill-store";
import { storeApi } from "@/lib/commerce-api";
import { formatDateTime, newId, usd, usdExact } from "@/lib/format";
import type { CartResponse, OrderDto } from "@/types/api-commerce";

const PAYMENT_METHOD_ITEMS = [
  {
    value: "sandbox-card",
    label: "Sandbox Payment Gateway · Authorized card •••• 4242",
  },
];

export function CartPage({
  cart,
  loading,
  notify,
}: {
  cart?: CartResponse;
  loading: boolean;
  notify: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [promoInput, setPromoInput] = useState(cart?.promotionCode || "");
  const [promoError, setPromoError] = useState("");

  const updateMutation = useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) =>
      storeApi.updateCartItem(variantId, qty),
    onSuccess: (next) => {
      queryClient.setQueryData(["store-cart"], next);
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Could not update quantity"),
  });

  const removeMutation = useMutation({
    mutationFn: (variantId: string) => storeApi.removeCartItem(variantId),
    onSuccess: (next) => {
      queryClient.setQueryData(["store-cart"], next);
      notify("Item removed from cart");
    },
  });

  const promoMutation = useMutation({
    mutationFn: (code: string) => storeApi.applyPromotion(code),
    onSuccess: (next) => {
      queryClient.setQueryData(["store-cart"], next);
      setPromoError("");
      notify(next.promotionCode ? `Applied code ${next.promotionCode}` : "Removed promo code");
    },
    onError: (err) =>
      setPromoError(err instanceof ApiError ? err.message : "Invalid promotion code"),
  });

  if (loading && !cart) {
    return (
      <div className="store-container">
        <Skeleton rows={4} />
      </div>
    );
  }

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  const threshold = Number(cart?.freeShippingThreshold || 100);
  const shippingCost = Number(cart?.shippingTotal || 0);
  const discount = Number(cart?.discountTotal || 0);
  const grandTotal = Number(cart?.grandTotal || 0);
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / Math.max(1, threshold)) * 100));

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
              <div className="cart-line" key={item.variantId}>
                <img
                  src={item.imageUrl || "/media/terrain-fallback.jpg"}
                  alt={item.productName}
                />
                <div>
                  <Link href={`/store/product/${encodeURIComponent(item.productSlug)}`}>
                    <strong>{item.productName}</strong>
                  </Link>
                  <p className="muted" style={{ fontSize: 12 }}>
                    {item.variantTitle} · <code>{item.sku}</code>
                  </p>
                </div>
                <div className="qty-stepper">
                  <button
                    type="button"
                    disabled={updateMutation.isPending}
                    aria-label={`Decrease ${item.productName} quantity`}
                    onClick={() =>
                      item.quantity <= 1
                        ? removeMutation.mutate(item.variantId)
                        : updateMutation.mutate({
                            variantId: item.variantId,
                            qty: item.quantity - 1,
                          })
                    }
                  >
                    <Minus size={13} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    disabled={
                      updateMutation.isPending || item.quantity >= item.availableStock
                    }
                    aria-label={`Increase ${item.productName} quantity`}
                    onClick={() =>
                      updateMutation.mutate({
                        variantId: item.variantId,
                        qty: Math.min(item.availableStock, item.quantity + 1),
                      })
                    }
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <strong>{usdExact(Number(item.lineTotal))}</strong>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${item.productName}`}
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(item.variantId)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          <aside className="panel form-stack">
            <h2>Order summary</h2>

            <form
              className="button-row"
              onSubmit={(e) => {
                e.preventDefault();
                promoMutation.mutate(promoInput.trim());
              }}
            >
              <input
                aria-label="Discount code"
                placeholder="Promo code (e.g. WELCOME15)"
                style={{ flex: 1 }}
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
              />
              <Button type="submit" disabled={promoMutation.isPending}>
                Apply
              </Button>
            </form>
            {promoError ? (
              <p className="danger" role="alert" style={{ fontSize: 12 }}>
                {promoError}
              </p>
            ) : null}

            <div className="checkout-summary-row">
              <span className="muted">Subtotal</span>
              <strong>{usdExact(subtotal)}</strong>
            </div>
            {discount > 0 ? (
              <div className="checkout-summary-row success">
                <span>
                  Discount {cart?.promotionCode ? `(${cart.promotionCode})` : ""}
                </span>
                <strong>−{usdExact(discount)}</strong>
              </div>
            ) : null}
            <div className="checkout-summary-row">
              <span className="muted">Estimated shipping</span>
              <strong>{shippingCost === 0 ? "Free" : usdExact(shippingCost)}</strong>
            </div>
            <div
              className="checkout-summary-row"
              style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}
            >
              <strong>Estimated total</strong>
              <strong style={{ fontSize: 17 }}>{usdExact(grandTotal)}</strong>
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
  cart,
  loading,
  defaultProfile,
  onOrderPlaced,
  notify,
}: {
  cart?: CartResponse;
  loading: boolean;
  defaultProfile: { name: string; email: string; defaultAddress?: string };
  onOrderPlaced: (order: OrderDto) => void;
  notify: (msg: string) => void;
}) {
  const auth = useOptionalAuth();
  const authUser = auth?.user ?? null;
  const prefill = useCheckoutPrefillStore((s) => s.prefill);
  const prefillUpdatedAt = useCheckoutPrefillStore((s) => s.updatedAt);
  const clearPrefill = useCheckoutPrefillStore((s) => s.clearPrefill);

  const formKey = `${prefillUpdatedAt ?? 0}:${authUser?.id ?? "guest"}`;

  return (
    <CheckoutFormBody
      key={formKey}
      cart={cart}
      loading={loading}
      defaultProfile={defaultProfile}
      authUserName={authUser?.fullName || ""}
      authUserEmail={authUser?.email || ""}
      prefill={prefill}
      onClearPrefill={clearPrefill}
      onOrderPlaced={onOrderPlaced}
      notify={notify}
    />
  );
}

function CheckoutFormBody({
  cart,
  loading,
  defaultProfile,
  authUserName,
  authUserEmail,
  prefill,
  onClearPrefill,
  onOrderPlaced,
  notify,
}: {
  cart?: CartResponse;
  loading: boolean;
  defaultProfile: { name: string; email: string; defaultAddress?: string };
  authUserName: string;
  authUserEmail: string;
  prefill: CheckoutPrefillDto | null;
  onClearPrefill: () => void;
  onOrderPlaced: (order: OrderDto) => void;
  notify: (msg: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [customerName, setCustomerName] = useState(
    () => prefill?.customerName || authUserName || defaultProfile.name || ""
  );
  const [customerEmail, setCustomerEmail] = useState(
    () => prefill?.customerEmail || authUserEmail || defaultProfile.email || ""
  );
  const [line1, setLine1] = useState(
    () => prefill?.line1 || defaultProfile.defaultAddress || ""
  );
  const [city, setCity] = useState(() => prefill?.city || "");
  const [stateVal, setStateVal] = useState(() => prefill?.state || "");
  const [postalCode, setPostalCode] = useState(() => prefill?.postalCode || "");
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express">(
    () => (prefill?.shippingMethod === "express" ? "express" : "standard")
  );
  const [promoInput, setPromoInput] = useState(
    () => prefill?.promotionCode || cart?.promotionCode || ""
  );
  const [promoError, setPromoError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [idempotencyKey] = useState(() => newId());

  const promoMutation = useMutation({
    mutationFn: (code: string) => storeApi.applyPromotion(code),
    onSuccess: (next) => {
      queryClient.setQueryData(["store-cart"], next);
      setPromoError("");
      notify(next.promotionCode ? `Applied code ${next.promotionCode}` : "Removed promo");
    },
    onError: (err) =>
      setPromoError(err instanceof ApiError ? err.message : "Invalid code"),
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload: {
      customerName: string;
      customerEmail: string;
      line1: string;
      city: string;
      state?: string;
      postalCode: string;
    }) =>
      storeApi.checkout(
        {
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          address: {
            line1: payload.line1,
            city: payload.city,
            state: payload.state,
            postalCode: payload.postalCode,
            country: "US",
          },
          shippingMethod: deliveryMethod,
          promotionCode: cart?.promotionCode || undefined,
          paymentToken: "sandbox_ok",
        },
        idempotencyKey
      ),
    onSuccess: (order) => {
      onClearPrefill();
      queryClient.invalidateQueries({ queryKey: ["store-cart"] });
      onOrderPlaced(order);
      router.push(`/store/confirmation/${encodeURIComponent(order.orderNumber)}`);
    },
    onError: (err) =>
      setCheckoutError(err instanceof ApiError ? err.message : "Checkout failed"),
  });

  if (loading && !cart) {
    return (
      <div className="store-container">
        <Skeleton rows={4} />
      </div>
    );
  }

  const items = cart?.items || [];
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

  const subtotal = Number(cart?.subtotal || 0);
  const discount = Number(cart?.discountTotal || 0);
  const shipping =
    deliveryMethod === "express" ? 24 : Number(cart?.shippingTotal || 0);
  const estimatedGrandTotal = Math.max(0, subtotal - discount + shipping);

  return (
    <div className="store-container">
      <h1>Checkout</h1>
      {prefill ? (
        <div
          className="checkout-prefill-banner"
          role="status"
          data-testid="checkout-ai-prefill-banner"
        >
          <div className="checkout-prefill-text">
            <Sparkles size={15} />
            <div>
              <strong>Prefilled by Shopping AI</strong>
              <span>
                Please review all contact, shipping address, and delivery options below before clicking Place order.
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onClearPrefill();
              notify("Cleared AI checkout prefill");
            }}
          >
            <X size={13} /> Clear prefill
          </Button>
        </div>
      ) : null}

      <div className="checkout-grid">
        <form
          className="form-stack panel"
          onSubmit={(e) => {
            e.preventDefault();
            setCheckoutError("");
            checkoutMutation.mutate({
              customerName: customerName.trim(),
              customerEmail: customerEmail.trim(),
              line1: line1.trim(),
              city: city.trim(),
              state: stateVal.trim() || undefined,
              postalCode: postalCode.trim(),
            });
          }}
        >
          <h2>Contact &amp; delivery</h2>
          <div className="form-pair">
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Street address
            <input
              name="address"
              autoComplete="street-address"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              required
            />
          </label>
          <div className="form-pair">
            <label>
              City
              <input
                name="city"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </label>
            <label>
              State / Region
              <input
                name="state"
                autoComplete="address-level1"
                placeholder="WA"
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value)}
              />
            </label>
            <label>
              Postal code
              <input
                name="postal"
                autoComplete="postal-code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
              />
            </label>
          </div>

          <h2>Shipping method</h2>
          <div className="form-pair">
            <button
              type="button"
              className={"variant-pill " + (deliveryMethod === "standard" ? "active" : "")}
              onClick={() => setDeliveryMethod("standard")}
            >
              Standard (
              {Number(cart?.shippingTotal || 0) === 0
                ? "Free"
                : usdExact(Number(cart?.shippingTotal || 12))}
              )
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
            <Select
              items={PAYMENT_METHOD_ITEMS}
              defaultValue={PAYMENT_METHOD_ITEMS[0].value}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {checkoutError ? (
            <p className="danger" role="alert">
              {checkoutError}
            </p>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending
              ? "Processing order…"
              : `Place order · ${usdExact(estimatedGrandTotal)}`}
          </Button>
        </form>

        <aside className="panel form-stack">
          <h2>Order summary</h2>
          {items.map((item) => (
            <div key={item.variantId} className="checkout-summary-row">
              <span>
                {item.productName} × {item.quantity}
                <small className="muted" style={{ display: "block", fontSize: 11 }}>
                  {item.variantTitle} · <code>{item.sku}</code>
                </small>
              </span>
              <strong>{usdExact(Number(item.lineTotal))}</strong>
            </div>
          ))}

          <form
            className="button-row"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              promoMutation.mutate(promoInput.trim());
            }}
          >
            <input
              aria-label="Discount code"
              placeholder="Discount code (try WELCOME15)"
              style={{ flex: 1 }}
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
            />
            <Button type="submit" disabled={promoMutation.isPending}>
              Apply
            </Button>
          </form>
          {promoError ? (
            <p className="danger" role="alert" style={{ fontSize: 12 }}>
              {promoError}
            </p>
          ) : null}

          <div className="checkout-summary-row">
            <span className="muted">Subtotal</span>
            <span>{usdExact(subtotal)}</span>
          </div>
          <div className="checkout-summary-row">
            <span className="muted">Shipping</span>
            <span>{shipping === 0 ? "Free" : usdExact(shipping)}</span>
          </div>
          {discount > 0 ? (
            <div className="checkout-summary-row success">
              <span>
                Discount {cart?.promotionCode ? `(${cart.promotionCode})` : ""}
              </span>
              <span>−{usdExact(discount)}</span>
            </div>
          ) : null}
          <div
            className="checkout-summary-row"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}
          >
            <strong>Total</strong>
            <strong style={{ fontSize: 18 }}>{usdExact(estimatedGrandTotal)}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ConfirmationPage({ orderNumber }: { orderNumber: string }) {
  const orderQuery = useQuery({
    queryKey: ["store-order", orderNumber],
    queryFn: () => storeApi.getOrder(orderNumber),
    enabled: Boolean(orderNumber),
  });

  if (orderQuery.isLoading) {
    return (
      <div className="store-container">
        <Skeleton rows={4} />
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="store-container">
        <Empty
          title="Order confirmation not found"
          text={
            orderQuery.error instanceof ApiError
              ? orderQuery.error.message
              : "Check your order number or browse your history."
          }
          action={
            <Link className="btn primary" href="/store/history">
              View order history
            </Link>
          }
        />
      </div>
    );
  }

  const order = orderQuery.data;

  return (
    <div className="store-container">
      <div className="panel form-stack receipt">
        <div className="button-row">
          <CheckCircle2 size={24} className="success" />
          <div>
            <h1>Thank you for your order</h1>
            <p className="muted" style={{ fontSize: 13 }}>
              Confirmation sent to {order.customerEmail}
            </p>
          </div>
        </div>

        <div
          className="line-item"
          style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}
        >
          <span>Order number</span>
          <div className="button-row">
            <strong>{order.orderNumber}</strong>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
          </div>
        </div>
        <div className="line-item">
          <span>Placed</span>
          <span>{formatDateTime(order.createdAt)}</span>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Items</h3>
          {order.items.map((item) => (
            <div className="line-item" key={item.id}>
              <span>
                {item.productName} ({item.variantTitle}) × {item.quantity}
              </span>
              <strong>{usdExact(Number(item.lineTotal))}</strong>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div className="line-item">
            <span className="muted">Subtotal</span>
            <span>{usdExact(Number(order.subtotal))}</span>
          </div>
          {Number(order.discountTotal) > 0 ? (
            <div className="line-item success">
              <span>Discount</span>
              <span>−{usdExact(Number(order.discountTotal))}</span>
            </div>
          ) : null}
          <div className="line-item">
            <span className="muted">Shipping</span>
            <span>
              {Number(order.shippingTotal) === 0
                ? "Free"
                : usdExact(Number(order.shippingTotal))}
            </span>
          </div>
          <div className="line-item" style={{ marginTop: 6 }}>
            <strong>Total paid</strong>
            <strong style={{ fontSize: 18 }}>{usdExact(Number(order.grandTotal))}</strong>
          </div>
        </div>

        <div className="button-row" style={{ marginTop: 10 }}>
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
