"use client";
import type { ComponentProps } from "react";
import { cn } from "@/lib/format";

export type ButtonVariant = "default" | "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className = "",
  variant,
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "primary"
      : variant === "destructive"
        ? "destructive"
        : variant === "ghost"
          ? "ghost"
          : variant === "secondary"
            ? "secondary"
            : "";
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  return (
    <button
      type={type}
      className={cn("btn", variantClass, sizeClass, className)}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <Button
      aria-label={label}
      title={label}
      className={cn("icon-btn", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
