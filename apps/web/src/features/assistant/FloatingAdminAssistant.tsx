"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ExternalLink,
  History,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@base-ui/react";

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

  const hiddenOnView = view === "assistant" || view === "editor";

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

  return (
    <div className="admin-ai-float-root" data-testid="floating-admin-ai">
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

              <Button className="icon-btn flex justify-center items-center rounded-sm">
                <Link
                  href="/admin/assistant"
                  aria-label="Open full AI Assistant workspace"
                  title="Open full AI Assistant page"
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink size={14} />
                </Link>
              </Button>

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
          type="button"
          className="admin-ai-fab"
          aria-label="Open AI Assistant"
          title="Open Dat AI Assistant (Alt+A)"
          onClick={() => setOpen(true)}
        >
          <span className="admin-ai-fab-icon">
            <Sparkles size={16} />
          </span>
          <span>AI Assistant</span>
        </button>
      )}
    </div>
  );
}
