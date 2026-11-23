"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export type BadgeTone = "neutral" | "accent" | "green" | "amber" | "red";

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "accent"
      ? "violet"
      : tone === "green"
        ? "green"
        : tone === "amber"
          ? "amber"
          : tone === "red"
            ? "red"
            : "";
  return <span className={cn("badge", toneClass, className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const tone: BadgeTone =
    lower === "paid" ||
    lower === "captured" ||
    lower === "delivered" ||
    lower === "fulfilled" ||
    lower === "active" ||
    lower === "completed" ||
    lower === "published" ||
    lower === "in stock" ||
    lower === "applied" ||
    lower === "ready" ||
    lower === "success"
      ? "green"
      : lower === "pending" ||
          lower === "pending_approval" ||
          lower === "processing" ||
          lower === "shipped" ||
          lower === "low stock" ||
          lower === "draft" ||
          lower === "paused" ||
          lower === "in_progress"
        ? "amber"
        : lower === "failed" ||
            lower === "refunded" ||
            lower === "canceled" ||
            lower === "cancelled" ||
            lower === "out of stock" ||
            lower === "unsaved changes" ||
            lower === "rejected" ||
            lower === "expired"
          ? "red"
          : "neutral";

  return (
    <Badge tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {status}
    </Badge>
  );
}
