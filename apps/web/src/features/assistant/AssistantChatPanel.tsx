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

type StreamingState = {
  /** Conversation this stream belongs to. Null while a new conversation is being created. */
  conversationId: string | null;
  /** Text displayed in the temporary user message. */
  prompt: string;
  /** Exact content sent to the API, including any attachment reference. */
  requestContent: string;
  status: string;
  text: string;
  tools: StreamingToolRow[];
};

type ErrorState = {
  thread: string;
  msg: string;
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
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [errorState, setErrorState] = useState<ErrorState>({
    thread: "",
    msg: "",
  });
  const [reviewPlan, setReviewPlan] = useState<AiChangePlanDto | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const sendLockRef = useRef(false);

  const busy = streaming !== null;

  const resolvedModel =
    selectedModel && availableModels.some((m) => m.id === selectedModel)
      ? selectedModel
      : defaultModelId;

  // Use selectedId directly. Falling back to conversations[0] can briefly
  // point a newly-created thread at the previously selected conversation.
  const activeThreadId =
    selectedId && selectedId !== "new" ? selectedId : undefined;

  const detailQuery = useQuery({
    queryKey: ["ai-conversation", activeThreadId],
    queryFn: () => aiAdminApi.getConversation(activeThreadId!),
    enabled: Boolean(activeThreadId),
    // Do not reuse the previous query's data as placeholder data.
    // When a new conversation is created, that would briefly render the old
    // conversation under the new conversation ID while the new detail loads.
    // TanStack Query still serves cached data for this exact query key when
    // the user revisits an already-loaded conversation.
    // Revisited conversations should normally render from cache immediately.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const detail = detailQuery.data;
  const threadKey = activeThreadId || "new";
  const errorBanner = errorState.thread === threadKey ? errorState.msg : "";

  function setThreadError(conversationId: string | undefined, msg: string) {
    setErrorState({ thread: conversationId || "new", msg });
  }

  function setErrorBanner(msg: string) {
    setThreadError(activeThreadId, msg);
  }

  function invalidateAfterMutation() {
    queryClient.invalidateQueries({ queryKey: ["ai-conversation"] });
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
        err instanceof ApiError ? err.message : "Failed to apply Change Plan",
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
        err instanceof ApiError ? err.message : "Failed to reject Change Plan",
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
        err instanceof ApiError ? err.message : "Failed to rollback Change Plan",
      );
    },
  });

  async function refreshConversation(conversationId: string) {
    // Wait for the detail query to finish before removing the temporary
    // streaming message. This prevents a blank frame between local and server data.
    await queryClient.invalidateQueries({
      queryKey: ["ai-conversation", conversationId],
      refetchType: "all",
    });
  }

  async function send(overridePrompt?: string) {
    const rawText = (overridePrompt ?? prompt).trim();

    // A ref lock prevents two submit events in the same render cycle from
    // creating two conversations/messages before React updates the state.
    if (!rawText || sendLockRef.current) return;

    sendLockRef.current = true;

    const submittedAttachment = attachment;
    const fullPrompt = submittedAttachment
      ? `${rawText}\n\n[Attached file reference: ${submittedAttachment}]`
      : rawText;

    let targetConvId = activeThreadId;

    setThreadError(targetConvId, "");
    setStreaming({
      conversationId: targetConvId || null,
      prompt: rawText,
      requestContent: fullPrompt,
      status: "Starting Dat AI Operator…",
      text: "",
      tools: [],
    });
    setPrompt("");
    setAttachment("");

    try {
      if (!targetConvId) {
        const created = await aiAdminApi.createConversation(rawText.slice(0, 72));
        targetConvId = created.id;

        setStreaming((current) =>
          current
            ? { ...current, conversationId: created.id }
            : current,
        );

        onSelectThread(created.id);
        void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      }

      const conversationId = targetConvId;

      await aiAdminApi.streamMessage(
        conversationId,
        { prompt: fullPrompt, model: resolvedModel },
        {
          onStatus: (status) => {
            setStreaming((current) =>
              current
                ? {
                    ...current,
                    status: status.message || status.phase,
                  }
                : current,
            );
          },
          onToolStarted: (tool) => {
            const toolId = tool.callId || newId();

            setStreaming((current) => {
              if (!current) return current;

              const existingIndex = current.tools.findIndex(
                (row) => row.id === toolId,
              );
              const nextTools = [...current.tools];
              const nextRow: StreamingToolRow = {
                id: toolId,
                toolName: tool.tool,
                status: "running",
                durationMs: 0,
              };

              if (existingIndex >= 0) nextTools[existingIndex] = nextRow;
              else nextTools.push(nextRow);

              return { ...current, tools: nextTools };
            });
          },
          onToolCompleted: (toolCompleted) => {
            const payload = (toolCompleted.toolCall || {}) as Partial<AiToolCallDto>;
            const fallbackId = payload.id || newId();

            setStreaming((current) => {
              if (!current) return current;

              let index = payload.id
                ? current.tools.findIndex((row) => row.id === payload.id)
                : -1;

              // Some APIs use different IDs for the start and completion
              // events. Match by tool name only when exactly one call is running.
              if (index < 0 && payload.toolName) {
                const matchingRunning = current.tools
                  .map((row, rowIndex) => ({ row, rowIndex }))
                  .filter(
                    ({ row }) =>
                      row.status === "running" &&
                      row.toolName === payload.toolName,
                  );

                if (matchingRunning.length === 1) {
                  index = matchingRunning[0].rowIndex;
                }
              }

              if (index < 0) {
                const running = current.tools
                  .map((row, rowIndex) => ({ row, rowIndex }))
                  .filter(({ row }) => row.status === "running");

                // Only use the fallback when there is exactly one running
                // tool. Never replace an arbitrary running tool when several
                // tools are executing concurrently.
                if (running.length === 1) index = running[0].rowIndex;
              }

              const previous = index >= 0 ? current.tools[index] : undefined;
              const completedRow: StreamingToolRow = {
                id: previous?.id || fallbackId,
                toolName: payload.toolName || previous?.toolName || "tool",
                status: toolCompleted.status === "FAILED" ? "failed" : "completed",
                durationMs: payload.durationMs || 0,
                arguments: payload.arguments,
                resultSummary: payload.resultSummary,
                errorMessage: payload.errorMessage,
              };

              const nextTools = [...current.tools];
              if (index >= 0) nextTools[index] = completedRow;
              else nextTools.push(completedRow);

              return { ...current, tools: nextTools };
            });
          },
          onMessageDelta: (delta) => {
            if (!delta.text) return;
            setStreaming((current) =>
              current
                ? { ...current, text: current.text + delta.text }
                : current,
            );
          },
          onPlanCreated: () => {
            void queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
          },
          onCompleted: () => {
            setStreaming((current) =>
              current
                ? { ...current, status: "Finishing response…" }
                : current,
            );
          },
          onError: (message) => {
            setThreadError(conversationId, message);
          },
        },
      );

      // Keep the temporary user/assistant messages visible until the server
      // has returned the persisted conversation messages.
      await refreshConversation(conversationId);

      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
    } catch (err) {
      setThreadError(
        targetConvId,
        err instanceof ApiError ? err.message : "AI stream request failed",
      );

      // Restore the draft so a failed request does not make the user's input
      // disappear. Keep the attachment reference as well.
      setPrompt(rawText);
      setAttachment(submittedAttachment);

      if (targetConvId) {
        try {
          await refreshConversation(targetConvId);
        } catch {
          // Keep the original stream error visible if the refresh also fails.
        }
      }
    } finally {
      setStreaming(null);
      sendLockRef.current = false;
    }
  }

  const messages = detail?.messages || [];
  const toolCalls = detail?.toolCalls || [];
  const changePlans = detail?.changePlans || [];
  const linkedMessageIds = new Set(messages.map((message) => message.id));
  const orphanPlans = changePlans.filter(
    (plan) => !plan.messageId || !linkedMessageIds.has(plan.messageId),
  );

  const suggestions = useMemo(
    () => suggestionsForView(contextHint?.view, mode === "drawer"),
    [contextHint?.view, mode],
  );

  // Render stream data only in the conversation where it was started. If a
  // user switches threads during a request, the stream will not appear in the
  // newly selected conversation.
  const visibleStreaming =
    streaming &&
    (streaming.conversationId === (activeThreadId || null) ||
      (selectedId === "new" && !activeThreadId))
      ? streaming
      : null;

  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role.toLowerCase() === "user");
  const pendingUserAlreadyPersisted =
    Boolean(visibleStreaming) &&
    latestUserMessage?.content === visibleStreaming?.requestContent;

  const streamingAssistantAlreadyPersisted =
    Boolean(visibleStreaming?.text) &&
    messages.some(
      (message) =>
        message.role.toLowerCase() !== "user" &&
        message.content === visibleStreaming?.text,
    );

  const isInitialLoading = Boolean(
    activeThreadId && detailQuery.isLoading && !detailQuery.data && !visibleStreaming,
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

  // Do not include token length or tool count here. Those values change for
  // every stream chunk and can repeatedly retrigger the conversation scroll.
  const stickKey = `${activeThreadId || "new"}-${messages.length}`;

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
            {isInitialLoading ? (
              <Skeleton rows={4} />
            ) : detailQuery.isError && !detailQuery.data && activeThreadId ? (
              <div className="ai-el-error-banner" role="alert">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "Failed to load conversation."}
              </div>
            ) : (
              <>
                {!messages.length && !visibleStreaming ? (
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
                ) : null}

                {messages.map((message) => {
                  if (message.role.toLowerCase() === "user") {
                    return (
                      <Message from="user" key={message.id}>
                        <MessageContent>{message.content}</MessageContent>
                      </Message>
                    );
                  }

                  const messageTools = toolCalls.filter(
                    (toolCall) => toolCall.messageId === message.id,
                  );
                  const messagePlans = changePlans.filter(
                    (plan) => plan.messageId === message.id,
                  );
                  const modelLabel =
                    AI_MODELS.find((model) => model.id === message.model)?.label ||
                    message.model ||
                    "Operator";
                  const hasPagePlan = messagePlans.some(
                    (plan) => plan.planType === "PAGE_CHANGE",
                  );

                  return (
                    <Message from="assistant" key={message.id}>
                      <MessageHeader>
                        <AIAvatarBadge />
                        <div className="ai-el-meta">
                          <strong>Dat AI</strong>
                          <span className="muted">· {modelLabel}</span>
                        </div>
                        <MessageActions>
                          <MessageCopyAction text={message.content} />
                        </MessageActions>
                      </MessageHeader>

                      {messageTools.length ? (
                        <div className="ai-el-tools-stack">
                          {messageTools.map((toolCall) => (
                            <Tool
                              key={toolCall.id}
                              name={toolCall.toolName}
                              status={
                                toolCall.status === "FAILED" ? "failed" : "completed"
                              }
                              durationMs={toolCall.durationMs}
                            >
                              <ToolSection
                                title="Input"
                                data={toolCall.arguments}
                              />
                              <ToolSection
                                title={toolCall.errorMessage ? "Error" : "Result"}
                                data={toolCall.resultSummary}
                                error={toolCall.errorMessage}
                              />
                            </Tool>
                          ))}
                        </div>
                      ) : null}

                      <MessageContent>
                        <MessageResponse>{message.content}</MessageResponse>
                      </MessageContent>

                      {hasPagePlan ? (
                        <div style={{ marginTop: 8 }}>
                          <Link href="/admin/editor" className="btn btn-sm">
                            Open Visual Theme Editor <ArrowUpRight size={13} />
                          </Link>
                        </div>
                      ) : null}

                      {messagePlans.map((plan) => renderPlanCard(plan))}
                    </Message>
                  );
                })}

                {orphanPlans.map((plan) => (
                  <div key={plan.id}>{renderPlanCard(plan)}</div>
                ))}

                {visibleStreaming ? (
                  <>
                    {!pendingUserAlreadyPersisted ? (
                      <Message from="user" key="pending-user-message">
                        <MessageContent>{visibleStreaming.prompt}</MessageContent>
                      </Message>
                    ) : null}

                    {!streamingAssistantAlreadyPersisted ? (
                      <Message from="assistant" key="pending-assistant-message">
                        <MessageHeader>
                          <AIAvatarBadge />
                          <div className="ai-el-meta">
                            <strong>Dat AI</strong>
                            <span className="muted">· Streaming</span>
                          </div>
                        </MessageHeader>

                        {visibleStreaming.tools.length ? (
                          <div className="ai-el-tools-stack">
                            {visibleStreaming.tools.map((tool) => (
                              <Tool
                                key={tool.id}
                                name={tool.toolName}
                                status={tool.status}
                                durationMs={tool.durationMs}
                              >
                                <ToolSection title="Input" data={tool.arguments} />
                                <ToolSection
                                  title="Result"
                                  data={tool.resultSummary}
                                  error={tool.errorMessage}
                                />
                              </Tool>
                            ))}
                          </div>
                        ) : null}

                        {visibleStreaming.text ? (
                          <MessageContent>
                            <MessageResponse isAnimating>
                              {visibleStreaming.text}
                            </MessageResponse>
                          </MessageContent>
                        ) : null}

                        <div className="streaming" role="status" aria-live="polite">
                          <LoaderCircle size={14} className="spin" />
                          <span>
                            {visibleStreaming.status || "Streaming from 9Router…"}
                          </span>
                        </div>
                      </Message>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </ConversationContent>
        </Conversation>
        <ConversationScrollButton />
      </div>

      <PromptInput
        onSubmit={(event) => {
          event.preventDefault();
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
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setAttachment(file.name);
            event.target.value = "";
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
          right={
            <PromptInputSubmit
              busy={busy}
              disabled={!prompt.trim() || busy}
            />
          }
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
