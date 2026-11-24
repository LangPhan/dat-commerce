"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ChangeDiffTable } from "@/components/shared/ai-components";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { formatDateTime } from "@/lib/format";
import type { AiChangePlanDto } from "@/types/api-cms-ai";

const ACTIVITY_STATUS_ITEMS = [
  { value: "", label: "All statuses" },
  { value: "PENDING_APPROVAL", label: "PENDING_APPROVAL" },
  { value: "APPLIED", label: "APPLIED" },
  { value: "REJECTED", label: "REJECTED" },
  { value: "EXPIRED", label: "EXPIRED" },
  { value: "FAILED", label: "FAILED" },
  { value: "ROLLED_BACK", label: "ROLLED_BACK" },
];

export function ActivityTable({
  automation,
  notify,
}: {
  automation: boolean;
  notify?: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AiChangePlanDto | null>(null);
  const [actionError, setActionError] = useState("");

  const activityQuery = useQuery({
    queryKey: ["ai-activity"],
    queryFn: () => aiAdminApi.getActivity(),
  });

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
    queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    queryClient.invalidateQueries({ queryKey: ["admin-product-types"] });
    queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
    queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
  }

  const applyMutation = useMutation({
    mutationFn: (planId: string) =>
      aiAdminApi.applyChangePlan(planId, `act-${planId}-${Date.now()}`),
    onSuccess: (updated) => {
      setSelected(updated);
      setActionError("");
      refreshAll();
      notify?.(`Applied change plan (${updated.planType})`);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to apply change plan"
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (planId: string) =>
      aiAdminApi.rejectChangePlan(planId, "Rejected from AI activity drawer"),
    onSuccess: (updated) => {
      setSelected(updated);
      setActionError("");
      refreshAll();
      notify?.("Change plan rejected");
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to reject change plan"
      );
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (planId: string) => aiAdminApi.rollbackChangePlan(planId),
    onSuccess: (updated) => {
      setSelected(updated);
      setActionError("");
      refreshAll();
      notify?.("Change plan rolled back");
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to rollback change plan"
      );
    },
  });

  const rows = activityQuery.data?.changePlans || [];
  const visible = rows.filter((item) => {
    if (status && item.status !== status) return false;
    const needle = query.trim().toLowerCase();
    if (
      needle &&
      !item.requestSummary.toLowerCase().includes(needle) &&
      !item.planType.toLowerCase().includes(needle)
    ) {
      return false;
    }
    return true;
  });

  const columns: DataTableColumn<AiChangePlanDto>[] = [
    {
      id: "operation",
      header: "Operation",
      cell: (item) => (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setActionError("");
            setSelected(item);
          }}
        >
          {item.requestSummary}
        </button>
      ),
    },
    {
      id: "planType",
      header: "Plan Type",
      cell: (item) => <Badge>{item.planType}</Badge>,
    },
    {
      id: "risk",
      header: "Risk",
      cell: (item) => <span className="muted">{item.riskLevel}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      id: "records",
      header: "Records",
      cell: (item) => item.preview?.length || 0,
    },
    {
      id: "created",
      header: "Created",
      cell: (item) => <span className="muted">{formatDateTime(item.createdAt)}</span>,
    },
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{automation ? "Automation history" : "AI activity"}</h1>
          <p>
            Audit every AI Change Plan, approval decision, execution status, and
            rollback.
          </p>
        </div>
        <Link className="btn primary" href="/admin/assistant">
          Open AI Assistant <ArrowUpRight size={14} />
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={visible}
        getRowKey={(item) => item.id}
        isLoading={activityQuery.isLoading}
        page={page}
        onPageChange={setPage}
        pageSize={10}
        searchValue={query}
        onSearchChange={(next) => {
          setQuery(next);
          setPage(1);
        }}
        searchPlaceholder="Filter activity log…"
        searchAriaLabel="Search AI operations"
        toolbar={
          <Select
            items={ACTIVITY_STATUS_ITEMS}
            value={status}
            onValueChange={(next) => {
              setStatus(next ?? "");
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Execution status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value || "all"} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        emptyState={
          <Empty
            title="No matching activity"
            text="Change Plans proposed in the AI Assistant or Visual Editor will appear here."
          />
        }
      />

      {selected ? (
        <Drawer
          title={selected.requestSummary}
          description={`${selected.status} · ${formatDateTime(selected.createdAt)}`}
          close={() => setSelected(null)}
        >
          <div className="form-stack">
            <div className="button-row">
              <StatusBadge status={selected.status} />
              <Badge tone="accent">{selected.planType}</Badge>
              <Badge>{selected.riskLevel} risk</Badge>
              <Badge>{selected.preview?.length || 0} records</Badge>
            </div>

            {actionError ? (
              <p role="alert" className="danger" style={{ fontSize: 13 }}>
                {actionError}
              </p>
            ) : null}

            {selected.errorMessage ? (
              <p role="alert" className="danger" style={{ fontSize: 13 }}>
                {selected.errorMessage}
              </p>
            ) : null}

            {selected.status === "PENDING_APPROVAL" ? (
              <div className="button-row">
                <Button
                  variant="primary"
                  disabled={applyMutation.isPending || rejectMutation.isPending}
                  onClick={() => applyMutation.mutate(selected.id)}
                >
                  {applyMutation.isPending ? "Applying…" : "Approve & apply"}
                </Button>
                <Button
                  disabled={applyMutation.isPending || rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(selected.id)}
                >
                  Reject
                </Button>
              </div>
            ) : null}

            {selected.status === "APPLIED" && selected.reversible ? (
              <div className="button-row">
                <Button
                  disabled={rollbackMutation.isPending}
                  onClick={() => rollbackMutation.mutate(selected.id)}
                >
                  <RotateCcw size={14} />{" "}
                  {rollbackMutation.isPending
                    ? "Rolling back…"
                    : "Rollback changes"}
                </Button>
              </div>
            ) : null}

            <div>
              <h3 style={{ marginBottom: 8 }}>Record diff</h3>
              {selected.preview?.length ? (
                <ChangeDiffTable changes={selected.preview} />
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>
                  No preview diff rows recorded for this plan.
                </p>
              )}
            </div>

            {selected.affectedResources?.length ? (
              <div>
                <h3 style={{ marginBottom: 8 }}>Affected resources</h3>
                <pre
                  style={{
                    fontSize: 11,
                    overflow: "auto",
                    padding: 10,
                    borderRadius: 8,
                    background: "var(--surface)",
                  }}
                >
                  {JSON.stringify(selected.affectedResources, null, 2)}
                </pre>
              </div>
            ) : null}

            <div className="muted" style={{ fontSize: 12 }}>
              <div>Expires: {formatDateTime(selected.expiresAt)}</div>
              {selected.appliedAt ? (
                <div>Applied: {formatDateTime(selected.appliedAt)}</div>
              ) : null}
              {selected.rolledBackAt ? (
                <div>Rolled back: {formatDateTime(selected.rolledBackAt)}</div>
              ) : null}
            </div>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
