"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowUp,
  ArrowUpRight,
  File as FileIcon,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AIAvatarBadge,
  ChangeDiffTable,
  ModelSelector,
  ToolExecutionTimeline,
} from "@/components/shared/ai-components";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/data-display";
import { Modal } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { formatDateTime, newId } from "@/lib/format";
import { AI_MODELS, type AIModelId, type ToolStep } from "@/types/ai";
import type {
  AiChangePlanDto,
  AiToolCallDto,
} from "@/types/api-cms-ai";

const suggestedPrompts = [
  "Create a Running Shoes category and add all Nike running products to it",
  "Increase price of all Nike products in Running Shoes by 5%",
  "Create a 15% discount for Footwear category",
  "Add a Best Sellers section below the hero",
  "Create a new product type called Monitor with Panel, Refresh Rate and Resolution attributes",
  "Analyze revenue performance by category for the last 30 days",
];

function toolCallToStep(tc: AiToolCallDto): ToolStep {
  const argsPreview = Object.entries(tc.arguments || {})
    .slice(0, 3)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  const records = Number(
    tc.resultSummary?.count ??
      tc.resultSummary?.matchedCount ??
      tc.resultSummary?.updatedCount ??
      1
  );
  return {
    id: tc.id,
    tool: tc.toolName,
    label: tc.toolName.replace(".", " · "),
    detail: tc.errorMessage || argsPreview || "Tool executed cleanly",
    records: Number.isFinite(records) ? records : 0,
    durationMs: tc.durationMs || 0,
    status: tc.status === "FAILED" ? "failed" : "completed",
  };
}

