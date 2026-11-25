"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/data-display";
import { ApiError } from "@/lib/api-client";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { AssistantChatPanel } from "./AssistantChatPanel";
import { useAdminAssistantStore } from "./assistant-ui-store";

export function Workspace({ notify }: { notify?: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const sharedThreadId = useAdminAssistantStore((s) => s.activeThreadId);
  const setSharedThreadId = useAdminAssistantStore((s) => s.setActiveThreadId);

  const [initialPrompt] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("prompt") || "";
    }
    return "";
  });

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      if (new URLSearchParams(window.location.search).get("prompt")) {
        return "new";
      }
    }
    return sharedThreadId || "";
  });

  const [errorBanner, setErrorBanner] = useState("");

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => aiAdminApi.listConversations(),
  });

  const conversations = useMemo(
    () => conversationsQuery.data || [],
    [conversationsQuery.data]
  );

  const activeThreadId =
    selectedId === "new"
      ? undefined
      : conversations.find((c) => c.id === selectedId)?.id ||
        conversations[0]?.id;

  const selectThread = (id: string) => {
    setSelectedId(id);
    setSharedThreadId(id === "new" ? "" : id);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiAdminApi.deleteConversation(id),
    onSuccess: (_, id) => {
      if (activeThreadId === id) {
        selectThread("");
      }
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      notify?.("Conversation deleted");
    },
    onError: (err) => {
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to delete conversation"
      );
    },
  });

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>AI Assistant</h1>
          <p>
            Operate catalog, collections, pricing, promotions, and analytics
            with rich Markdown tables, validated tool traces, and reversible
            Change Plans.
          </p>
        </div>
        <Badge tone="accent">
          <Sparkles size={13} /> Dat Operator · 9Router
        </Badge>
      </div>

      {errorBanner ? (
        <div
          className="panel"
          role="alert"
          style={{
            marginBottom: 12,
            borderColor: "var(--danger)",
            color: "var(--danger)",
          }}
        >
          {errorBanner}
        </div>
      ) : null}

      <div className="ai-workspace admin-table-panel">
        <aside className="ai-threads" aria-label="Conversations">
          <Button
            onClick={() => {
              selectThread("new");
              setErrorBanner("");
            }}
          >
            <Plus size={14} /> New conversation
          </Button>
          {conversationsQuery.isLoading ? (
            <Skeleton rows={4} />
          ) : (
            conversations.map((item) => (
              <div className="ai-thread-row" key={item.id}>
                <button
                  type="button"
                  className={
                    "ai-thread-btn " +
                    (activeThreadId === item.id ? "active" : "")
                  }
                  onClick={() => selectThread(item.id)}
                >
                  <MessageSquare size={14} />
                  <span>{item.title}</span>
                </button>
                <IconButton
                  label={`Delete thread ${item.title}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            ))
          )}
        </aside>

        <div className="ai-workarea">
          <AssistantChatPanel
            mode="full"
            conversations={conversations}
            selectedId={selectedId}
            onSelectThread={selectThread}
            initialPrompt={initialPrompt}
            notify={notify}
          />
        </div>
      </div>
    </>
  );
}
