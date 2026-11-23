"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Empty, Pagination, Skeleton } from "@/components/ui/data-display";
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
  });

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

      {query.isLoading ? (
        <Skeleton rows={4} />
      ) : query.isError ? (
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
        <div className="admin-table-panel">
          <div className="table-toolbar">
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
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Request ID</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.items || []).map((row) => (
                  <tr key={row.id}>
                    <td className="muted">{formatDateTime(row.createdAt)}</td>
                    <td className="audit-actor">{row.actorEmail || "system"}</td>
                    <td>
                      <Badge tone="accent">{row.action}</Badge>
                    </td>
                    <td>
                      <code>{row.resourceType}</code>
                    </td>
                    <td>
                      <code>{row.requestId ? row.requestId.slice(0, 8) : "—"}</code>
                    </td>
                    <td className="muted audit-summary">
                      {row.afterJson
                        ? JSON.stringify(row.afterJson).slice(0, 72)
                        : Object.keys(row.metadataJson || {}).length
                          ? JSON.stringify(row.metadataJson).slice(0, 72)
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {query.data ? (
            <div className="table-footer">
              <Pagination
                page={page + 1}
                totalItems={query.data.totalElements}
                pageSize={query.data.size}
                onPageChange={(next) => setPage(next - 1)}
              />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
