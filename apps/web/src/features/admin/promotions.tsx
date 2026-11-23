"use client";
import Link from "next/link";
import { Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/dialog";
import { newId, usd } from "@/lib/format";
import type { Category, Discount, Product } from "@/types/commerce";

export function Promotions({
  items,
  categories,
  products,
  save,
  notify,
  isCampaignView = false,
}: {
  items: Discount[];
  categories: Category[];
  products: Product[];
  save: (items: Discount[]) => void;
  notify: (message: string) => void;
  isCampaignView?: boolean;
}) {
  const [edit, setEdit] = useState<Discount | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [aiDrawer, setAiDrawer] = useState(false);
  const [error, setError] = useState("");

  const update = (change: Partial<Discount>) =>
    setEdit((current) => (current ? { ...current, ...change } : null));

  const slowProducts = [...products]
    .sort((a, b) => (a.salesCount || 0) - (b.salesCount || 0))
    .slice(0, 3);

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{isCampaignView ? "Promotions" : "Discounts"}</h1>
          <p>
            Configure percentage or fixed-amount codes, eligibility rules, and redemption limits.
          </p>
        </div>
        <div className="button-row">
          <Button onClick={() => setAiDrawer(true)}>
            <Sparkles size={14} /> Suggest promotion
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setError("");
              setConfirmSave(false);
              const today = new Date().toISOString().slice(0, 10);
              const nextWeek = new Date(Date.now() + 7 * 86400000)
                .toISOString()
                .slice(0, 10);
              setEdit({
                id: "",
                name: "",
                code: "",
                type: "Percentage",
                value: 15,
                eligible: "All products",
                start: today,
                end: nextWeek,
                limit: 100,
                used: 0,
                status: "Draft",
              });
            }}
          >
            <Plus size={15} /> New discount
          </Button>
        </div>
      </div>

      <div className="admin-table-panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Offer</th>
              <th>Code</th>
              <th>Value</th>
              <th>Eligibility</th>
              <th>Schedule</th>
              <th>Redemptions</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setError("");
                      setConfirmSave(false);
                      setEdit(item);
                    }}
                  >
                    {item.name}
                  </button>
                </td>
                <td>
                  <span className="inline-label">
                    <code>{item.code}</code>
                    <IconButton
                      label={`Copy ${item.code}`}
                      onClick={() => {
                        navigator.clipboard?.writeText(item.code).catch(() => {});
                        notify(`Copied ${item.code}`);
                      }}
                    >
                      <Copy size={12} />
                    </IconButton>
                  </span>
                </td>
                <td>
                  <strong>
                    {item.type === "Percentage" ? `${item.value}%` : usd(item.value)}
                  </strong>
                </td>
                <td>{item.eligible}</td>
                <td>
                  <small className="muted">
                    {item.start} → {item.end}
                  </small>
                </td>
                <td>
                  {item.used || 0} / {item.limit}
                </td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>
                  <IconButton
                    label={`Delete ${item.code}`}
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && !confirmSave ? (
        <Modal
          title={edit.id ? `Edit ${edit.code}` : "Create discount"}
          description="Define the offer terms before reviewing the change summary."
          close={() => setEdit(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                items.some(
                  (item) => item.code === edit.code && item.id !== edit.id
                )
              ) {
                setError("This discount code is already in use.");
                return;
              }
              if (edit.end < edit.start) {
                setError("End date must be on or after the start date.");
                return;
              }
              setConfirmSave(true);
            }}
          >
            <div className="form-pair">
              <label>
                Offer name
                <input
                  required
                  value={edit.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label>
                Promo code
                <input
                  required
                  pattern="[A-Z0-9]+"
                  value={edit.code}
                  onChange={(e) =>
                    update({ code: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={edit.type}
                  onChange={(e) =>
                    update({ type: e.target.value as Discount["type"] })
                  }
                >
                  <option>Percentage</option>
                  <option>Fixed amount</option>
                </select>
              </label>
              <label>
                Value
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={edit.type === "Percentage" ? 100 : undefined}
                  required
                  value={edit.value}
                  onChange={(e) => update({ value: Number(e.target.value) })}
                />
              </label>
              <label>
                Starts
                <input
                  type="date"
                  required
                  value={edit.start}
                  onChange={(e) => update({ start: e.target.value })}
                />
              </label>
              <label>
                Ends
                <input
                  type="date"
                  required
                  min={edit.start}
                  value={edit.end}
                  onChange={(e) => update({ end: e.target.value })}
                />
              </label>
              <label>
                Usage limit
                <input
                  type="number"
                  min={1}
                  required
                  value={edit.limit}
                  onChange={(e) => update({ limit: Number(e.target.value) })}
                />
              </label>
              <label>
                Status
                <select
                  value={edit.status}
                  onChange={(e) =>
                    update({ status: e.target.value as Discount["status"] })
                  }
                >
                  <option>Draft</option>
                  <option>Active</option>
                  <option>Paused</option>
                </select>
              </label>
            </div>

            <label>
              Eligible items
              <select
                value={edit.eligible}
                onChange={(e) => update({ eligible: e.target.value })}
              >
                <option>All products</option>
                <optgroup label="Categories">
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Specific products">
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.name}>
                      {prod.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="modal-actions">
              <Button onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Review changes
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {edit && confirmSave ? (
        <ConfirmDialog
          title="Confirm promotion changes"
          description={`Review impact for ${edit.code} before saving.`}
          confirmLabel="Confirm & save"
          summary={
            <div>
              <div>
                Before:{" "}
                {items.find((i) => i.id === edit.id)?.status || "New promotion"}
              </div>
              <strong>
                After: {edit.status} ·{" "}
                {edit.type === "Percentage" ? `${edit.value}%` : usd(edit.value)} off{" "}
                {edit.eligible} ({edit.start} to {edit.end})
              </strong>
            </div>
          }
          onCancel={() => setConfirmSave(false)}
          onConfirm={() => {
            save(
              edit.id
                ? items.map((item) => (item.id === edit.id ? edit : item))
                : [...items, { ...edit, id: newId() }]
            );
            setEdit(null);
            setConfirmSave(false);
            notify("Promotion saved");
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={`Delete discount "${deleteTarget.code}"?`}
          description="Shoppers will no longer be able to redeem this code at checkout."
          confirmLabel="Delete discount"
          destructive
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            save(items.filter((d) => d.id !== deleteTarget.id));
            setDeleteTarget(null);
            notify("Discount deleted");
          }}
        />
      ) : null}

      {aiDrawer ? (
        <Drawer
          title="AI Promotion Suggestions"
          description="Opportunities identified from slower-moving inventory."
          close={() => setAiDrawer(false)}
        >
          <div className="form-stack">
            <div className="panel" style={{ background: "var(--subtle)" }}>
              <strong>Lowest velocity SKUs</strong>
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12.5, display: "grid", gap: 4 }}>
                {slowProducts.map((p) => (
                  <li key={p.id}>
                    {p.name} ({p.category}) — {p.salesCount || 12} sold
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel form-stack">
              <strong>Recommended offer: 15% off Accessories</strong>
              <p className="muted" style={{ fontSize: 12.5 }}>
                Pair a 7-day 15% bundle offer (code <code>PACK15</code>) with Accessories to lift
                attachment rate on Footwear and Laptop orders.
              </p>
              <div className="button-row">
                <Button
                  variant="primary"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const nextWeek = new Date(Date.now() + 7 * 86400000)
                      .toISOString()
                      .slice(0, 10);
                    const code = items.some((i) => i.code === "PACK15")
                      ? "PACK15B"
                      : "PACK15";
                    save([
                      ...items,
                      {
                        id: newId(),
                        name: "Accessories Velocity Boost",
                        code,
                        type: "Percentage",
                        value: 15,
                        eligible: "Accessories",
                        start: today,
                        end: nextWeek,
                        limit: 150,
                        used: 0,
                        status: "Draft",
                      },
                    ]);
                    setAiDrawer(false);
                    notify(`Drafted ${code} in Promotions`);
                  }}
                >
                  <Sparkles size={14} /> Create draft PACK15
                </Button>
                <Link
                  className="btn"
                  href="/admin/assistant?prompt=Suggest+a+promotion+for+products+with+low+sales"
                >
                  Ask AI Assistant
                </Link>
              </div>
            </div>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
