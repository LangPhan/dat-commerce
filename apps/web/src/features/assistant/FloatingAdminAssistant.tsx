"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ExternalLink,
  GripVertical,
  History,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/features/auth/auth-context";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { cn } from "@/lib/format";
import { AssistantChatPanel } from "./AssistantChatPanel";
import { useAdminAssistantStore } from "./assistant-ui-store";

const FAB_POS_STORAGE_KEY = "dat-commerce.admin-ai-fab-pos.v1";
const FAB_EDGE_PADDING = 12;
const DRAG_THRESHOLD_PX = 5;

type RelativeFabPos = {
  /** Offset from `.admin-content` left edge */
  x: number;
  /** Offset from `.admin-content` top edge */
  y: number;
};

type ViewportFabPos = {
  left: number;
  top: number;
};

function getWorkspaceBounds() {
  const bodyEl = document.querySelector<HTMLElement>(".admin-body");
  if (bodyEl) {
    const bodyRect = bodyEl.getBoundingClientRect();
    if (bodyRect.width > 0 && bodyRect.height > 0) {
      const topEl = document.querySelector<HTMLElement>(".admin-top");
      const topRect = topEl?.getBoundingClientRect();
      const top =
        topRect && topRect.height > 0
          ? Math.max(bodyRect.top, topRect.bottom)
          : bodyRect.top;
      return {
        left: bodyRect.left,
        top,
        right: bodyRect.right,
        bottom: bodyRect.bottom,
        width: bodyRect.right - bodyRect.left,
        height: Math.max(0, bodyRect.bottom - top),
      };
    }
  }

  const contentEl = document.querySelector<HTMLElement>(".admin-content");
  if (contentEl) {
    const rect = contentEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return rect;
    }
  }

  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function readStoredFabPos(): RelativeFabPos | null {
  try {
    const raw = window.localStorage.getItem(FAB_POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RelativeFabPos>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number" && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeStoredFabPos(pos: RelativeFabPos) {
  try {
    window.localStorage.setItem(FAB_POS_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Ignore storage write errors
  }
}

export function FloatingAdminAssistant({
  view,
  pageTitle,
  notify,
}: {
  view: string;
  pageTitle: string;
  notify?: (msg: string) => void;
}) {
  const { hasPermission } = useAuth();
  const canUseAi = hasPermission("ai:use");

  const open = useAdminAssistantStore((s) => s.floatingOpen);
  const expanded = useAdminAssistantStore((s) => s.floatingExpanded);
  const activeThreadId = useAdminAssistantStore((s) => s.activeThreadId);
  const setOpen = useAdminAssistantStore((s) => s.setFloatingOpen);
  const toggleOpen = useAdminAssistantStore((s) => s.toggleFloatingOpen);
  const setExpanded = useAdminAssistantStore((s) => s.setFloatingExpanded);
  const setActiveThreadId = useAdminAssistantStore((s) => s.setActiveThreadId);

  const [threadsPopoverOpen, setThreadsPopoverOpen] = useState(false);
  const [fabPos, setFabPos] = useState<ViewportFabPos | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fabRef = useRef<HTMLButtonElement | null>(null);
  const relPosRef = useRef<RelativeFabPos | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originLeft: number;
    originTop: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const hiddenOnView = view === "assistant" || view === "editor";

  const clampToWorkspace = useCallback(
    (targetLeft: number, targetTop: number): { viewport: ViewportFabPos; relative: RelativeFabPos } => {
      const bounds = getWorkspaceBounds();
      const fabRect = fabRef.current?.getBoundingClientRect();
      const fabW = fabRect && fabRect.width > 0 ? fabRect.width : 156;
      const fabH = fabRect && fabRect.height > 0 ? fabRect.height : 44;

      const minLeft = bounds.left + FAB_EDGE_PADDING;
      const maxLeft = Math.max(minLeft, bounds.right - fabW - FAB_EDGE_PADDING);
      const minTop = bounds.top + FAB_EDGE_PADDING;
      const maxTop = Math.max(minTop, bounds.bottom - fabH - FAB_EDGE_PADDING);

      const left = Math.round(Math.min(Math.max(targetLeft, minLeft), maxLeft));
      const top = Math.round(Math.min(Math.max(targetTop, minTop), maxTop));

      return {
        viewport: { left, top },
        relative: {
          x: Math.round(left - bounds.left),
          y: Math.round(top - bounds.top),
        },
      };
    },
    [],
  );

  const syncFabFromRelative = useCallback(() => {
    const rel = relPosRef.current;
    if (!rel) return;
    const bounds = getWorkspaceBounds();
    const clamped = clampToWorkspace(bounds.left + rel.x, bounds.top + rel.y);
    setFabPos(clamped.viewport);
  }, [clampToWorkspace]);

  useEffect(() => {
    if (!canUseAi || hiddenOnView || open) return;

    if (!relPosRef.current) {
      const stored = readStoredFabPos();
      if (stored) {
        relPosRef.current = stored;
      }
    }

    syncFabFromRelative();

    const onResize = () => syncFabFromRelative();
    window.addEventListener("resize", onResize);

    const bodyEl = document.querySelector<HTMLElement>(".admin-body");
    const topEl = document.querySelector<HTMLElement>(".admin-top");
    const contentEl = document.querySelector<HTMLElement>(".admin-content");
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => syncFabFromRelative());
      if (bodyEl) observer.observe(bodyEl);
      if (topEl) observer.observe(topEl);
      if (!bodyEl && contentEl) observer.observe(contentEl);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [canUseAi, hiddenOnView, open, syncFabFromRelative]);

  const handleFabPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const fabEl = fabRef.current;
    if (!fabEl) return;

    const rect = fabEl.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };

    try {
      fabEl.setPointerCapture(e.pointerId);
    } catch {
      // jsdom or unsupported pointer capture
    }
  };

  const handleFabPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;

    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      setIsDragging(true);
    }

    const clamped = clampToWorkspace(drag.originLeft + dx, drag.originTop + dy);
    relPosRef.current = clamped.relative;
    setFabPos(clamped.viewport);
  };

  const finishFabDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const wasMoved = drag.moved;
    dragStateRef.current = null;
    setIsDragging(false);

    try {
      if (fabRef.current?.hasPointerCapture?.(e.pointerId)) {
        fabRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore capture release errors
    }

    if (wasMoved) {
      suppressClickRef.current = true;
      if (relPosRef.current) {
        writeStoredFabPos(relPosRef.current);
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  useEffect(() => {
    if (!canUseAi || hiddenOnView) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        toggleOpen();
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUseAi, hiddenOnView, open, setOpen, toggleOpen]);

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => aiAdminApi.listConversations(),
    enabled: canUseAi && !hiddenOnView && open,
    staleTime: 30_000,
  });

  const conversations = useMemo(
    () => conversationsQuery.data || [],
    [conversationsQuery.data],
  );

  if (!canUseAi || hiddenOnView) {
    return null;
  }

  const rootStyle =
    !open && fabPos
      ? {
          left: `${fabPos.left}px`,
          top: `${fabPos.top}px`,
          right: "auto",
          bottom: "auto",
        }
      : undefined;

  return (
    <div
      className="admin-ai-float-root"
      style={rootStyle}
      data-testid="floating-admin-ai"
    >
      {open ? (
        <section
          className={cn("admin-ai-drawer", expanded && "is-expanded")}
          aria-label="Floating AI Assistant"
        >
          <header className="admin-ai-drawer-head">
            <div className="admin-ai-drawer-title">
              <span className="admin-ai-drawer-icon">
                <Sparkles size={14} />
              </span>
              <div>
                <strong>Dat AI Assistant</strong>
                <div className="admin-ai-drawer-sub">
                  <Badge tone="neutral">{pageTitle || "Dashboard"}</Badge>
                </div>
              </div>
            </div>

            <div className="admin-ai-drawer-actions">
              <Popover
                open={threadsPopoverOpen}
                onOpenChange={setThreadsPopoverOpen}
              >
                <PopoverTrigger
                  type="button"
                  aria-label="Switch conversation"
                  title="Conversation history"
                  className="icon-btn flex justify-center items-center rounded-sm"
                >
                  <History size={14} />
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-[260px]">
                  <PopoverHeader>
                    <PopoverTitle>Conversations</PopoverTitle>
                    <PopoverDescription>
                      Resume a previous session or start fresh.
                    </PopoverDescription>
                  </PopoverHeader>
                  <div className="admin-ai-thread-menu">
                    <button
                      type="button"
                      className="admin-ai-thread-menu-item is-new"
                      onClick={() => {
                        setActiveThreadId("new");
                        setThreadsPopoverOpen(false);
                      }}
                    >
                      <Plus size={13} />
                      <span>New conversation</span>
                    </button>
                    {conversations.slice(0, 12).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          "admin-ai-thread-menu-item",
                          activeThreadId === c.id && "active",
                        )}
                        onClick={() => {
                          setActiveThreadId(c.id);
                          setThreadsPopoverOpen(false);
                        }}
                      >
                        <MessageSquare size={12} />
                        <span>{c.title}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <IconButton
                label="New conversation"
                title="Start new conversation"
                onClick={() => setActiveThreadId("new")}
              >
                <Plus size={14} />
              </IconButton>

              <IconButton
                label={expanded ? "Compact panel" : "Expand panel"}
                title={
                  expanded ? "Compact panel" : "Expand panel for wide tables"
                }
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </IconButton>

              <Link
                href="/admin/assistant"
                aria-label="Open full AI Assistant workspace"
                title="Open full AI Assistant page"
                className="icon-btn flex justify-center items-center rounded-sm"
                onClick={() => setOpen(false)}
              >
                <ExternalLink size={14} />
              </Link>

              <IconButton
                label="Close floating AI Assistant"
                title="Close (Esc)"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </IconButton>
            </div>
          </header>

          <div className="admin-ai-drawer-body">
            <AssistantChatPanel
              mode="drawer"
              conversations={conversations}
              selectedId={activeThreadId}
              onSelectThread={setActiveThreadId}
              contextHint={{ view, title: pageTitle }}
              notify={notify}
            />
          </div>
        </section>
      ) : (
        <button
          ref={fabRef}
          type="button"
          className={cn("admin-ai-fab", isDragging && "is-dragging")}
          aria-label="Open AI Assistant"
          title="Open Dat AI Assistant (Alt+A) · Drag to reposition"
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={finishFabDrag}
          onPointerCancel={finishFabDrag}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            setOpen(true);
          }}
        >
          <span className="admin-ai-fab-icon">
            <Sparkles size={16} />
          </span>
          <span>AI Assistant</span>
          <GripVertical size={13} className="admin-ai-fab-grip" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
