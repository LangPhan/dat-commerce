"use client";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useState } from "react";
import {
  ChangeDiffTable,
  ToolExecutionTimeline,
} from "@/components/shared/ai-components";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/data-display";
import { formatDateTime } from "@/lib/format";
import type { AIActivityEntry } from "@/types/ai";

export function ActivityTable({
  rows,
  automation,
}: {
  rows: AIActivityEntry[];
  automation: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AIActivityEntry | null>(null);

  const visible = rows.filter((item) => {
    if (status && item.status !== status) return false;
    if (query.trim() && !item.title.toLowerCase().includes(query.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{automation ? "Automation history" : "AI activity"}</h1>
          <p>
            Audit every AI-assisted catalog mutation, tool call, and approval decision.
          </p>
        </div>
        <Link className="btn primary" href="/admin/assistant">
          Open AI Assistant <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="admin-table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search AI operations"
              placeholder="Filter activity log…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Execution status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option>Completed</option>
            <option>Canceled</option>
            <option>Failed</option>
          </select>
        </div>

        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Category</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Records</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSelected(item)}
                      >
                        {item.title}
                      </button>
                    </td>
                    <td>
                      <Badge>{item.category || "Operator"}</Badge>
                    </td>
                    <td className="muted">{item.model || "Forma Operator"}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.records}</td>
                    <td className="muted">{formatDateTime(item.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching activity"
            text="Operations you review and execute in the AI Assistant will be logged here."
          />
        )}
      </div>

      {selected ? (
        <Drawer
          title={selected.title}
          description={`${selected.status} · ${formatDateTime(selected.timestamp)}`}
          close={() => setSelected(null)}
        >
          <div className="form-stack">
            <div className="button-row">
              <StatusBadge status={selected.status} />
              {selected.model ? <Badge tone="accent">{selected.model}</Badge> : null}
              <Badge>{selected.records} records</Badge>
            </div>
            {selected.steps?.length ? (
              <div>
                <h3 style={{ marginBottom: 8 }}>Tool execution steps</h3>
                <ToolExecutionTimeline
                  steps={selected.steps}
                  status={selected.status}
                />
              </div>
            ) : null}
            {selected.changes?.length ? (
              <div>
                <h3 style={{ marginBottom: 8 }}>Applied record diff</h3>
                <ChangeDiffTable changes={selected.changes} />
              </div>
            ) : null}
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
