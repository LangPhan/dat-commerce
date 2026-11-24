"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button, IconButton } from "./button";

export type DialogSize = "sm" | "md" | "lg" | "xl";

function isInsideSelectPopup(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-slot="select-content"], [data-slot="select-positioner"]'))
  );
}

export function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  return (
    <DialogPrimitive.Root
      onOpenChange={(open, eventDetails) => {
        if (!open && isInsideSelectPopup(eventDetails?.event?.target ?? null)) {
          eventDetails.cancel();
          return;
        }
        onOpenChange?.(open, eventDetails);
      }}
      {...props}
    />
  );
}

export function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

export function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn("overlay ui-dialog-overlay", className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "md",
  wide = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  size?: DialogSize;
  wide?: boolean;
}) {
  const effectiveSize: DialogSize = wide && size === "md" ? "lg" : size;
  const sizeClass =
    effectiveSize === "sm"
      ? "dialog-sm"
      : effectiveSize === "lg"
        ? "dialog-lg dialog-wide"
        : effectiveSize === "xl"
          ? "dialog-xl"
          : "";

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn("dialog", sizeClass, className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogClose
            render={
              <IconButton label="Close" className="ui-dialog-close">
                <X size={16} />
              </IconButton>
            }
          />
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

export function DialogHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("ui-dialog-header", className)}
      {...props}
    />
  );
}

export function DialogBody({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("ui-dialog-body", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("ui-dialog-footer", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("ui-dialog-title", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("ui-dialog-description muted", className)}
      {...props}
    />
  );
}

export function Modal({
  title,
  description,
  close,
  children,
  wide = false,
  size,
  footer,
}: {
  title: string;
  description?: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
  size?: DialogSize;
  footer?: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent wide={wide} size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export function Drawer({
  title,
  description,
  close,
  children,
}: {
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup data-slot="dialog-content" className="drawer">
          <div className="drawer-header">
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
            <DialogClose
              render={
                <IconButton label="Close drawer">
                  <X size={16} />
                </IconButton>
              }
            />
          </div>
          <div className="drawer-body">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  summary,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  summary?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {summary ? (
          <DialogBody>
            <div className="change-summary">{summary}</div>
          </DialogBody>
        ) : null}
        <DialogFooter>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
