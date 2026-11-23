"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button, IconButton } from "./button";

function isInsideSelectPopup(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-slot="select-content"], [data-slot="select-positioner"]'))
  );
}

export function Modal({
  title,
  description,
  close,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={cn("dialog", wide && "dialog-wide")}
          onPointerDownOutside={(event) => {
            if (isInsideSelectPopup(event.target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isInsideSelectPopup(event.target)) {
              event.preventDefault();
            }
          }}
        >
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X size={16} />
              </IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="drawer"
          onPointerDownOutside={(event) => {
            if (isInsideSelectPopup(event.target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isInsideSelectPopup(event.target)) {
              event.preventDefault();
            }
          }}
        >
          <div className="drawer-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description className="muted">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close drawer">
                <X size={16} />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="drawer-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <Modal title={title} description={description} close={onCancel}>
      {summary ? <div className="change-summary">{summary}</div> : null}
      <div className="modal-actions">
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button
          variant={destructive ? "destructive" : "primary"}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
