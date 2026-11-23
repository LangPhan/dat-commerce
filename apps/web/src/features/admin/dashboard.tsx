"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Package,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  adminAnalyticsApi,
  adminInventoryApi,
  adminOrderApi,
} from "@/lib/commerce-api";
import { usd, usdExact } from "@/lib/format";

export function Dashboard({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canAdjustInventory = hasPermission("inventory:write");
  const canReadOrders = hasPermission("order:read");

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminAnalyticsApi.summary(),
  });

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", "dashboard"],
    queryFn: () => adminOrderApi.list(),
    enabled: canReadOrders,
  });

  const restockMutation = useMutation({
    mutationFn: ({ variantId }: { variantId: string }) =>
      adminInventoryApi.adjust({
        variantId,
        delta: 10,
        reason: "Dashboard quick restock",
      }),
    onSuccess: (lvl) => {
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      notify(`Added +10 units to SKU ${lvl.sku}`);
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to restock SKU"),
  });

  if (summaryQuery.isLoading) {
    return <Skeleton rows={5} />;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <Empty
        title="Could not load dashboard metrics"
        text={
          summaryQuery.error instanceof ApiError
            ? summaryQuery.error.message
            : "Analytics summary could not be retrieved."
        }
      />
    );
  }

  const summary = summaryQuery.data;
  const series = summary.revenueSeries.length
    ? summary.revenueSeries
    : [{ label: "Today", amount: 0, orders: 0 }];
  const recentOrders = ordersQuery.data?.slice(0, 5) || [];

  const maxAmount = Math.max(...series.map((s) => Number(s.amount)), 1);
  const chartW = 540;
  const chartH = 180;
  const padX = 28;
  const padY = 18;
  const usableW = chartW - padX * 2;
  const usableH = chartH - padY * 2;

  const points = series.map((pt, i) => {
    const x =
      series.length === 1
        ? chartW / 2
        : padX + (i / (series.length - 1)) * usableW;
    const y = padY + usableH - (Number(pt.amount) / maxAmount) * usableH;
    return { ...pt, x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath =
    points.length > 1
      ? `M ${points[0].x},${chartH - padY} L ${points
          .map((p) => `${p.x},${p.y}`)
          .join(" L ")} L ${points[points.length - 1].x},${chartH - padY} Z`
      : "";

  const activePoint =
    hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Overview</h1>
          <p>Live store revenue, order throughput, and catalog stock telemetry.</p>
        </div>
        <div className="button-row">
          <Link className="btn" href="/admin/orders">
            Manage orders
          </Link>
          <Link className="btn primary" href="/admin/products">
            Manage catalog
          </Link>
        </div>
      </div>

      <div className="metrics">
        <div className="panel metric">
          <span>Gross revenue</span>
          <strong>{usdExact(summary.totalRevenue)}</strong>
          <small className="muted">Calculated from live non-canceled orders</small>
        </div>
        <div className="panel metric">
          <span>Total orders</span>
          <strong>{summary.totalOrders}</strong>
          <small className="muted">Persisted in PostgreSQL</small>
        </div>
        <div className="panel metric">
          <span>Average order value</span>
          <strong>{usdExact(summary.averageOrderValue)}</strong>
          <small className="muted">Per fulfilled or active order</small>
        </div>
        <div className="panel metric">
          <span>Catalog & stock</span>
          <strong>{summary.productCount} products</strong>
          <small className={summary.lowStockCount ? "danger" : "muted"}>
            <Package size={13} /> {summary.lowStockCount} low-stock{" "}
            {summary.lowStockCount === 1 ? "SKU" : "SKUs"}
          </small>
        </div>
      </div>

      <div className="dash-charts">
        <section className="panel">
          <div className="chart-head">
            <div>
              <h2>Revenue trajectory</h2>
              <p className="muted">Daily order revenue in USD</p>
            </div>
            {activePoint ? (
              <Badge tone="accent">
                {activePoint.label}: {usd(Number(activePoint.amount))} ·{" "}
                {activePoint.orders} orders
              </Badge>
            ) : null}
          </div>

          <div className="svg-chart-wrap">
            <svg
              viewBox={`0 0 ${chartW} ${chartH + 22}`}
              role="img"
              aria-label="Revenue chart"
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padY + usableH * (1 - ratio);
                return (
                  <line
                    key={ratio}
                    x1={padX}
                    x2={chartW - padX}
                    y1={y}
                    y2={y}
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                );
              })}
              {areaPath ? <path d={areaPath} fill="url(#revGrad)" /> : null}
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polyline}
              />
              {points.map((pt, idx) => (
                <g key={pt.label}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIdx === idx ? 5.5 : 3.8}
                    fill="var(--surface)"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                  />
                  <rect
                    x={pt.x - 22}
                    y={0}
                    width={44}
                    height={chartH + 20}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                  <text
                    x={pt.x}
                    y={chartH + 12}
                    textAnchor="middle"
                    fontSize="10.5"
                    fill="var(--muted)"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </section>

        <section className="panel sales-category">
          <div className="chart-head">
            <div>
              <h2>Sales by category</h2>
              <p className="muted">Share of gross merchandise value</p>
            </div>
            <TrendingUp size={16} className="muted" />
          </div>
          {summary.categoryBreakdown.length ? (
            summary.categoryBreakdown.map((row) => (
              <div key={row.category}>
                <span>
                  <span>{row.category}</span>
                  <span>
                    {usd(Number(row.revenue))} · <strong>{row.share}%</strong>
                  </span>
                </span>
                <progress aria-label={row.category} value={row.share} max={100} />
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>
              No order revenue recorded yet.
            </p>
          )}
        </section>
      </div>

      <div className="dash-charts">
        <section className="admin-table-panel">
          <div className="section-title">
            <h2>Recent orders</h2>
            <Link href="/admin/orders">
              View all orders <ArrowRight size={14} />
            </Link>
          </div>
          {recentOrders.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/admin/orders/${order.id}`}>
                          <strong>{order.orderNumber}</strong>
                        </Link>
                      </td>
                      <td>{order.customerName}</td>
                      <td>
                        <StatusBadge status={order.paymentStatus} />
                      </td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td>{usdExact(order.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted" style={{ padding: "8px 0" }}>
              No recent orders available for this role.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>Top products</h2>
            <Link href="/admin/products">
              Catalog <ArrowRight size={13} />
            </Link>
          </div>
          {summary.topProducts.map((item) => (
            <Link
              key={item.productId}
              className="dash-product"
              href={`/admin/products/${item.productId}`}
            >
              <img src={item.imageUrl || "/media/terrain-fallback.jpg"} alt="" />
              <div>
                <strong style={{ display: "block" }}>{item.name}</strong>
                <span className="muted" style={{ fontSize: 11 }}>
                  {usd(Number(item.price))}
                </span>
              </div>
              <small>{item.unitsSold} sold</small>
            </Link>
          ))}

          <h2 className="low-title">Low stock alerts</h2>
          {summary.lowStockItems.length ? (
            summary.lowStockItems.map((item) => (
              <div key={item.variantId} className="dash-product">
                <ArrowDownRight size={15} className="danger" />
                <div>
                  <Link href={`/admin/products/${item.productId}`}>
                    <strong>{item.productName}</strong>
                  </Link>
                  <span className="muted" style={{ display: "block", fontSize: 11 }}>
                    <code>{item.sku}</code> · Only {item.availableStock} left
                  </span>
                </div>
                {canAdjustInventory ? (
                  <Button
                    size="sm"
                    disabled={restockMutation.isPending}
                    onClick={() => restockMutation.mutate({ variantId: item.variantId })}
                  >
                    +10
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>
              All tracked SKUs have healthy stock above 5 units.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
