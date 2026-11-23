"use client";
import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("ui-field", className)}>
      <span className="ui-field-label">{label}</span>
      {children}
      {error ? (
        <span className="ui-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ui-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={cn("ui-input", className)} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("ui-textarea", className)} {...props} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn("ui-select", className)} {...props}>
      {children}
    </select>
  );
}

export function SearchInput({
  className = "",
  label = "Search",
  ...props
}: ComponentProps<"input"> & { label?: string }) {
  return (
    <label className={cn("search-field", className)}>
      <Search size={15} aria-hidden="true" />
      <input aria-label={label} {...props} />
    </label>
  );
}

export function Checkbox({
  label,
  className = "",
  ...props
}: ComponentProps<"input"> & { label?: string }) {
  return (
    <label className={cn("check-label", className)}>
      <input type="checkbox" {...props} />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn("ui-switch", checked && "checked")}
    >
      <span className="ui-switch-track">
        <span className="ui-switch-thumb" />
      </span>
      {label ? <span className="ui-switch-label">{label}</span> : null}
    </button>
  );
}
