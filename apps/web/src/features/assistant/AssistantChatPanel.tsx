"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowUpRight,
  LoaderCircle,
  Paperclip,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageActions,
  MessageContent,
  MessageCopyAction,
  MessageHeader,
  MessageResponse,
  PromptInput,
  PromptInputAttachment,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  Suggestions,
  Tool,
  ToolSection,
} from "@/components/ai-elements";
import {
  AIAvatarBadge,
  ChangeDiffTable,
  ModelSelector,
} from "@/components/shared/ai-components";
import { StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/data-display";
import { Modal } from "@/components/ui/dialog";
import { useAiModels } from "@/hooks/use-ai-models";
import { ApiError } from "@/lib/api-client";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { cn, formatDateTime, newId } from "@/lib/format";
import { AI_MODELS, type AIModelId } from "@/types/ai";
import type {
  AiChangePlanDto,
  AiConversationSummaryDto,
  AiToolCallDto,
} from "@/types/api-cms-ai";
import { useAdminAssistantStore } from "./assistant-ui-store";

export type AssistantContextHint = {
  view: string;
  title: string;
};

type StreamingToolRow = {
  id: string;
  toolName: string;
  status: "running" | "completed" | "failed";
  durationMs: number;
  arguments?: Record<string, unknown>;
  resultSummary?: Record<string, unknown>;
  errorMessage?: string | null;
};

function suggestionsForView(view?: string, compact = false): string[] {
  const byView: Record<string, string[]> = {
    products: [
      "List top products with low stock in a table",
      "Increase price of all Nike products in Running Shoes by 5%",
      "Summarize catalog product counts by category",
    ],
    collections: [
      "List all collections with slugs and product counts as a table",
      "Create a new Featured Autumn collection",
      "Which collections have fewer than 5 products?",
    ],
    categories: [
      "List all categories, slugs, and product counts as a table",
      "Create a Trail Accessories category",
    ],
    orders: [
      "Summarize recent orders and revenue performance for the last 30 days",
      "List pending or unfulfilled orders in a table",
    ],
    discounts: [
      "List all active discount codes and expiry dates in a table",
      "Create a 15% discount for Footwear category",
    ],
    promotions: [
      "List all active promotions in a table",
      "Create a 15% discount for Footwear category",
    ],
  };

  const defaults = [
    "List all collections with slugs and product counts as a table",
    "Analyze revenue performance by category for the last 30 days",
    "Create a 15% discount for Footwear category",
    "Increase price of all Nike products in Running Shoes by 5%",
    "Create a Running Shoes category and add all Nike running products to it",
    "Add a Best Sellers section below the hero",
  ];

  const list = (view && byView[view]) || defaults;
  return compact ? list.slice(0, 3) : list;
}

export function AssistantChatPanel({
  mode = "full",
  conversations,
  selectedId,
  onSelectThread,
  contextHint,
  notify,
  initialPrompt,
}: {
  mode?: "full" | "drawer";
  conversations: AiConversationSummaryDto[];
  selectedId: string;
  onSelectThread: (id: string) => void;
  contextHint?: AssistantContextHint;
  notify?: (msg: string) => void;
  initialPrompt?: string;
}) {
  const queryClient = useQueryClient();
  const { models: availableModels, defaultModelId } = useAiModels();
  const [selectedModel, setSelectedModel] = useState<AIModelId | null>(null);

  const storeDraft = useAdminAssistantStore((s) => s.draftPrompt);
  const setStoreDraft = useAdminAssistantStore((s) => s.setDraftPrompt);
  const [localPrompt, setLocalPrompt] = useState<string>(initialPrompt || "");
  const prompt = mode === "drawer" ? storeDraft : localPrompt;
  const setPrompt = mode === "drawer" ? setStoreDraft : setLocalPrompt;

  const [attachment, setAttachment] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingPrompt, setStreamingPrompt] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streamingTools, setStreamingTools] = useState<StreamingToolRow[]>([]);
  const [errorState, setErrorState] = useState<{ thread: string; msg: string }>({ thread: "", msg: "" });
  const [reviewPlan, setReviewPlan] = useState<AiChangePlanDto | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const resolvedModel =
    selectedModel && availableModels.some((m) => m.id === selectedModel)
      ? selectedModel
      : defaultModelId;

  const activeThreadId =
    selectedId === "new"
      ? undefined
      : conversations.find((c) => c.id === selectedId)?.id ||
        conversations[0]?.id;

  const detailQuery = useQuery({
    queryKey: ["ai-conversation", activeThreadId],
    queryFn: () => aiAdminApi.getConversation(activeThreadId!),
    enabled: Boolean(activeThreadId),
  });

  const detail = detailQuery.data;

  function invalidateAfterMutation() {
    if (activeThreadId) {
      queryClient.invalidateQueries({
        queryKey: ["ai-conversation", activeThreadId],
      });
    }
    queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
    queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
  }

  const applyMutation = useMutation({
    mutationFn: (planId: string) =>
      aiAdminApi.applyChangePlan(planId, `ws-${planId}-${Date.now()}`),
    onSuccess: (updated) => {
      invalidateAfterMutation();
      setReviewPlan(null);
      notify?.(`Applied Change Plan: ${updated.requestSummary}`);
    },
    onError: (err) => {
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to apply Change Plan"
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (planId: string) =>
      aiAdminApi.rejectChangePlan(planId, "Dismissed by operator"),
    onSuccess: () => {
      invalidateAfterMutation();
      setReviewPlan(null);
      notify?.("Change Plan rejected");
    },
    onError: (err) => {
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to reject Change Plan"
      );
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (planId: string) => aiAdminApi.rollbackChangePlan(planId),
    onSuccess: (rolled) => {
      invalidateAfterMutation();
      notify?.(`Rolled back: ${rolled.requestSummary}`);
    },
    onError: (err) => {
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to rollback Change Plan"
      );
    },
  });

  const threadKey = activeThreadId || "new";
  const errorBanner = errorState.thread === threadKey ? errorState.msg : "";
  const setErrorBanner = (msg: string) => setErrorState({ thread: threadKey, msg });

  async function send(overridePrompt?: string) {
    const rawText = (overridePrompt ?? prompt).trim();
    if (!rawText || busy) return;

    const fullPrompt = attachment
      ? `${rawText}\n\n[Attached file reference: ${attachment}]`
      : rawText;

    setErrorBanner("");
    setBusy(true);
    setStreamingPrompt(rawText);
    setStreamingStatus("Starting Dat AI Operator…");
    setStreamingText("");
    setStreamingTools([]);
    setPrompt("");
    setAttachment("");

    try {
      let targetConvId = activeThreadId;
      if (!targetConvId) {
        const created = await aiAdminApi.createConversation(
          rawText.slice(0, 72)
        );
        targetConvId = created.id;
        onSelectThread(created.id);
        queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      }

      await aiAdminApi.streamMessage(
        targetConvId,
        { prompt: fullPrompt, model: resolvedModel },
        {
          onStatus: (s) => setStreamingStatus(s.message || s.phase),
          onToolStarted: (t) => {
            setStreamingTools((curr) => [
              ...curr,
              {
                id: t.callId || newId(),
                toolName: t.tool,
                status: "running",
                durationMs: 0,
              },
            ]);
          },
          onToolCompleted: (tc) => {
            const payload = (tc.toolCall || {}) as Partial<AiToolCallDto>;
            setStreamingTools((curr) => {
              const next = [...curr];
              const idx = next.findIndex(
                (s) => s.id === payload.id || s.status === "running"
              );
              const row: StreamingToolRow = {
                id: payload.id || newId(),
                toolName: payload.toolName || "tool",
                status: tc.status === "FAILED" ? "failed" : "completed",
                durationMs: payload.durationMs || 0,
                arguments: payload.arguments,
                resultSummary: payload.resultSummary,
                errorMessage: payload.errorMessage,
              };
              if (idx >= 0) next[idx] = row;
              else next.push(row);
              return next;
            });
          },
          onMessageDelta: (delta) => {
            setStreamingText((prev) => prev + (delta.text || ""));
          },
          onPlanCreated: () => {
            queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
          },
          onCompleted: () => {
            queryClient.invalidateQueries({
              queryKey: ["ai-conversation", targetConvId],
            });
            queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
            queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
          },
          onError: (msg) => setErrorBanner(msg),
        }
      );
    } catch (err) {
      setErrorBanner(
        err instanceof ApiError ? err.message : "AI stream request failed"
      );
    } finally {
      setBusy(false);
      setStreamingPrompt("");
      setStreamingStatus("");
      setStreamingText("");
      setStreamingTools([]);
    }
  }

  const messages = detail?.messages || [];
  const toolCalls = detail?.toolCalls || [];
  const changePlans = detail?.changePlans || [];
  const linkedMessageIds = new Set(messages.map((m) => m.id));
  const orphanPlans = changePlans.filter(
    (p) => !p.messageId || !linkedMessageIds.has(p.messageId)
  );

  const suggestions = useMemo(
    () => suggestionsForView(contextHint?.view, mode === "drawer"),
    [contextHint?.view, mode]
  );

  function renderPlanCard(plan: AiChangePlanDto) {
    return (
      <div className="tool-plan" key={plan.id}>
        <div className="tool-plan-head">
          <div>
            <h3>{plan.requestSummary}</h3>
            <small className="muted">
              {plan.planType} · Risk: {plan.riskLevel} · Expires{" "}
              {formatDateTime(plan.expiresAt)}
            </small>
          </div>
          <StatusBadge status={plan.status} />
        </div>

        {plan.preview?.length ? (
          <ChangeDiffTable changes={plan.preview.slice(0, 6)} />
        ) : null}

        {plan.errorMessage ? (
          <p role="alert" className="danger" style={{ fontSize: 12 }}>
            {plan.errorMessage}
          </p>
        ) : null}

        {plan.status === "PENDING_APPROVAL" ? (
          <div className="button-row">
            <Button
              size="sm"
              variant="primary"
              disabled={applyMutation.isPending || rejectMutation.isPending}
              onClick={() => setReviewPlan(plan)}
            >
              Review &amp; approve ({plan.preview?.length || 0})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={applyMutation.isPending || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(plan.id)}
            >
              Reject
            </Button>
          </div>
        ) : plan.status === "APPLIED" && plan.reversible ? (
          <div className="button-row">
            <Button
              size="sm"
              disabled={rollbackMutation.isPending}
              onClick={() => rollbackMutation.mutate(plan.id)}
            >
              <RotateCcw size={13} /> Rollback
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const stickKey = `${activeThreadId || "new"}-${messages.length}-${streamingText.length}-${streamingTools.length}`;

  return (
    <div className={cn("ai-chat-panel", mode === "drawer" && "is-drawer")}>
      {mode === "full" ? (
        <div className="ai-workarea-head">
          <strong style={{ fontSize: 13 }}>
            {detail?.conversation.title || "New operator session"}
          </strong>
          <ModelSelector
            value={resolvedModel}
            onChange={(next) => setSelectedModel(next)}
            models={availableModels}
          />
        </div>
      ) : null}

      {errorBanner ? (
        <div className="ai-el-error-banner" role="alert">
          {errorBanner}
        </div>
      ) : null}

      <div className="ai-el-conversation-wrap">
        <Conversation stickToBottomKey={stickKey}>
          <ConversationContent>
            {detailQuery.isLoading && activeThreadId ? (
              <Skeleton rows={4} />
            ) : !messages.length && !busy ? (
              <ConversationEmptyState
                icon={<Sparkles size={18} />}
                title={
                  mode === "drawer" && contextHint?.title
                    ? `Ask Dat AI about ${contextHint.title}`
                    : "What would you like to operate on?"
                }
                description="Query store analytics, inspect collections & products in rich tables, or stage server-validated Change Plans with one-click rollback."
              >
                <Suggestions
                  items={suggestions}
                  compact={mode === "drawer"}
                  onSelect={(text) => {
                    setPrompt(text);
                    void send(text);
                  }}
                />
              </ConversationEmptyState>
            ) : (
              <>
                {messages.map((msg) => {
                  if (msg.role.toLowerCase() === "user") {
                    return (
                      <Message from="user" key={msg.id}>
                        <MessageContent>{msg.content}</MessageContent>
                      </Message>
                    );
                  }

                  const msgTools = toolCalls.filter(
                    (tc) => tc.messageId === msg.id
                  );
                  const msgPlans = changePlans.filter(
                    (p) => p.messageId === msg.id
                  );
                  const modelLabel =
                    AI_MODELS.find((m) => m.id === msg.model)?.label ||
                    msg.model ||
                    "Operator";
                  const hasPagePlan = msgPlans.some(
                    (p) => p.planType === "PAGE_CHANGE"
                  );

                  return (
                    <Message from="assistant" key={msg.id}>
                      <MessageHeader>
                        <AIAvatarBadge />
                        <div className="ai-el-meta">
                          <strong>Dat AI</strong>
                          <span className="muted">· {modelLabel}</span>
                        </div>
                        <MessageActions>
                          <MessageCopyAction text={msg.content} />
                        </MessageActions>
                      </MessageHeader>

                      {msgTools.length ? (
                        <div className="ai-el-tools-stack">
                          {msgTools.map((tc) => (
                            <Tool
                              key={tc.id}
                              name={tc.toolName}
                              status={
                                tc.status === "FAILED" ? "failed" : "completed"
                              }
                              durationMs={tc.durationMs}
                            >
                              <ToolSection title="Input" data={tc.arguments} />
                              <ToolSection
                                title={tc.errorMessage ? "Error" : "Result"}
                                data={tc.resultSummary}
                                error={tc.errorMessage}
                              />
                            </Tool>
                          ))}
                        </div>
                      ) : null}

                      <MessageContent>
                        <MessageResponse>{msg.content}</MessageResponse>
                      </MessageContent>

                      {hasPagePlan ? (
                        <div style={{ marginTop: 8 }}>
                          <Link href="/" className="btn btn-sm">
                            Open Visual Theme Editor <ArrowUpRight size={13} />
                          </Link>
                        </div>
                      ) : null}

                      {msgPlans.map((plan) => renderPlanCard(plan))}
                    </Message>
                  );
                })}

                {orphanPlans.map((plan) => (
                  <div key={plan.id}>{renderPlanCard(plan)}</div>
                ))}

                {busy ? (
                  <>
                    <Message from="user">
                      <MessageContent>{streamingPrompt}</MessageContent>
                    </Message>
                    <Message from="assistant">
                      <MessageHeader>
                        <AIAvatarBadge />
                        <div className="ai-el-meta">
                          <strong>Dat AI</strong>
                          <span className="muted">· Streaming</span>
                        </div>
                      </MessageHeader>

                      {streamingTools.length ? (
                        <div className="ai-el-tools-stack">
                          {streamingTools.map((st) => (
                            <Tool
                              key={st.id}
                              name={st.toolName}
                              status={st.status}
                              durationMs={st.durationMs}
                            >
                              <ToolSection title="Input" data={st.arguments} />
                              <ToolSection
                                title="Result"
                                data={st.resultSummary}
                                error={st.errorMessage}
                              />
                            </Tool>
                          ))}
                        </div>
                      ) : null}

                      {streamingText ? (
                        <MessageContent>
                          <MessageResponse isAnimating>
                            {streamingText}
                          </MessageResponse>
                        </MessageContent>
                      ) : null}

                      <div className="streaming">
                        <LoaderCircle size={14} className="spin" />
                        <span>{streamingStatus || "Streaming from 9Router…"}</span>
                      </div>
                    </Message>
                  </>
                ) : null}
              </>
            )}
          </ConversationContent>
        </Conversation>
        <ConversationScrollButton />
      </div>

      <PromptInput
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {attachment ? (
          <div className="ai-el-prompt-attachments">
            <PromptInputAttachment
              label={attachment}
              onRemove={() => setAttachment("")}
            />
          </div>
        ) : null}

        <PromptInputTextarea
          value={prompt}
          onChange={setPrompt}
          onSubmitEnter={() => void send()}
          disabled={busy}
          maxHeight={mode === "drawer" ? 100 : 140}
          placeholder={
            mode === "drawer" && contextHint?.title
              ? `Ask Dat AI about ${contextHint.title}, catalog, orders, or discounts…`
              : "Ask Dat AI Operator to query store data, inspect tables, or stage a Change Plan…"
          }
        />

        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setAttachment(file.name);
            e.target.value = "";
          }}
        />

        <PromptInputToolbar
          left={
            <>
              <IconButton
                label="Attach file reference"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={14} />
              </IconButton>
              {mode === "drawer" ? (
                <ModelSelector
                  value={resolvedModel}
                  compact
                  onChange={(next) => setSelectedModel(next)}
                  models={availableModels}
                />
              ) : (
                <span className="muted" style={{ fontSize: 11.5 }}>
                  Enter to send · Shift+Enter for newline
                </span>
              )}
            </>
          }
          right={<PromptInputSubmit busy={busy} disabled={!prompt.trim()} />}
        />
      </PromptInput>

      {reviewPlan ? (
        <Modal
          close={() => setReviewPlan(null)}
          title="Review & confirm AI Change Plan"
          description={`${reviewPlan.planType} · Risk: ${reviewPlan.riskLevel} · Idempotent & reversible`}
          wide
          footer={
            <>
              <Button
                variant="ghost"
                disabled={rejectMutation.isPending || applyMutation.isPending}
                onClick={() => rejectMutation.mutate(reviewPlan.id)}
              >
                Reject plan
              </Button>
              <Button
                variant="primary"
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate(reviewPlan.id)}
              >
                {applyMutation.isPending
                  ? "Applying…"
                  : `Approve & apply (${reviewPlan.preview?.length || 0} changes)`}
              </Button>
            </>
          }
        >
          <div className="stack">
            <p style={{ margin: 0, fontWeight: 600 }}>
              {reviewPlan.requestSummary}
            </p>
            <ChangeDiffTable changes={reviewPlan.preview || []} />
            <small className="muted">
              Plan ID: <code>{reviewPlan.id}</code> · Expires{" "}
              {formatDateTime(reviewPlan.expiresAt)}
            </small>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
