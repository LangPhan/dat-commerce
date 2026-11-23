"use client";
import Link from "next/link";
import { CheckCircle2, CreditCard, MapPin, PackageCheck, Search, Truck } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Empty, Pagination } from "@/components/ui/data-display";
import { usdExact } from "@/lib/format";
import type { Order } from "@/types/commerce";

const PAGE_SIZE = 7;

export function Orders({
  items,
  id,
  save,
  notify,
}: {
  items: Order[];
  id?: string;
  save: (items: Order[]) => void;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [shippingModal, setShippingModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [page, setPage] = useState(1);

  const order = items.find((item) => item.id === id);

  if (order) {
    const timeline = order.timeline || [
      {
        label: "Order placed",
        detail: "Storefront order recorded",
        timestamp: order.date,
        kind: "placed" as const,
      },
      {
        label: `Payment ${order.payment.toLowerCase()}`,
        detail: usdExact(order.total),
        timestamp: order.date,
        kind: "payment" as const,
      },
    ];

    return (
      <>
        <div className="admin-title">
          <div>
            <h1>Order #{order.id}</h1>
            <p>
              Placed {order.date} · {order.customer}
            </p>
          </div>
          <div className="button-row">
            <Button onClick={() => setPaymentModal(true)}>Update payment</Button>
            <Button variant="primary" onClick={() => setShippingModal(true)}>
              <Truck size={15} /> Update fulfillment
            </Button>
          </div>
        </div>

        <div className="admin-form-grid">
          <div className="form-stack">
            <section className="panel form-stack">
              <div className="section-title" style={{ padding: 0 }}>
                <h2>Items & pricing</h2>
                <div className="button-row">
                  <StatusBadge status={order.payment} />
                  <StatusBadge status={order.fulfillment} />
                </div>
              </div>
              {order.items.map((item) => (
                <div key={item.name} className="line-item">
                  <span>
                    <strong>{item.name}</strong>
                    {item.sku ? (
                      <code style={{ marginLeft: 8 }}>{item.sku}</code>
                    ) : null}
                    <small className="muted" style={{ marginLeft: 6 }}>
                      × {item.qty}
                    </small>
                  </span>
                  <strong>{usdExact(item.price * item.qty)}</strong>
                </div>
              ))}
              {order.discountAmount ? (
                <div className="line-item success">
                  <span>Discount</span>
                  <span>−{usdExact(order.discountAmount)}</span>
                </div>
              ) : null}
              <div className="line-item">
                <span className="muted">Shipping</span>
                <span>{order.shippingCost ? usdExact(order.shippingCost) : "Free"}</span>
              </div>
              <div className="line-item">
                <strong>Total</strong>
                <strong style={{ fontSize: 16 }}>{usdExact(order.total)}</strong>
              </div>
            </section>

            <section className="panel form-stack">
              <h2>Order timeline</h2>
              <ol className="order-timeline">
                {timeline.map((evt, idx) => (
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
                        {evt.detail} · {evt.timestamp}
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
                <strong style={{ display: "block" }}>{order.customer}</strong>
                <a
                  href={`mailto:${order.email}`}
                  className="muted"
                  style={{ fontSize: 12.5 }}
                >
                  {order.email}
                </a>
              </div>
              {order.shippingAddress ? (
                <div style={{ fontSize: 12.5 }}>
                  <strong className="inline-label" style={{ marginBottom: 3 }}>
                    <MapPin size={13} /> Shipping address
                  </strong>
                  <p className="muted">{order.shippingAddress}</p>
                </div>
              ) : null}
            </section>

            <section className="panel form-stack">
              <h2>Shipment</h2>
              <div>
                <StatusBadge status={order.fulfillment} />
              </div>
              <p className="muted" style={{ fontSize: 12.5 }}>
                Tracking:{" "}
                {order.tracking ? <code>{order.tracking}</code> : "Not assigned yet"}
              </p>
            </section>
          </aside>
        </div>

        {shippingModal ? (
          <Modal
            title="Update fulfillment & tracking"
            description="Record shipment progress and notify the order timeline."
            close={() => setShippingModal(false)}
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget);
                const nextStatus = String(fields.get("status"));
                const nextTracking = String(fields.get("tracking"));
                save(
                  items.map((item) =>
                    item.id === order.id
                      ? {
                          ...item,
                          fulfillment: nextStatus,
                          tracking: nextTracking,
                          timeline: [
                            ...(item.timeline || timeline),
                            {
                              label: `Marked as ${nextStatus}`,
                              detail: nextTracking
                                ? `Tracking ${nextTracking}`
                                : "Fulfillment updated",
                              timestamp: new Date()
                                .toISOString()
                                .slice(0, 16)
                                .replace("T", " "),
                              kind: "fulfillment",
                            },
                          ],
                        }
                      : item
                  )
                );
                setShippingModal(false);
                notify("Fulfillment updated");
              }}
            >
              <label>
                Fulfillment status
                <select name="status" defaultValue={order.fulfillment}>
                  <option>Unfulfilled</option>
                  <option>Processing</option>
                  <option>Shipped</option>
                  <option>Delivered</option>
                </select>
              </label>
              <label>
                Tracking number
                <input
                  name="tracking"
                  defaultValue={order.tracking}
                  placeholder="DEMO-765001"
                />
              </label>
              <div className="modal-actions">
                <Button onClick={() => setShippingModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">
                  Save shipment
                </Button>
              </div>
            </form>
          </Modal>
        ) : null}

        {paymentModal ? (
          <Modal
            title="Update payment status"
            description="Record payment capture or refund for this order."
            close={() => setPaymentModal(false)}
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const nextPay = String(new FormData(e.currentTarget).get("payment"));
                save(
                  items.map((item) =>
                    item.id === order.id
                      ? {
                          ...item,
                          payment: nextPay,
                          timeline: [
                            ...(item.timeline || timeline),
                            {
                              label: `Payment ${nextPay.toLowerCase()}`,
                              detail: usdExact(order.total),
                              timestamp: new Date()
                                .toISOString()
                                .slice(0, 16)
                                .replace("T", " "),
                              kind: "payment",
                            },
                          ],
                        }
                      : item
                  )
                );
                setPaymentModal(false);
                notify("Payment status updated");
              }}
            >
              <label>
                Payment status
                <select name="payment" defaultValue={order.payment}>
                  <option>Paid</option>
                  <option>Pending</option>
                  <option>Refunded</option>
                </select>
              </label>
              <div className="modal-actions">
                <Button onClick={() => setPaymentModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">
                  Save payment
                </Button>
              </div>
            </form>
          </Modal>
        ) : null}
      </>
    );
  }

  const rows = items.filter((item) => {
    if (fulfillmentFilter && item.fulfillment !== fulfillmentFilter) return false;
    if (paymentFilter && item.payment !== paymentFilter) return false;
    if (!query.trim()) return true;
    return [item.customer, item.email, item.id, item.tracking]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayed = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Orders</h1>
          <p>Monitor payments, fulfillment stages, and customer shipments.</p>
        </div>
      </div>

      <div className="admin-table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Find orders"
              placeholder="Search by order #, customer, email…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Payment status"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All payments</option>
            <option>Paid</option>
            <option>Pending</option>
            <option>Refunded</option>
          </select>
          <select
            aria-label="Fulfillment status"
            value={fulfillmentFilter}
            onChange={(e) => {
              setFulfillmentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All fulfillment</option>
            <option>Unfulfilled</option>
            <option>Processing</option>
            <option>Shipped</option>
            <option>Delivered</option>
          </select>
        </div>

        {displayed.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/orders/${row.id}`}>
                        <strong>#{row.id}</strong>
                      </Link>
                    </td>
                    <td>{row.date}</td>
                    <td>
                      <div>{row.customer}</div>
                      <small className="muted">{row.email}</small>
                    </td>
                    <td>{row.items.reduce((sum, i) => sum + i.qty, 0)} items</td>
                    <td>
                      <StatusBadge status={row.payment} />
                    </td>
                    <td>
                      <StatusBadge status={row.fulfillment} />
                    </td>
                    <td>
                      <strong>{usdExact(row.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching orders"
            text="Adjust your search query or status filters."
          />
        )}

        <div className="table-footer">
          <Pagination
            page={safePage}
            totalItems={rows.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
    </>
  );
}
