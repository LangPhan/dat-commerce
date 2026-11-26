"use client";

import { ArrowUp, File as FileIcon, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/format";

const SUPPORTS_FIELD_SIZING =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("field-sizing", "content");

export function PromptInput({
  className,
  children,
  onSubmit,
  ...props
}: ComponentProps<"form">) {
  return (
    <form
      className={cn("ai-el-prompt-form", className)}
      onSubmit={onSubmit}
      {...props}
    >
      {children}
    </form>
  );
}

export function PromptInputAttachment({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="ai-el-prompt-chip">
      <FileIcon size={12} />
      <span>{label}</span>
      <button type="button" aria-label="Remove attachment" onClick={onRemove}>
        <X size={11} />
      </button>
    </span>
  );
}

export function PromptInputTextarea({
  value,
  onChange,
  onSubmitEnter,
  placeholder,
  disabled,
  ariaLabel = "Message AI Assistant",
  maxHeight = 140,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmitEnter: () => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (SUPPORTS_FIELD_SIZING) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(maxHeight, Math.max(40, el.scrollHeight))}px`;
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel}
      className="ai-el-prompt-textarea"
      style={
        SUPPORTS_FIELD_SIZING
          ? {
              fieldSizing: "content",
              minHeight: 40,
              maxHeight,
            }
          : undefined
      }
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmitEnter();
        }
      }}
    />
  );
}

export function PromptInputToolbar({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="ai-el-prompt-toolbar">
      <div className="ai-el-prompt-toolbar-left">{left}</div>
      <div className="ai-el-prompt-toolbar-right">{right}</div>
    </div>
  );
}

export function PromptInputSubmit({
  busy,
  disabled,
}: {
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      className="ai-el-submit-btn"
      aria-label={busy ? "Streaming response" : "Send message"}
      disabled={disabled || busy}
    >
      {busy ? (
        <span className="spin inline-flex">
          <LoaderCircle size={15} />
        </span>
      ) : (
        <ArrowUp size={15} />
      )}
    </button>
  );
}
