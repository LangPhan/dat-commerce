"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
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
import { adminCatalogApi, adminPromotionApi } from "@/lib/commerce-api";
import { formatDate, usdExact } from "@/lib/format";
import type {
  PromotionDto,
  PromotionScopeType,
  PromotionStatus,
  PromotionType,
} from "@/types/api-commerce";

const PROMOTION_TYPE_ITEMS = [
  { value: "PERCENTAGE", label: "Percentage (%)" },
  { value: "FIXED", label: "Fixed amount ($)" },
  { value: "FREE_SHIPPING", label: "Free shipping" },
];

const PROMOTION_SCOPE_ITEMS = [
  { value: "ORDER", label: "Entire order" },
  { value: "CATEGORY", label: "Specific categories" },
  { value: "PRODUCT", label: "Specific products" },
];

const PROMOTION_STATUS_ITEMS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "PAUSED", label: "PAUSED" },
];

type PromoDraft = {
  id?: string;
  code: string;
  name: string;
  type: PromotionType;
  value: number;
  scopeType: PromotionScopeType;
  startsAtDate: string;
  endsAtDate: string;
  usageLimit: string;
  status: PromotionStatus;
  targetIds: string[];
};

export function Promotions({
  notify,
  isCampaignView = false,
}: {
  notify: (message: string) => void;
  isCampaignView?: boolean;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("promotion:write");

  const [draft, setDraft] = useState<PromoDraft | null>(null);
  const [error, setError] = useState("");

  const promosQuery = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: () => adminPromotionApi.list(),
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminCatalogApi.listCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ["admin-products", "promo-picker"],
    queryFn: () => adminCatalogApi.listProducts(),
  });

  const createMutation = useMutation({
    mutationFn: (form: PromoDraft) =>
      adminPromotionApi.create({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        type: form.type,
        value: Number(form.value),
        scopeType: form.scopeType,
        startsAt: `${form.startsAtDate}T00:00:00Z`,
        endsAt: `${form.endsAtDate}T23:59:59Z`,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        status: form.status,
        targetIds: form.scopeType === "ORDER" ? [] : form.targetIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
      setDraft(null);
      notify("Promotion created");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to create promotion"),
  });

  const updateMutation = useMutation({
    mutationFn: (form: PromoDraft) => {
      if (!form.id) throw new Error("Missing promotion id");
      return adminPromotionApi.update(form.id, {
        name: form.name.trim(),
        type: form.type,
        value: Number(form.value),
        scopeType: form.scopeType,
        startsAt: `${form.startsAtDate}T00:00:00Z`,
        endsAt: `${form.endsAtDate}T23:59:59Z`,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        status: form.status,
        targetIds: form.scopeType === "ORDER" ? [] : form.targetIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
      setDraft(null);
      notify("Promotion updated");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to update promotion"),
  });

  const promos: PromotionDto[] = promosQuery.data || [];
  const categories = categoriesQuery.data || [];
  const products = productsQuery.data || [];

  function openNew() {
    setError("");
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setDraft({
      code: "",
      name: "",
      type: "PERCENTAGE",
      value: 15,
      scopeType: "ORDER",
      startsAtDate: today,
      endsAtDate: nextMonth,
      usageLimit: "100",
      status: "ACTIVE",
      targetIds: [],
    });
  }

  function openEdit(promo: PromotionDto) {
    setError("");
    setDraft({
      id: promo.id,
      code: promo.code,
      name: promo.name,
      type: promo.type as PromotionType,
      value: promo.value,
      scopeType: promo.scopeType as PromotionScopeType,
      startsAtDate: promo.startsAt.slice(0, 10),
      endsAtDate: promo.endsAt.slice(0, 10),
      usageLimit: promo.usageLimit !== null && promo.usageLimit !== undefined ? String(promo.usageLimit) : "",
      status: promo.status as PromotionStatus,
      targetIds: promo.targetIds || [],
    });
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{isCampaignView ? "Promotions" : "Discounts"}</h1>
          <p>
            Configure discount codes, scope rules, redemption limits, and schedules.
          </p>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={openNew}>
            <Plus size={15} /> New discount
          </Button>
        ) : null}
      </div>

      {promosQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : promos.length ? (
        <div className="admin-table-panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Offer</th>
                <th>Code</th>
                <th>Discount</th>
                <th>Scope</th>
                <th>Window</th>
                <th>Usage</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>
                    <code>{p.code}</code>
                  </td>
                  <td>
                    {p.type === "PERCENTAGE"
                      ? `${p.value}% off`
                      : p.type === "FIXED"
                        ? `${usdExact(p.value)} off`
                        : "Free shipping"}
                  </td>
                  <td>{p.scopeType}</td>
                  <td>
                    {formatDate(p.startsAt)} – {formatDate(p.endsAt)}
                  </td>
                  <td>
                    {p.usedCount}
                    {p.usageLimit ? ` / ${p.usageLimit}` : ""}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    {canWrite ? (
                      <IconButton
                        label={`Edit ${p.code}`}
                        onClick={() => openEdit(p)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={<Tag size={22} />}
          title="No promotions configured"
          text="Create a coupon code to enable storefront cart and checkout discounts."
        />
      )}

      {draft ? (
        <Modal
          wide
          title={draft.id ? `Edit ${draft.code}` : "New promotion"}
          description="Server checkout recalculates totals using these validated discount rules."
          close={() => setDraft(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (!draft.name.trim()) {
                setError("Offer name is required.");
                return;
              }
              if (!draft.id && !/^[A-Za-z0-9_-]+$/.test(draft.code.trim())) {
                setError("Promo code must use letters, numbers, hyphens, or underscores.");
                return;
              }
              if (draft.id) {
                updateMutation.mutate(draft);
              } else {
                createMutation.mutate(draft);
              }
            }}
          >
            <div className="form-pair">
              <label>
                Offer name
                <input
                  required
                  value={draft.name}
                  placeholder="Alpine Autumn 15% Off"
                  onChange={(e) =>
                    setDraft((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                />
              </label>
              <label>
                Promo code
                <input
                  required
                  disabled={Boolean(draft.id)}
                  value={draft.code}
                  placeholder="ALPINE15"
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, "") }
                        : null
                    )
                  }
                />
              </label>
            </div>

            <div className="form-pair">
              <label>
                Discount type
                <Select
                  items={PROMOTION_TYPE_ITEMS}
                  value={draft.type}
                  onValueChange={(next) =>
                    next &&
                    setDraft((prev) =>
                      prev ? { ...prev, type: next as PromotionType } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMOTION_TYPE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                Value
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={draft.value}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, value: Number(e.target.value) } : null
                    )
                  }
                />
              </label>
            </div>

            <div className="form-pair">
              <label>
                Scope
                <Select
                  items={PROMOTION_SCOPE_ITEMS}
                  value={draft.scopeType}
                  onValueChange={(next) =>
                    next &&
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            scopeType: next as PromotionScopeType,
                            targetIds: [],
                          }
                        : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMOTION_SCOPE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                Status
                <Select
                  items={PROMOTION_STATUS_ITEMS}
                  value={draft.status}
                  onValueChange={(next) =>
                    next &&
                    setDraft((prev) =>
                      prev ? { ...prev, status: next as PromotionStatus } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMOTION_STATUS_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            {draft.scopeType !== "ORDER" ? (
              <div className="panel" style={{ padding: 12 }}>
                <strong style={{ fontSize: 12.5 }}>
                  Eligible {draft.scopeType === "CATEGORY" ? "categories" : "products"}
                </strong>
                <div
                  className="button-row"
                  style={{ marginTop: 8, flexWrap: "wrap", gap: 10 }}
                >
                  {(draft.scopeType === "CATEGORY" ? categories : products).map((entry) => {
                    const checked = draft.targetIds.includes(entry.id);
                    return (
                      <label className="check-label" key={entry.id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setDraft((prev) => {
                              if (!prev) return null;
                              const nextIds = e.target.checked
                                ? [...prev.targetIds, entry.id]
                                : prev.targetIds.filter((id) => id !== entry.id);
                              return { ...prev, targetIds: nextIds };
                            })
                          }
                        />
                        {entry.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="form-pair">
              <label>
                Starts on
                <input
                  type="date"
                  required
                  value={draft.startsAtDate}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, startsAtDate: e.target.value } : null
                    )
                  }
                />
              </label>
              <label>
                Ends on
                <input
                  type="date"
                  required
                  value={draft.endsAtDate}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, endsAtDate: e.target.value } : null
                    )
                  }
                />
              </label>
              <label>
                Usage limit (optional)
                <input
                  type="number"
                  min="1"
                  value={draft.usageLimit}
                  placeholder="Unlimited"
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, usageLimit: e.target.value } : null
                    )
                  }
                />
              </label>
            </div>

            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="modal-actions">
              <Button onClick={() => setDraft(null)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {draft.id ? "Save promotion" : "Create promotion"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
