"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  MapPin,
  PackageCheck,
  Search,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { Modal } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { adminOrderApi } from "@/lib/commerce-api";
import { formatDateTime, usdExact } from "@/lib/format";
import type { OrderDto } from "@/types/api-commerce";

const ORDER_STATUS_FILTER_ITEMS = [
  { value: "", label: "All statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELED", label: "Canceled" },
];

const NEXT_STATUSES: Record<string, string[]> = {
  CONFIRMED: ["PROCESSING", "SHIPPED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
};

export function Orders({
  id,
  notify,
}: {
  id?: string;
  notify: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("order:write");
  const canCancel = hasPermission("order:cancel");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [shippingModal, setShippingModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState("");

  const listQuery = useQuery({
    queryKey: ["admin-orders", statusFilter],
    queryFn: () => adminOrderApi.list(statusFilter || undefined),
    enabled: !id,
  });

  const detailQuery = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => adminOrderApi.get(id!),
    enabled: Boolean(id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      trackingNumber,
    }: {
      orderId: string;
      status: string;
      trackingNumber?: string;
    }) => adminOrderApi.updateStatus(orderId, { status, trackingNumber }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", updated.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setShippingModal(false);
      setActionError("");
      notify(`Order ${updated.orderNumber} updated to ${updated.status}`);
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Failed to update order"),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      adminOrderApi.cancel(orderId, reason),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", updated.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
      setCancelModal(false);
      setCancelReason("");
      setActionError("");
      notify(`Order ${updated.orderNumber} canceled and stock restored`);
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel order"),
  });

  if (id) {
    if (detailQuery.isLoading) return <Skeleton rows={4} />;
    if (detailQuery.isError || !detailQuery.data) {
      return (
        <Empty
          title="Order not found"
          text={
            detailQuery.error instanceof ApiError
              ? detailQuery.error.message
              : "This order could not be loaded."
          }
          action={
            <Link className="btn primary" href="/admin/orders">
              Back to orders
            </Link>
          }
        />
      );
    }

    const order: OrderDto = detailQuery.data;
    const validNext = NEXT_STATUSES[order.status.toUpperCase()] || [];
    const allowCancel =
      canCancel &&
      order.status.toUpperCase() !== "DELIVERED" &&
      order.status.toUpperCase() !== "CANCELED";

    return (
      <>
        <div className="admin-title">
          <div>
            <div className="button-row" style={{ marginBottom: 6 }}>
              <Link href="/admin/orders" className="muted" style={{ fontSize: 12 }}>
                ← All orders
              </Link>
              <StatusBadge status={order.paymentStatus} />
              <StatusBadge status={order.status} />
            </div>
            <h1>Order {order.orderNumber}</h1>
            <p>{formatDateTime(order.createdAt)}</p>
          </div>
          <div className="button-row">
            {canWrite && validNext.length > 0 ? (
              <Button
                variant="primary"
                onClick={() => {
                  setActionError("");
                  setShippingModal(true);
                }}
              >
                <Truck size={15} /> Update fulfillment
              </Button>
            ) : null}
            {allowCancel ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setActionError("");
                  setCancelModal(true);
                }}
              >
                <XCircle size={15} /> Cancel order
              </Button>
            ) : null}
          </div>
        </div>

        <div className="admin-form-grid">
          <div className="form-stack">
            <section className="panel form-stack">
              <h2>Line items</h2>
              {order.items.map((item) => (
                <div className="line-item" key={item.id}>
                  <span>
                    <strong>{item.productName}</strong> · {item.variantTitle}
                    <code style={{ marginLeft: 8 }}>{item.sku}</code>
                    <small className="muted" style={{ marginLeft: 6 }}>
                      × {item.quantity}
                    </small>
                  </span>
                  <strong>{usdExact(item.lineTotal)}</strong>
                </div>
              ))}
              {order.discountTotal > 0 ? (
                <div className="line-item success">
                  <span>
                    Discount {order.promotionCode ? `(${order.promotionCode})` : ""}
                  </span>
                  <span>−{usdExact(order.discountTotal)}</span>
                </div>
              ) : null}
              <div className="line-item">
                <span className="muted">Subtotal</span>
                <span>{usdExact(order.subtotal)}</span>
              </div>
              <div className="line-item">
                <span className="muted">Shipping</span>
                <span>
                  {order.shippingTotal > 0 ? usdExact(order.shippingTotal) : "Free"}
                </span>
              </div>
              <div className="line-item">
                <strong>Total</strong>
                <strong style={{ fontSize: 16 }}>{usdExact(order.grandTotal)}</strong>
              </div>
            </section>

            <section className="panel form-stack">
              <h2>Order timeline</h2>
              <ol className="order-timeline">
                {order.events.map((evt, idx) => (
                  <li key={idx}>
                    <span className="order-timeline-dot">
                      {evt.kind === "payment" ? (
                        <CreditCard size={12} />
                      ) : evt.kind === "fulfillment" ? (
                        <PackageCheck size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                    </span>
                    <div>
                      <strong>{evt.label}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {evt.detail} · {formatDateTime(evt.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="form-stack">
            <section className="panel form-stack">
              <h2>Customer</h2>
              <div>
                <strong style={{ display: "block" }}>{order.customerName}</strong>
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="muted"
                  style={{ fontSize: 12.5 }}
                >
                  {order.customerEmail}
                </a>
              </div>
              {order.shippingAddress ? (
                <div style={{ fontSize: 12.5 }}>
                  <strong className="inline-label" style={{ marginBottom: 3 }}>
                    <MapPin size={13} /> Shipping address
                  </strong>
                  <p className="muted">
                    {order.shippingAddress.line1}, {order.shippingAddress.city}
                    {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ""}{" "}
                    {order.shippingAddress.postalCode} {order.shippingAddress.country}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="panel form-stack">
              <h2>Shipment</h2>
              <div>
                <StatusBadge status={order.fulfillmentStatus} />
              </div>
              <p className="muted" style={{ fontSize: 12.5 }}>
                Tracking:{" "}
                {order.trackingNumber ? (
                  <code>{order.trackingNumber}</code>
                ) : (
                  "Not assigned yet"
                )}
              </p>
            </section>
          </aside>
        </div>

        {shippingModal ? (
          <Modal
            title="Update fulfillment & tracking"
            description="Advance order status along validated fulfillment transitions."
            close={() => setShippingModal(false)}
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateStatusMutation.mutate({
                  orderId: order.id,
                  status: String(fd.get("status") || validNext[0]),
                  trackingNumber: String(fd.get("trackingNumber") || "").trim(),
                });
              }}
            >
              <label>
                Next status
                <Select
                  name="status"
                  items={validNext.map((s) => ({ value: s, label: s }))}
                  defaultValue={validNext[0]}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validNext.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                Tracking number
                <input
                  name="trackingNumber"
                  defaultValue={order.trackingNumber || ""}
                  placeholder="1Z999AA10123456784"
                />
              </label>
              {actionError ? (
                <p className="danger" role="alert">
                  {actionError}
                </p>
              ) : null}
              <div className="modal-actions">
                <Button onClick={() => setShippingModal(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                >
                  Save fulfillment
                </Button>
              </div>
            </form>
          </Modal>
        ) : null}

        {cancelModal ? (
          <Modal
            title={`Cancel ${order.orderNumber}?`}
            description="Canceling marks payment as REFUNDED and immediately restores reserved stock."
            close={() => setCancelModal(false)}
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                cancelMutation.mutate({
                  orderId: order.id,
                  reason: cancelReason.trim() || undefined,
                });
              }}
            >
              <label>
                Cancellation reason
                <input
                  value={cancelReason}
                  placeholder="Customer requested cancel"
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </label>
              {actionError ? (
                <p className="danger" role="alert">
                  {actionError}
                </p>
              ) : null}
              <div className="modal-actions">
                <Button onClick={() => setCancelModal(false)}>Keep order</Button>
                <Button
                  variant="destructive"
                  type="submit"
                  disabled={cancelMutation.isPending}
                >
                  Confirm cancel & refund
                </Button>
              </div>
            </form>
          </Modal>
        ) : null}
      </>
    );
  }

  const orders: OrderDto[] = (listQuery.data || []).filter((o) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Orders</h1>
          <p>Track payments, advance fulfillment state, and process cancellations.</p>
        </div>
        <Badge tone="accent">{orders.length} orders</Badge>
      </div>

      <div className="admin-table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search orders"
              placeholder="Search order #, customer, or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <Select
            items={ORDER_STATUS_FILTER_ITEMS}
            value={statusFilter}
            onValueChange={(next) => setStatusFilter(next ?? "")}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value || "all"} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {listQuery.isLoading ? (
          <Skeleton rows={4} />
        ) : orders.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`}>
                        <strong>{order.orderNumber}</strong>
                      </Link>
                    </td>
                    <td>
                      <span style={{ display: "block" }}>{order.customerName}</span>
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {order.customerEmail}
                      </span>
                    </td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>{order.items.reduce((s, l) => s + l.quantity, 0)}</td>
                    <td>
                      <strong>{usdExact(order.grandTotal)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<ShoppingBag size={22} />}
            title="No orders match"
            text="Orders placed on the public storefront will appear here."
          />
        )}
      </div>
    </>
  );
}
