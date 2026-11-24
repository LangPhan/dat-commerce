"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { X } from "lucide-react";
import { cn } from "@/lib/format";
import { IconButton } from "./button";

function isInsideSelectPopup(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '[data-slot="select-content"], [data-slot="select-positioner"]'
      )
    )
  );
}

function Popover<Payload = unknown>({
  onOpenChange,
  modal = false,
  ...props
}: PopoverPrimitive.Root.Props<Payload>) {
  return (
    <PopoverPrimitive.Root
      modal={modal}
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

function PopoverTrigger({
  className,
  ...props
}: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={cn(className)}
      {...props}
    />
  );
}

function PopoverPortal(props: PopoverPrimitive.Portal.Props) {
  return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />;
}

function PopoverClose(props: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverHeader({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="popover-header"
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border/80 pb-2.5 mb-2.5",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {showCloseButton ? (
        <PopoverClose
          render={<IconButton label="Close popover" className="h-6 w-6" />}
        >
          <X size={13} />
        </PopoverClose>
      ) : null}
    </div>
  );
}

function PopoverTitle({
  className,
  ...props
}: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-[12.5px] font-semibold leading-tight text-foreground m-0", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-[11.5px] text-muted-foreground mt-0.5 m-0", className)}
      {...props}
    />
  );
}

function PopoverContent({
  className,
  children,
  side = "left",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  collisionPadding = 12,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "side" | "sideOffset" | "align" | "alignOffset" | "collisionPadding"
  >) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Positioner
        data-slot="popover-positioner"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="pointer-events-auto isolate z-60"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "pointer-events-auto relative isolate z-60 w-[290px] max-w-[calc(100vw-24px)] max-h-[min(var(--available-height),520px)] overflow-y-auto origin-(--transform-origin) rounded-[10px] border border-border bg-popover p-3 text-popover-foreground shadow-[var(--shadow-lg)] transition-[transform,scale,opacity] duration-120 outline-none data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
  PopoverPortal,
};
