"use client";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Package,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { usd } from "@/lib/format";
import { categorySalesBreakdown, revenueSeries } from "@/mocks/operations";
import type { Order, Product } from "@/types/commerce";

type RangeKey = keyof typeof revenueSeries;

export function Dashboard({
  products,
  orders,
  restock,
}: {
  products: Product[];
  orders: Order[];
  restock: (productId: string, addUnits: number) => void;
}) {
  const [range, setRange] = useState<RangeKey>("Last 30 days");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const series = revenueSeries[range];
  const totalRevenue = series.reduce((sum, pt) => sum + pt.amount, 0);
  const totalOrders = series.reduce((sum, pt) => sum + pt.orders, 0);
  const aov = totalOrders ? totalRevenue / totalOrders : 0;
  const lowStock = products.filter((p) => p.stock <= 5);
  const topProducts = [...products]
    .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
    .slice(0, 4);

  const maxAmount = Math.max(...series.map((s) => s.amount), 1);
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
    const y = padY + usableH - (pt.amount / maxAmount) * usableH;
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
          <p>Revenue, fulfillment health, and catalog signals for Terrain Supply.</p>
        </div>
        <div className="button-row">
          <select
            aria-label="Reporting period"
            value={range}
            onChange={(e) => {
              setRange(e.target.value as RangeKey);
              setHoveredIdx(null);
            }}
          >
            <option value="Last 14 days">Last 14 days</option>
            <option value="Last 30 days">Last 30 days</option>
            <option value="Last 90 days">Last 90 days</option>
          </select>
          <Button variant="primary" onClick={() => setInsightsOpen(true)}>
            <Sparkles size={15} /> Analyze sales
          </Button>
        </div>
      </div>

      <div className="metrics">
        <div className="panel metric">
          <span>Total revenue</span>
          <strong>{usd(totalRevenue)}</strong>
          <small className="success">
            <ArrowUpRight size={13} /> +16.4% vs prior period
          </small>
        </div>
        <div className="panel metric">
          <span>Orders</span>
          <strong>{totalOrders}</strong>
          <small className="success">
            <ArrowUpRight size={13} /> +8.2% conversion velocity
          </small>
        </div>
        <div className="panel metric">
          <span>Average order value</span>
          <strong>{usd(aov)}</strong>
          <small className="success">
            <ArrowUpRight size={13} /> +7.5% basket expansion
          </small>
        </div>
        <div className="panel metric">
          <span>Catalog & stock</span>
          <strong>{products.length} products</strong>
          <small className={lowStock.length ? "danger" : "muted"}>
            <Package size={13} /> {lowStock.length} low-stock{" "}
            {lowStock.length === 1 ? "SKU" : "SKUs"}
          </small>
        </div>
      </div>

      <div className="dash-charts">
        <section className="panel">
          <div className="chart-head">
            <div>
              <h2>Revenue trajectory</h2>
              <p className="muted">Gross sales in USD ({range.toLowerCase()})</p>
            </div>
            {activePoint ? (
              <Badge tone="accent">
                {activePoint.label}: {usd(activePoint.amount)} · {activePoint.orders} orders
              </Badge>
            ) : null}
          </div>

          <div className="svg-chart-wrap">
            <svg viewBox={`0 0 ${chartW} ${chartH + 22}`} role="img" aria-label="Revenue chart">
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
          {categorySalesBreakdown.map((row) => (
            <div key={row.category}>
              <span>
                <span>{row.category}</span>
                <span>
                  {usd(row.revenue)} · <strong>{row.share}%</strong>
                </span>
              </span>
              <progress
                aria-label={row.category}
                value={row.share}
                max={100}
              />
            </div>
          ))}
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
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`}>#{order.id}</Link>
                    </td>
                    <td>{order.customer}</td>
                    <td>
                      <Badge tone={order.payment === "Paid" ? "green" : "amber"}>
                        {order.payment}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          order.fulfillment === "Delivered"
                            ? "green"
                            : order.fulfillment === "Shipped"
                              ? "accent"
                              : "neutral"
                        }
                      >
                        {order.fulfillment}
                      </Badge>
                    </td>
                    <td>{usd(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>Top-selling products</h2>
            <Link href="/admin/products">
              Catalog <ArrowRight size={13} />
            </Link>
          </div>
          {topProducts.map((item) => (
            <Link
              key={item.id}
              className="dash-product"
              href={`/admin/products/${item.id}`}
            >
              <img src={item.image} alt="" />
              <div>
                <strong style={{ display: "block" }}>{item.name}</strong>
                <span className="muted" style={{ fontSize: 11 }}>
                  {item.category} · {usd(item.price)}
                </span>
              </div>
              <small>{item.salesCount || 12} sold</small>
            </Link>
          ))}

          <h2 className="low-title">Low stock alerts</h2>
          {lowStock.length ? (
            lowStock.map((item) => (
              <div key={item.id} className="dash-product">
                <ArrowDownRight size={15} className="danger" />
                <div>
                  <Link href={`/admin/products/${item.id}`}>
                    <strong>{item.name}</strong>
                  </Link>
                  <span className="muted" style={{ display: "block", fontSize: 11 }}>
                    {item.stock} remaining
                  </span>
                </div>
                <Button
                  size="sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => restock(item.id, 10)}
                >
                  +10 Restock
                </Button>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>
              All active SKUs are above safety stock levels.
            </p>
          )}
        </section>
      </div>

      {insightsOpen ? (
        <Drawer
          title="AI Revenue Analysis"
          description={`Summary generated for ${range.toLowerCase()} across ${products.length} active SKUs.`}
          close={() => setInsightsOpen(false)}
        >
          <div className="form-stack">
            <div className="panel" style={{ background: "var(--subtle)" }}>
              <strong>Key takeaways</strong>
              <ul style={{ marginTop: 8, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13 }}>
                <li>
                  <strong>Laptops drive 42% of revenue</strong> ({usd(47418)}) with high
                  average order value led by FormaBook Pro 14.
                </li>
                <li>
                  <strong>Footwear leads order volume</strong> (27% revenue share) with strong
                  repeat demand for Ridge Runner GTX.
                </li>
                <li>
                  <strong>{lowStock.length} SKUs are low on stock</strong> — restocking{" "}
                  {lowStock.map((p) => p.name).join(", ") || "none"} prevents stockouts.
                </li>
              </ul>
            </div>

            <div className="panel form-stack">
              <strong>Recommended next actions</strong>
              <p className="muted" style={{ fontSize: 12.5 }}>
                Launch a targeted bundle discount or adjust slow-moving accessory inventory directly
                from the AI Workspace.
              </p>
              <div className="button-row">
                <Link
                  className="btn primary"
                  href="/admin/assistant?prompt=Analyze+this+month%27s+revenue+and+identify+the+best-performing+categories"
                >
                  <Sparkles size={14} /> Open in AI Assistant
                </Link>
                <Link className="btn" href="/admin/promotions">
                  Review promotions
                </Link>
              </div>
            </div>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
