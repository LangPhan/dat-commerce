"use client";

import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button, type ButtonVariant } from "./button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from "./dialog";

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  headerExtra?: ReactNode;
  size?: DialogSize;
  showCloseButton?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: ReactNode;
  cancelLabel?: ReactNode;
  submitVariant?: ButtonVariant;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  footer?: ReactNode;
  noValidate?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  size = "md",
  showCloseButton = true,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  submitVariant = "primary",
  isSubmitting = false,
  submitDisabled = false,
  error,
  footer,
  noValidate,
  className,
  bodyClassName,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size} showCloseButton={showCloseButton} className={className}>
        <DialogHeader>
          <div className="ui-dialog-header-main">
            <DialogTitle>{title}</DialogTitle>
            {headerExtra}
          </div>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form className="ui-dialog-form" onSubmit={onSubmit} noValidate={noValidate}>
          <DialogBody className={bodyClassName}>
            {children}
            <FormDialogError error={error} />
          </DialogBody>
          <DialogFooter>
            {footer ?? (
              <>
                <DialogClose render={<Button type="button">{cancelLabel}</Button>} />
                <Button
                  variant={submitVariant}
                  type="submit"
                  disabled={isSubmitting || submitDisabled}
                >
                  {submitLabel}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormDialogSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel form-stack ui-form-dialog-section", className)}>
      {title || actions ? (
        <div className="section-title ui-form-dialog-section-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? (
              <p className="muted" style={{ fontSize: 12 }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FormDialogRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("form-pair", className)}>{children}</div>;
}

export function FormDialogField({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("ui-field", className)}>
      <label className="ui-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <span className="ui-field-hint">{hint}</span> : null}
      {error ? <span className="ui-field-error">{error}</span> : null}
    </div>
  );
}

export function FormDialogError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p className="danger ui-form-dialog-error" role="alert">
      {error}
    </p>
  );
}
