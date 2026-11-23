"use client";
import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/format";

export function Toast({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "error";
}) {
  if (!message) return null;
  return (
    <div role="status" className={cn("toast", tone === "error" && "toast-error")}>
      {tone === "error" ? <CircleAlert size={16} /> : <Check size={16} />}
      <span>{message}</span>
    </div>
  );
}
