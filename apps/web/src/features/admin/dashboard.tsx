"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, Package, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  adminAnalyticsApi,
  adminInventoryApi,
  adminOrderApi,
} from "@/lib/commerce-api";
import { usd, usdExact } from "@/lib/format";
import type { AnalyticsSummaryDto, OrderDto } from "@/types/api-commerce";

const REV_CHART_W = 540;
const REV_CHART_H = 160;
const REV_PAD_X = 28;
const REV_PAD_Y = 16;
const REV_USABLE_W = REV_CHART_W - REV_PAD_X * 2;
const REV_USABLE_H = REV_CHART_H - REV_PAD_Y * 2;

const REV_CHART_DEFS = (
  <defs>
    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
    </linearGradient>
  </defs>
);

const REV_CHART_GRID_LINES = [0.25, 0.5, 0.75, 1].map((ratio) => {
  const y = REV_PAD_Y + REV_USABLE_H * (1 - ratio);
  return (
    <line
      key={ratio}
      x1={REV_PAD_X}
      x2={REV_CHART_W - REV_PAD_X}
      y1={y}
      y2={y}
      stroke="var(--line)"
      strokeWidth="1"
    />
  );
});

function RevenueChart({
  revenueSeries,
}: {
  revenueSeries: AnalyticsSummaryDto["revenueSeries"];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { points, polyline, areaPath } = useMemo(() => {
    const series = revenueSeries.length
      ? revenueSeries
      : [{ label: "Today", amount: 0, orders: 0 }];
    let maxAmount = 1;
    for (let i = 0; i < series.length; i += 1) {
      const amt = Number(series[i].amount);
      if (amt > maxAmount) maxAmount = amt;
    }

    const pts = new Array<{
      label: string;
      amount: number;
      orders: number;
      x: number;
      y: number;
    }>(series.length);
    const polyParts = new Array<string>(series.length);

    for (let i = 0; i < series.length; i += 1) {
      const pt = series[i];
      const x =
        series.length === 1
          ? REV_CHART_W / 2
          : REV_PAD_X + (i / (series.length - 1)) * REV_USABLE_W;
      const y =
        REV_PAD_Y +
        REV_USABLE_H -
        (Number(pt.amount) / maxAmount) * REV_USABLE_H;
      pts[i] = { ...pt, x, y };
      polyParts[i] = `${x},${y}`;
    }

    const lineStr = polyParts.join(" ");
    const areaStr =
      pts.length > 1
        ? `M ${pts[0].x},${REV_CHART_H - REV_PAD_Y} L ${polyParts.join(" L ")} L ${pts[pts.length - 1].x},${REV_CHART_H - REV_PAD_Y} Z`
        : "";
    return { points: pts, polyline: lineStr, areaPath: areaStr };
  }, [revenueSeries]);

  const activePoint =
    hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
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
          viewBox={`0 0 ${REV_CHART_W} ${REV_CHART_H + 22}`}
          role="img"
          aria-label="Revenue chart"
          style={{ height: 180 }}
        >
          {REV_CHART_DEFS}
          {REV_CHART_GRID_LINES}
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
                height={REV_CHART_H + 20}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              <text
                x={pt.x}
                y={REV_CHART_H + 12}
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
  );
}

export function Dashboard({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canAdjustInventory = hasPermission("inventory:write");
  const canReadOrders = hasPermission("order:read");

  const summaryQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminAnalyticsApi.summary(),
  });

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", ""],
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
  const allOrders = ordersQuery.data || [];

  const recentOrderColumns: DataTableColumn<OrderDto>[] = [
    {
      id: "order",
      header: "Order",
      cell: (order) => (
        <Link href={`/admin/orders/${order.id}`}>
          <strong>{order.orderNumber}</strong>
        </Link>
      ),
    },
    { id: "customer", header: "Customer", cell: (order) => order.customerName },
    {
      id: "payment",
      header: "Payment",
      cell: (order) => <StatusBadge status={order.paymentStatus} />,
    },
    {
      id: "status",
      header: "Status",
      cell: (order) => <StatusBadge status={order.status} />,
    },
    {
      id: "total",
      header: "Total",
      cell: (order) => usdExact(order.grandTotal),
    },
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Overview</h1>
          <p>
            Live store revenue, order throughput, and catalog stock telemetry.
          </p>
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
      <div className="admin-page-scroll">
        <div className="metrics">
          <div className="panel metric">
            <span>Gross revenue</span>
            <strong>{usdExact(summary.totalRevenue)}</strong>
            <small className="muted">
              Calculated from live non-canceled orders
            </small>
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
          <RevenueChart revenueSeries={summary.revenueSeries} />

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
                  <progress
                    aria-label={row.category}
                    value={row.share}
                    max={100}
                  />
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
          <DataTable
            title="Recent orders"
            headerActions={
              <Link
                href="/admin/orders"
                className="inline-label"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--accent-text)",
                }}
              >
                View all orders <ArrowRight size={14} />
              </Link>
            }
            columns={recentOrderColumns}
            data={allOrders}
            getRowKey={(order) => order.id}
            pageSize={5}
            emptyState={
              <p className="muted" style={{ padding: "8px 0" }}>
                No recent orders available for this role.
              </p>
            }
          />

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
                <img
                  src={item.imageUrl || "/media/terrain-fallback.jpg"}
                  alt=""
                />
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
                    <span
                      className="muted"
                      style={{ display: "block", fontSize: 11 }}
                    >
                      <code>{item.sku}</code> · Only {item.availableStock} left
                    </span>
                  </div>
                  {canAdjustInventory ? (
                    <Button
                      size="sm"
                      disabled={restockMutation.isPending}
                      onClick={() =>
                        restockMutation.mutate({ variantId: item.variantId })
                      }
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
      </div>
    </>
  );
}
