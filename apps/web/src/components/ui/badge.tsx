"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export type BadgeTone = "neutral" | "accent" | "green" | "amber" | "red";

const TONE_CLASS_MAP: Record<BadgeTone, string> = {
  neutral: "",
  accent: "violet",
  green: "green",
  amber: "amber",
  red: "red",
};

const STATUS_TONE_MAP: Record<string, BadgeTone> = {
  paid: "green",
  captured: "green",
  delivered: "green",
  fulfilled: "green",
  active: "green",
  completed: "green",
  published: "green",
  "in stock": "green",
  applied: "green",
  ready: "green",
  success: "green",
  pending: "amber",
  pending_approval: "amber",
  processing: "amber",
  shipped: "amber",
  "low stock": "amber",
  draft: "amber",
  paused: "amber",
  in_progress: "amber",
  failed: "red",
  refunded: "red",
  canceled: "red",
  cancelled: "red",
  "out of stock": "red",
  "unsaved changes": "red",
  rejected: "red",
  expired: "red",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("badge", TONE_CLASS_MAP[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = STATUS_TONE_MAP[status.toLowerCase()] ?? "neutral";

  return (
    <Badge tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {status}
    </Badge>
  );
}
