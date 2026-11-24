"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { AuditLogRecord, PageResponse } from "@/types/auth";

const ACTION_FILTER_ITEMS = [
  { value: "", label: "All actions" },
  { value: "AUTH_LOGIN", label: "AUTH_LOGIN" },
  { value: "AUTH_LOGOUT", label: "AUTH_LOGOUT" },
  { value: "AUTH_REFRESH_REUSE_DETECTED", label: "AUTH_REFRESH_REUSE_DETECTED" },
  { value: "ADMIN_USER_CREATED", label: "ADMIN_USER_CREATED" },
  { value: "ADMIN_USER_UPDATED", label: "ADMIN_USER_UPDATED" },
  { value: "STORE_UPDATED", label: "STORE_UPDATED" },
];

const RESOURCE_FILTER_ITEMS = [
  { value: "", label: "All resources" },
  { value: "SESSION", label: "SESSION" },
  { value: "ADMIN_USER", label: "ADMIN_USER" },
  { value: "STORE", label: "STORE" },
];

export function AuditLogsView() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");

  const query = useQuery({
    queryKey: ["audit-logs", page, actionFilter, resourceFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        size: "20",
      });
      if (actionFilter) params.set("action", actionFilter);
      if (resourceFilter) params.set("resourceType", resourceFilter);
      return apiFetch<PageResponse<AuditLogRecord>>(
        `/api/v1/admin/audit-logs?${params.toString()}`
      );
    },
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<AuditLogRecord>[] = [
    {
      id: "time",
      header: "Time",
      cell: (row) => <span className="muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      id: "actor",
      header: "Actor",
      cellClassName: "audit-actor",
      cell: (row) => row.actorEmail || "system",
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => <Badge tone="accent">{row.action}</Badge>,
    },
    {
      id: "resource",
      header: "Resource",
      cell: (row) => <code>{row.resourceType}</code>,
    },
    {
      id: "requestId",
      header: "Request ID",
      cell: (row) => <code>{row.requestId ? row.requestId.slice(0, 8) : "—"}</code>,
    },
    {
      id: "summary",
      header: "Summary",
      cellClassName: "muted audit-summary",
      cell: (row) =>
        row.afterJson
          ? JSON.stringify(row.afterJson).slice(0, 72)
          : Object.keys(row.metadataJson || {}).length
            ? JSON.stringify(row.metadataJson).slice(0, 72)
            : "—",
    },
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Audit Logs</h1>
          <p>
            Append-only trail of authentication, user administration, store configuration, and AI mutations.
          </p>
        </div>
      </div>

      {query.isError ? (
        <Empty
          title="Unable to load audit logs"
          text={
            query.error instanceof ApiError
              ? query.error.message
              : "Check your permissions and try again."
          }
          icon={<History size={18} />}
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items || []}
          getRowKey={(row) => row.id}
          isLoading={query.isLoading}
          isFetching={query.isPlaceholderData}
          paginateClientSide={false}
          page={page + 1}
          pageSize={query.data?.size || 20}
          totalItems={query.data?.totalElements || 0}
          onPageChange={(next) => setPage(next - 1)}
          toolbar={
            <>
              <Select
                items={ACTION_FILTER_ITEMS}
                value={actionFilter}
                onValueChange={(next) => {
                  setActionFilter(next ?? "");
                  setPage(0);
                }}
              >
                <SelectTrigger aria-label="Filter by action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_FILTER_ITEMS.map((item) => (
                    <SelectItem key={item.value || "all"} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={RESOURCE_FILTER_ITEMS}
                value={resourceFilter}
                onValueChange={(next) => {
                  setResourceFilter(next ?? "");
                  setPage(0);
                }}
              >
                <SelectTrigger aria-label="Filter by resource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_FILTER_ITEMS.map((item) => (
                    <SelectItem key={item.value || "all"} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <Empty
              title="No audit entries match"
              text="Try clearing the action or resource filters."
              icon={<History size={18} />}
            />
          }
        />
      )}
    </>
  );
}
