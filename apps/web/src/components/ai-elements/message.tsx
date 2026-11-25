"use client";

import { Check, Copy } from "lucide-react";
import { memo, useState, type ComponentProps, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/format";

export type MessageRole = "user" | "assistant" | "system";

export function Message({
  from,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { from: MessageRole }) {
  return (
    <div
      data-role={from}
      className={cn(
        "ai-el-message",
        from === "user" ? "ai-el-message-user" : "ai-el-message-assistant",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("ai-el-message-header", className)}>{children}</div>;
}

export function MessageContent({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("ai-el-message-content", className)} {...props}>
      {children}
    </div>
  );
}

export const MessageResponse = memo(function MessageResponse({
  children,
  isAnimating = false,
  className,
}: {
  children: string;
  isAnimating?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("ai-el-prose", className)}>
      <Streamdown isAnimating={isAnimating} controls={{ table: true, code: true }}>
        {children}
      </Streamdown>
    </div>
  );
});

export function MessageActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("ai-el-message-actions", className)}>{children}</div>;
}

export function MessageCopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ai-el-action-btn"
      aria-label="Copy response"
      title="Copy markdown"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard unavailable
        }
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
