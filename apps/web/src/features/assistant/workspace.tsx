"use client";
import Link from "next/link";
import {
  ArrowUp,
  ArrowUpRight,
  File as FileIcon,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AIAvatarBadge,
  ChangeDiffTable,
  ModelSelector,
  ToolExecutionTimeline,
} from "@/components/shared/ai-components";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { newId } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { initialThreads } from "@/mocks/operations";
import {
  AI_MODELS,
  type AIActivityEntry,
  type AIModelId,
  type ConversationThread,
  type ConversationTurn,
  type Snapshot,
} from "@/types/ai";
import { prepare } from "./plans";

const suggestedPrompts = [
  "Create a Running Shoes category and add all Nike running products to it",
  "Increase the price of all Nike products by 5%",
  "Create a 15% discount for the Footwear category",
  "Add a Best Sellers section to the homepage",
  "Create a new product type called Monitor with Panel, Refresh Rate and Resolution attributes",
  "Analyze this month's revenue and identify the best-performing categories",
];

export function Workspace({
  snapshot,
  commit,
  log,
}: {
  snapshot: Snapshot;
  commit: (next: Partial<Snapshot>) => void;
  log: (item: AIActivityEntry) => void;
}) {
  const [threads, setThreads, ready] = useStored<ConversationThread[]>(
    "conversations",
    initialThreads
  );
  const [selectedId, setSelectedId] = useState("");
  const [model, setModel] = useState<AIModelId>("claude-sonnet-4");
  const [prompt, setPrompt] = useState("");
  const [attachment, setAttachment] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [streamingStepsCount, setStreamingStepsCount] = useState(0);
  const [review, setReview] = useState<{
    threadId: string;
    turn: ConversationTurn;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeThread =
    selectedId === "new"
      ? undefined
      : threads.find((t) => t.id === selectedId) || threads[0];

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("prompt");
    if (initial) {
      setPrompt(initial);
      setSelectedId("new");
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeThread?.turns.length || busy) {
      endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeThread?.turns.length, busy]);

  function send(overrideText?: string) {
    const raw = (overrideText ?? prompt).trim();
    if (!raw || busy || !ready) return;

    const threadId = activeThread?.id || newId();
    const turnId = newId();
    const modelLabel = AI_MODELS.find((m) => m.id === model)?.label || "Forma AI";
    const turn: ConversationTurn = {
      id: turnId,
      prompt: raw,
      attachment: attachment || undefined,
      model,
      timestamp: new Date().toISOString(),
    };

    setSelectedId(threadId);
    setPrompt("");
    setAttachment("");
    setBusy(true);
    setActiveStepIdx(0);

    setThreads((curr) =>
      activeThread
        ? curr.map((t) =>
            t.id === threadId
              ? { ...t, updatedAt: turn.timestamp, turns: [...t.turns, turn] }
              : t
          )
        : [
            {
              id: threadId,
              title: raw.slice(0, 44),
              updatedAt: turn.timestamp,
              turns: [turn],
            },
            ...curr,
          ]
    );

    const previewPlan = prepare(raw, snapshot);
    const totalSteps = previewPlan.plan?.steps.length || 2;
    setStreamingStepsCount(totalSteps);

    if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    stepIntervalRef.current = setInterval(() => {
      setActiveStepIdx((i) => Math.min(totalSteps - 1, i + 1));
    }, 240);

    timerRef.current = setTimeout(() => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (previewPlan.error) {
        log({
          id: newId(),
          title: raw,
          category: "Error",
          timestamp: new Date().toISOString(),
          status: "Failed",
          records: 0,
          model: modelLabel,
        });
      } else if (!previewPlan.plan) {
        log({
          id: newId(),
          title: raw.slice(0, 60),
          category: "Analysis",
          timestamp: new Date().toISOString(),
          status: "Completed",
          records: snapshot.catalog.length,
          model: modelLabel,
        });
      }

      setThreads((curr) =>
        curr.map((t) =>
          t.id === threadId
            ? {
                ...t,
                turns: t.turns.map((entry) =>
                  entry.id === turnId
                    ? {
                        ...entry,
                        result: previewPlan,
                        status: previewPlan.plan
                          ? "Pending"
                          : previewPlan.error
                            ? "Failed"
                            : "Completed",
                      }
                    : entry
                ),
              }
            : t
        )
      );
      setBusy(false);
    }, Math.max(650, totalSteps * 250));
  }

  function finish(status: "Completed" | "Canceled") {
    if (!review?.turn.result?.plan) return;
    const oldPlan = review.turn.result.plan;
    const fresh = prepare(review.turn.prompt, snapshot).plan;
    const stillMatches =
      fresh && JSON.stringify(fresh.changes) === JSON.stringify(oldPlan.changes);

    if (status === "Completed" && stillMatches) {
      commit(fresh.updates);
    }

    const finalStatus =
      status === "Completed" && !stillMatches ? "Failed" : status;
    const modelLabel =
      AI_MODELS.find((m) => m.id === review.turn.model)?.label || "Forma AI";

    log({
      id: newId(),
      title: oldPlan.summary,
      category: oldPlan.category,
      timestamp: new Date().toISOString(),
      status: finalStatus,
      records: finalStatus === "Completed" ? oldPlan.changes.length : 0,
      model: modelLabel,
      steps: oldPlan.steps,
      changes: oldPlan.changes,
    });

    setThreads((all) =>
      all.map((t) =>
        t.id === review.threadId
          ? {
              ...t,
              turns: t.turns.map((turn) =>
                turn.id === review.turn.id ? { ...turn, status: finalStatus } : turn
              ),
            }
          : t
      )
    );
    setReview(null);
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>AI Assistant</h1>
          <p>
            Execute catalog, pricing, promotion, and storefront updates with explicit change previews.
          </p>
        </div>
        <Badge tone="accent">
          <Sparkles size={13} /> Forma Operator · 9Router
        </Badge>
      </div>

      <div className="ai-workspace admin-table-panel">
        <aside className="ai-threads" aria-label="Conversations">
          <Button
            onClick={() => {
              setSelectedId("new");
              setPrompt("");
              setAttachment("");
            }}
          >
            <Plus size={14} /> New conversation
          </Button>
          {threads.map((item) => (
            <div className="ai-thread-row" key={item.id}>
              <button
                type="button"
                className={
                  "ai-thread-btn " +
                  (activeThread?.id === item.id ? "active" : "")
                }
                onClick={() => setSelectedId(item.id)}
              >
                <MessageSquare size={14} />
                <span>{item.title}</span>
              </button>
              <IconButton
                label={`Delete thread ${item.title}`}
                onClick={() => {
                  setThreads((curr) => curr.filter((t) => t.id !== item.id));
                  if (activeThread?.id === item.id) setSelectedId("new");
                }}
              >
                <Trash2 size={12} />
              </IconButton>
            </div>
          ))}
        </aside>

        <div className="ai-workarea">
          <div className="ai-workarea-head">
            <strong style={{ fontSize: 13 }}>
              {activeThread?.title || "New operator session"}
            </strong>
            <ModelSelector value={model} onChange={setModel} />
          </div>

          <div className="ai-history" aria-live="polite">
            {!activeThread?.turns.length && !busy ? (
              <div className="ai-intro">
                <span className="studio-symbol">
                  <Sparkles size={20} />
                </span>
                <h2>What would you like to operate on?</h2>
                <p>
                  Sensitive catalog, pricing, promotion, and theme actions always pause for your
                  confirmation before mutating records.
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
              activeThread?.turns.map((turn) => (
                <div className="operator-turn" key={turn.id}>
                  <div className="user-bubble">
                    {turn.prompt}
                    {turn.attachment ? (
                      <span className="attachment">
                        <FileIcon size={13} /> {turn.attachment}
                      </span>
                    ) : null}
                  </div>

                  {turn.result ? (
                    <>
                      <div className="assistant-message">
                        <AIAvatarBadge />
                        <div>
                          <strong>
                            Forma AI{" "}
                            <span className="muted" style={{ fontWeight: 400 }}>
                              ·{" "}
                              {AI_MODELS.find((m) => m.id === turn.model)?.label ||
                                "Operator"}
                            </span>
                          </strong>
                          <p>{turn.result.text}</p>
                          {turn.result.link ? (
                            <Link href="/" className="btn btn-sm">
                              Open Visual Store Editor <ArrowUpRight size={13} />
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      {turn.result.plan ? (
                        <div className="tool-plan">
                          <div className="tool-plan-head">
                            <h3>{turn.result.plan.summary}</h3>
                            <StatusBadge status={turn.status || "Pending"} />
                          </div>

                          <ToolExecutionTimeline
                            steps={turn.result.plan.steps}
                            status={turn.status}
                          />

                          {turn.status === "Pending" ? (
                            <div className="button-row">
                              <Button
                                variant="primary"
                                onClick={() =>
                                  setReview({ threadId: activeThread.id, turn })
                                }
                              >
                                Review & approve ({turn.result.plan.changes.length})
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  log({
                                    id: newId(),
                                    title: turn.result?.plan?.summary || turn.prompt,
                                    category: turn.result?.plan?.category,
                                    timestamp: new Date().toISOString(),
                                    status: "Canceled",
                                    records: 0,
                                  });
                                  setThreads((all) =>
                                    all.map((t) =>
                                      t.id === activeThread.id
                                        ? {
                                            ...t,
                                            turns: t.turns.map((item) =>
                                              item.id === turn.id
                                                ? { ...item, status: "Canceled" }
                                                : item
                                            ),
                                          }
                                        : t
                                    )
                                  );
                                }}
                              >
                                Dismiss
                              </Button>
                            </div>
                          ) : null}

                          {turn.status === "Failed" ? (
                            <p role="alert" className="danger" style={{ fontSize: 12 }}>
                              Underlying catalog state changed before approval. Re-run the command for a fresh preview.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ))
            )}

            {busy ? (
              <div className="streaming">
                <LoaderCircle size={15} className="spin" />
                <span>
                  Executing step {Math.min(activeStepIdx + 1, streamingStepsCount)} of{" "}
                  {streamingStepsCount}…
                </span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            className="operator-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
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
              aria-label="Message Forma Operator"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Ask Forma Operator to update products, categories, discounts, or storefront blocks…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
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
              <span className="muted">Enter to send · Shift+Enter for newline</span>
              <IconButton
                label="Send message"
                className="primary"
                type="submit"
                disabled={!prompt.trim() || busy || !ready}
              >
                <ArrowUp size={16} />
              </IconButton>
            </div>
          </form>
        </div>
      </div>

      {review?.turn.result?.plan ? (
        <Modal
          wide
          title={review.turn.result.plan.summary}
          description={`Inspect ${review.turn.result.plan.changes.length} affected records before applying changes.`}
          close={() => setReview(null)}
        >
          <ChangeDiffTable changes={review.turn.result.plan.changes} />
          <div className="modal-actions">
            <Button onClick={() => finish("Canceled")}>Cancel operation</Button>
            <Button variant="primary" onClick={() => finish("Completed")}>
              Confirm & apply
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