export function Workspace({ notify }: { notify?: (msg: string) => void }) {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      if (new URLSearchParams(window.location.search).get("prompt")) {
        return "new";
      }
    }
    return "";
  });
  const [model, setModel] = useState<AIModelId>("claude-sonnet-4");
  const [prompt, setPrompt] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("prompt") || "";
    }
    return "";
  });
  const [attachment, setAttachment] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingPrompt, setStreamingPrompt] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streamingSteps, setStreamingSteps] = useState<ToolStep[]>([]);
  const [errorBanner, setErrorBanner] = useState("");
  const [reviewPlan, setReviewPlan] = useState<AiChangePlanDto | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  const detailQuery = useQuery({
    queryKey: ["ai-conversation", activeThreadId],
    queryFn: () => aiAdminApi.getConversation(activeThreadId!),
    enabled: Boolean(activeThreadId),
  });

  const detail = detailQuery.data;

  useEffect(() => {
    if (detail?.messages.length || busy) {
      endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [detail?.messages.length, busy]);

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
    queryClient.invalidateQueries({ queryKey: ["admin-product-types"] });
    queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
    queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiAdminApi.deleteConversation(id),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (activeThreadId === id) {
        setSelectedId("new");
      }
      notify?.("Conversation deleted");
    },
    onError: (err) =>
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to delete conversation"
      ),
  });

  const applyMutation = useMutation({
    mutationFn: (planId: string) =>
      aiAdminApi.applyChangePlan(planId, `ws-${planId}-${Date.now()}`),
    onSuccess: (updated) => {
      invalidateAfterMutation();
      setReviewPlan(null);
      setErrorBanner("");
      notify?.(`Applied change plan (${updated.planType})`);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.message : "Failed to apply change plan";
      setErrorBanner(msg);
      notify?.(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (planId: string) =>
      aiAdminApi.rejectChangePlan(planId, "Dismissed by operator"),
    onSuccess: () => {
      invalidateAfterMutation();
      setReviewPlan(null);
      notify?.("Change plan rejected");
    },
    onError: (err) =>
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to reject change plan"
      ),
  });

  const rollbackMutation = useMutation({
    mutationFn: (planId: string) => aiAdminApi.rollbackChangePlan(planId),
    onSuccess: () => {
      invalidateAfterMutation();
      notify?.("Change plan rolled back cleanly");
    },
    onError: (err) =>
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to rollback change plan"
      ),
  });

  async function send(overrideText?: string) {
    const raw = (overrideText ?? prompt).trim();
    if (!raw || busy) return;

    const fullPrompt = attachment
      ? `${raw}\n\n[Attached reference file: ${attachment}]`
      : raw;

    setErrorBanner("");
    setPrompt("");
    setAttachment("");
    setBusy(true);
    setStreamingPrompt(fullPrompt);
    setStreamingStatus("Starting 9Router session…");
    setStreamingText("");
    setStreamingSteps([]);

    try {
      let targetConvId = activeThreadId;
      if (!targetConvId) {
        const created = await aiAdminApi.createConversation(
          raw.slice(0, 64),
          model
        );
        targetConvId = created.id;
        setSelectedId(created.id);
        queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      }

      await aiAdminApi.streamMessage(
        targetConvId,
        { prompt: fullPrompt, model },
        {
          onStatus: (s) => {
            setStreamingStatus(s.message || s.phase);
          },
          onToolStarted: (t) => {
            setStreamingSteps((curr) => [
              ...curr,
              {
                id: t.callId || newId(),
                tool: t.tool,
                label: `Running ${t.tool}`,
                detail: "Executing server-side validated tool…",
                records: 0,
                durationMs: 0,
                status: "running",
              },
            ]);
          },
          onToolCompleted: (tc) => {
            const payload = (tc.toolCall || {}) as Partial<AiToolCallDto>;
            setStreamingSteps((curr) => {
              const next = [...curr];
              const idx = next.findIndex(
                (s) => s.id === payload.id || s.status === "running"
              );
              const step: ToolStep = {
                id: payload.id || newId(),
                tool: payload.toolName || "tool",
                label: (payload.toolName || "tool").replace(".", " · "),
                detail:
                  tc.status === "FAILED"
                    ? "Tool returned validation error"
                    : "Tool completed",
                records: 1,
                durationMs: payload.durationMs || 0,
                status: tc.status === "FAILED" ? "failed" : "completed",
              };
              if (idx >= 0) next[idx] = step;
              else next.push(step);
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
          onError: (msg) => {
            setErrorBanner(msg);
          },
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
      setStreamingSteps([]);
    }
  }

  const messages = detail?.messages || [];
  const toolCalls = detail?.toolCalls || [];
  const changePlans = detail?.changePlans || [];
  const linkedMessageIds = new Set(messages.map((m) => m.id));
  const orphanPlans = changePlans.filter(
    (p) => !p.messageId || !linkedMessageIds.has(p.messageId)
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
              variant="primary"
              disabled={applyMutation.isPending || rejectMutation.isPending}
              onClick={() => setReviewPlan(plan)}
            >
              Review & approve ({plan.preview?.length || 0})
            </Button>
            <Button
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

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>AI Assistant</h1>
          <p>
            Execute catalog, pricing, promotion, and storefront updates with
            server-validated Change Plans and one-click rollback.
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
              setSelectedId("new");
              setPrompt("");
              setAttachment("");
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
                  onClick={() => setSelectedId(item.id)}
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
          <div className="ai-workarea-head">
            <strong style={{ fontSize: 13 }}>
              {detail?.conversation.title || "New operator session"}
            </strong>
            <ModelSelector value={model} onChange={setModel} />
          </div>

          <div className="ai-history" aria-live="polite">
            {detailQuery.isLoading && activeThreadId ? (
              <Skeleton rows={4} />
            ) : !messages.length && !busy ? (
              <div className="ai-intro">
                <span className="studio-symbol">
                  <Sparkles size={20} />
                </span>
                <h2>What would you like to operate on?</h2>
                <p>
                  Every mutating action creates a signed, time-limited Change
                  Plan that requires your explicit confirmation before applying.
                </p>
                <div>
                  {suggestedPrompts.map((example) => (
                    <Button key={example} onClick={() => setPrompt(example)}>
                      <span>{example}</span>
                      <ArrowUpRight size={13} />
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  if (msg.role.toLowerCase() === "user") {
                    return (
                      <div className="operator-turn" key={msg.id}>
                        <div className="user-bubble">{msg.content}</div>
                      </div>
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
                    <div className="operator-turn" key={msg.id}>
                      <div className="assistant-message">
                        <AIAvatarBadge />
                        <div>
                          <strong>
                            Dat AI{" "}
                            <span
                              className="muted"
                              style={{ fontWeight: 400 }}
                            >
                              · {modelLabel}
                            </span>
                          </strong>
                          <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                          {hasPagePlan ? (
                            <Link href="/" className="btn btn-sm">
                              Open Visual Store Editor <ArrowUpRight size={13} />
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      {msgTools.length ? (
                        <div className="tool-plan">
                          <ToolExecutionTimeline
                            steps={msgTools.map(toolCallToStep)}
                            status="Completed"
                          />
                        </div>
                      ) : null}

                      {msgPlans.map((plan) => renderPlanCard(plan))}
                    </div>
                  );
                })}

                {orphanPlans.map((plan) => renderPlanCard(plan))}
              </>
            )}

            {busy ? (
              <div className="operator-turn">
                {streamingPrompt ? (
                  <div className="user-bubble">{streamingPrompt}</div>
                ) : null}
                {streamingSteps.length ? (
                  <div className="tool-plan">
                    <ToolExecutionTimeline
                      steps={streamingSteps}
                      status="Running"
                      activeStepIndex={streamingSteps.length - 1}
                    />
                  </div>
                ) : null}
                {streamingText ? (
                  <div className="assistant-message">
                    <AIAvatarBadge />
                    <div>
                      <strong>Dat AI</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>{streamingText}</p>
                    </div>
                  </div>
                ) : null}
                <div className="streaming">
                  <LoaderCircle size={15} className="spin" />
                  <span>{streamingStatus || "Streaming from 9Router…"}</span>
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            className="operator-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {attachment ? (
              <span className="composer-context">
                <FileIcon size={12} /> {attachment}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setAttachment("")}
                >
                  ×
                </button>
              </span>
            ) : null}
            <textarea
              aria-label="Message Dat AI Operator"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Ask Dat AI to update products, categories, discounts, theme tokens, or storefront blocks…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="button-row">
              <input
                type="file"
                hidden
                ref={fileRef}
                onChange={(e) => {
                  setAttachment(e.target.files?.[0]?.name || "");
                  e.target.value = "";
                }}
              />
              <IconButton
                label="Attach a file"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={15} />
              </IconButton>
              <span className="muted">
                Enter to send · Shift+Enter for newline
              </span>
              <IconButton
                label="Send message"
                className="primary"
                type="submit"
                disabled={!prompt.trim() || busy}
              >
                <ArrowUp size={16} />
              </IconButton>
            </div>
          </form>
        </div>
      </div>

      {reviewPlan ? (
        <Modal
          wide
          title={reviewPlan.requestSummary}
          description={`${reviewPlan.planType} · Risk: ${reviewPlan.riskLevel} · Review ${reviewPlan.preview?.length || 0} affected records before applying.`}
          close={() => setReviewPlan(null)}
        >
          {reviewPlan.preview?.length ? (
            <ChangeDiffTable changes={reviewPlan.preview} />
          ) : (
            <p className="muted">No diff preview rows returned.</p>
          )}
          <div className="modal-actions">
            <Button
              disabled={applyMutation.isPending || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(reviewPlan.id)}
            >
              Reject plan
            </Button>
            <Button
              variant="primary"
              disabled={applyMutation.isPending || rejectMutation.isPending}
              onClick={() => applyMutation.mutate(reviewPlan.id)}
            >
              {applyMutation.isPending ? "Applying…" : "Confirm & apply"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
