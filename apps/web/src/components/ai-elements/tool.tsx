"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/format";

export type ToolStatus = "running" | "completed" | "failed";

export function Tool({
  name,
  status,
  durationMs,
  defaultOpen = false,
  children,
  className,
}: {
  name: string;
  status: ToolStatus;
  durationMs?: number;
  defaultOpen?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = name.replace(/\./g, " · ");

  return (
    <div className={cn("ai-el-tool", `is-${status}`, className)}>
      <button
        type="button"
        className="ai-el-tool-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ai-el-tool-left">
          {status === "running" ? (
            <LoaderCircle size={13} className="spin" />
          ) : status === "failed" ? (
            <XCircle size={13} />
          ) : (
            <CheckCircle2 size={13} />
          )}
          <Wrench size={12} className="muted" />
          <strong>{label}</strong>
        </span>
        <span className="ai-el-tool-right">
          {durationMs && durationMs > 0 ? (
            <span className="muted">{durationMs}ms</span>
          ) : null}
          <Badge
            tone={
              status === "completed"
                ? "green"
                : status === "failed"
                  ? "red"
                  : "accent"
            }
          >
            {status === "running"
              ? "Running"
              : status === "failed"
                ? "Error"
                : "Done"}
          </Badge>
          {children ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
        </span>
      </button>
      {open && children ? <div className="ai-el-tool-body">{children}</div> : null}
    </div>
  );
}

export function ToolSection({
  title,
  data,
  error,
}: {
  title: string;
  data?: unknown;
  error?: string | null;
}) {
  if (!data && !error) return null;
  return (
    <div className="ai-el-tool-sec">
      <span className="ai-el-tool-sec-label">{title}</span>
      {error ? (
        <p className="ai-el-tool-err">{error}</p>
      ) : (
        <pre className="ai-el-tool-pre">
          {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
