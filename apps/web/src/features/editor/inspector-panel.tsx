"use client";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  History,
  LoaderCircle,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AIAvatarBadge, ModelSelector } from "@/components/shared/ai-components";
import { Button, IconButton } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import { Tabs } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import { adminMediaApi } from "@/lib/commerce-api";
import { newId } from "@/lib/format";
import type { AIModelId } from "@/types/ai";
import type { Block, EditorMessage, Proposal } from "@/types/editor";
import { SectionIcon } from "./structure-panel";

function getContextualPrompts(block: Block | null): string[] {
  if (!block) return ["Add a Best Sellers section below the hero"];
  if (block.type === "Hero") {
    return [
      "Switch selected hero to split two-column layout with dark ink palette",
      "Make the hero CTA more crisp and centered",
      "Add a Best Sellers section below the hero",
    ];
  }
  if (block.type === "Best Sellers" || block.type === "Product Grid") {
    return [
      "Update selected section to 3 columns",
      "Switch selected section to dark ink palette",
      "Add a Best Sellers section below the hero",
    ];
  }
  return [
    "Switch selected section to split two-column layout",
    "Update selected section copy to emphasize durability",
    "Make this section headline larger",
  ];
}

export function InspectorPanel({
  tab,
  setTab,
  block,
  update,
  proposal,
  previewing,
  messages,
  busy,
  applyBusy = false,
  statusLine,
  canWrite = true,
  canUseAi = true,
  send,
  togglePreview,
  accept,
  reject,
  closeMobile,
  model,
  setModel,
}: {
  tab: "ai" | "properties";
  setTab: (next: "ai" | "properties") => void;
  block: Block | null;
  update: (change: Partial<Block>) => void;
  proposal: Proposal | null;
  previewing: boolean;
  messages: EditorMessage[];
  busy: boolean;
  applyBusy?: boolean;
  statusLine?: string;
  canWrite?: boolean;
  canUseAi?: boolean;
  send: (text: string) => void;
  togglePreview: () => void;
  accept: () => void;
  reject: () => void;
  closeMobile: () => void;
  model: AIModelId;
  setModel: (m: AIModelId) => void;
}) {
  const router = useRouter();

  return (
    <aside className="inspector" aria-label="Section inspector">
      <div className="inspector-heading">
        <span className="studio-symbol">
          <Sparkles size={16} />
        </span>
        <div>
          <h2>Store assistant</h2>
          <small>
            <i /> Dat Commerce Studio
          </small>
        </div>
        <IconButton
          label="AI activity"
          onClick={() => router.push("/admin/ai-activity")}
        >
          <History size={16} />
        </IconButton>
        <IconButton
          className="panel-toggle"
          label="Close inspector"
          onClick={closeMobile}
        >
          <X size={16} />
        </IconButton>
      </div>

      <div className="inspector-tabs" aria-label="Inspector mode">
        <button
          type="button"
          aria-pressed={tab === "ai"}
          onClick={() => setTab("ai")}
        >
          <Sparkles size={14} /> AI assistant
        </button>
        <button
          type="button"
          aria-pressed={tab === "properties"}
          onClick={() => setTab("properties")}
        >
          Properties
        </button>
      </div>

      {tab === "ai" ? (
        <AssistantTab
          block={block}
          proposal={proposal}
          previewing={previewing}
          messages={messages}
          busy={busy}
          applyBusy={applyBusy}
          statusLine={statusLine}
          canUseAi={canUseAi}
          send={send}
          togglePreview={togglePreview}
          accept={accept}
          reject={reject}
          model={model}
          setModel={setModel}
        />
      ) : block ? (
        <PropertiesTab block={block} update={update} canWrite={canWrite} />
      ) : (
        <div style={{ padding: 16 }}>
          <Empty
            title="No section selected"
            text="Click any section on the canvas or layer tree to inspect its properties."
          />
        </div>
      )}
    </aside>
  );
}

function AssistantTab({
  block,
  proposal,
  previewing,
  messages,
  busy,
  applyBusy,
  statusLine,
  canUseAi,
  send,
  togglePreview,
  accept,
  reject,
  model,
  setModel,
}: {
  block: Block | null;
  proposal: Proposal | null;
  previewing: boolean;
  messages: EditorMessage[];
  busy: boolean;
  applyBusy: boolean;
  statusLine?: string;
  canUseAi: boolean;
  send: (text: string) => void;
  togglePreview: () => void;
  accept: () => void;
  reject: () => void;
  model: AIModelId;
  setModel: (m: AIModelId) => void;
}) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length > 0 || busy) {
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length, busy]);

  const submit = (text: string) => {
    if (!text.trim() || busy || !canUseAi) return;
    send(text.trim() + (file ? ` [Attachment: ${file}]` : ""));
    setInput("");
    setFile("");
  };

  const prompts = getContextualPrompts(block);

  return (
    <>
      <div className="editor-chat" ref={threadRef} aria-live="polite">
        <div className="chat-date">
          <span />
          SESSION
          <span />
        </div>

        {!messages.length && !busy ? (
          <div className="assistant-message">
            <AIAvatarBadge />
            <div>
              <strong>Dat Commerce AI</strong>
              <p>
                Ask me to refine the selected section or add a new block to this page. Changes create a reviewable draft proposal and never auto-publish.
              </p>
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div className="chat-turn" key={message.id || index}>
            <div className="user-bubble">{message.prompt}</div>
            {message.reply ? (
              <div className="assistant-message">
                <AIAvatarBadge />
                <div>
                  <strong>Dat Commerce AI</strong>
                  <p>{message.reply}</p>
                  {message.status ? (
                    <span
                      className={
                        "chat-status " +
                        (message.status === "error"
                          ? "danger"
                          : message.status === "accepted"
                            ? "success"
                            : "muted")
                      }
                    >
                      {message.status === "error" ? (
                        <CircleAlert size={12} />
                      ) : message.status === "accepted" ? (
                        <Check size={12} />
                      ) : (
                        <X size={12} />
                      )}
                      {message.status === "error"
                        ? "Action failed"
                        : message.status === "accepted"
                          ? "Applied to draft"
                          : "Proposal rejected"}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ))}

        {busy ? (
          <div className="streaming">
            <LoaderCircle size={14} className="spin" />
            <span>{statusLine || "Streaming section proposal via 9Router…"}</span>
          </div>
        ) : null}

        {proposal && !busy ? (
          <div className="proposal-card">
            <div className="proposal-head">
              <span className="proposal-icon">
                <Sparkles size={13} />
              </span>
              <div>
                <strong>{proposal.title}</strong>
                <small>{proposal.changes.length} proposed edits</small>
              </div>
              <span className="draft-dot" />
            </div>

            <ul>
              {proposal.changes.map((change) => (
                <li key={change}>
                  <Check size={12} />
                  <span>{change}</span>
                </li>
              ))}
            </ul>

            {proposal.diffs.length ? (
              <div className="proposal-diffs">
                {proposal.diffs.map((d) => (
                  <div key={d.field} className="proposal-diff-pill">
                    <strong>{d.field}:</strong>
                    <span className="muted">{d.before}</span>
                    <ArrowRight size={10} />
                    <span className="success">{d.after}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="proposal-actions">
              <Button onClick={togglePreview} disabled={applyBusy}>
                <Eye size={13} /> {previewing ? "Exit preview" : "Preview"}
              </Button>
              <Button variant="primary" onClick={accept} disabled={applyBusy}>
                {applyBusy ? "Applying…" : "Accept"}{" "}
                <ArrowUpRight size={12} />
              </Button>
              <IconButton
                label="Reject proposal"
                disabled={applyBusy}
                onClick={reject}
              >
                <X size={14} />
              </IconButton>
            </div>
          </div>
        ) : null}
      </div>

      <div className="composer-wrap">
        <div className="suggestions">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              disabled={!canUseAi}
              onClick={() => setInput(p)}
            >
              <span>{p}</span>
              <ArrowUpRight size={11} />
            </button>
          ))}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <div>
            {block ? (
              <span className="composer-context">
                <SectionIcon kind={block.type} size={11} />
                {block.label}
              </span>
            ) : null}
            {file ? (
              <span className="composer-context">
                {file}{" "}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setFile("")}
                >
                  <X size={11} />
                </button>
              </span>
            ) : null}
          </div>

          <textarea
            aria-label="Ask AI to edit selected section"
            placeholder={
              !canUseAi
                ? "AI assistant requires ai:use permission."
                : block
                  ? `Edit ${block.label} with natural language…`
                  : "Ask AI to update or add a section…"
            }
            disabled={!canUseAi}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={2}
          />

          <div>
            <input
              ref={attachRef}
              hidden
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0]?.name || "");
                e.target.value = "";
              }}
            />
            <IconButton
              label="Attach reference"
              disabled={!canUseAi}
              onClick={() => attachRef.current?.click()}
            >
              <Paperclip size={15} />
            </IconButton>
            <div style={{ marginLeft: "auto" }}>
              <ModelSelector value={model} onChange={setModel} compact />
            </div>
            <IconButton
              className="primary send"
              label="Send message"
              type="submit"
              disabled={!input.trim() || busy || !canUseAi}
            >
              <ArrowUp size={15} />
            </IconButton>
          </div>
        </form>
        <p className="composer-note">
          {canUseAi
            ? "AI proposals edit validated CMS block schemas in draft only — never live until published."
            : "Read-only viewer role: ask an Admin or Owner to edit pages with AI."}
        </p>
      </div>
    </>
  );
}

function PropertiesTab({
  block,
  update,
  canWrite,
}: {
  block: Block;
  update: (change: Partial<Block>) => void;
  canWrite: boolean;
}) {
  const [subTab, setSubTab] = useState("content");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const hasItems =
    block.type === "FAQ" ||
    block.type === "Testimonials" ||
    block.type === "Image Gallery" ||
    block.type === "Logo Cloud";

  async function handleImageUpload(file: File | undefined) {
    if (!file || !canWrite) return;
    setUploading(true);
    setUploadError("");
    try {
      const asset = await adminMediaApi.upload(file, block.label);
      update({ image: asset.url });
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : "Image upload failed"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="properties form-stack">
      <div className="property-heading">
        <SectionIcon kind={block.type} />
        <div>
          <strong>{block.label}</strong>
          <p>{block.type} section</p>
        </div>
        <IconButton
          label={block.visible ? "Hide section" : "Show section"}
          disabled={!canWrite}
          onClick={() => update({ visible: !block.visible })}
        >
          {block.visible ? <Eye size={15} /> : <EyeOff size={15} />}
        </IconButton>
      </div>

      <Tabs
        value={subTab}
        onChange={setSubTab}
        items={[
          { id: "content", label: "Content" },
          { id: "layout", label: "Layout" },
          { id: "style", label: "Style" },
        ]}
      />

      {subTab === "content" ? (
        <div className="form-stack">
          <label>
            Layer name
            <input
              disabled={!canWrite}
              value={block.label}
              onChange={(e) => update({ label: e.target.value })}
            />
          </label>
          <label>
            Kicker / Eyebrow
            <input
              disabled={!canWrite}
              value={block.kicker || ""}
              onChange={(e) => update({ kicker: e.target.value })}
            />
          </label>
          <label>
            Headline
            <input
              disabled={!canWrite}
              value={block.heading}
              onChange={(e) => update({ heading: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              disabled={!canWrite}
              value={block.copy}
              onChange={(e) => update({ copy: e.target.value })}
            />
          </label>
          <div className="form-pair">
            <label>
              Button label
              <input
                disabled={!canWrite}
                value={block.action}
                onChange={(e) => update({ action: e.target.value })}
              />
            </label>
            <label>
              Button link
              <input
                disabled={!canWrite}
                value={block.actionUrl || ""}
                placeholder="/store/shop"
                onChange={(e) => update({ actionUrl: e.target.value })}
              />
            </label>
          </div>
          <label>
            Image URL
            <input
              disabled={!canWrite}
              value={block.image}
              onChange={(e) => update({ image: e.target.value })}
            />
          </label>
          <label>
            Upload section image (Silo S3)
            <input
              type="file"
              accept="image/*"
              disabled={!canWrite || uploading}
              onChange={(e) => {
                const selected = e.target.files?.[0];
                e.target.value = "";
                void handleImageUpload(selected);
              }}
            />
          </label>
          {uploading ? (
            <small className="muted">Uploading image to Silo storage…</small>
          ) : null}
          {uploadError ? (
            <small className="danger" role="alert">
              {uploadError}
            </small>
          ) : null}

          {hasItems ? (
            <div className="form-stack">
              <div className="section-title" style={{ padding: 0 }}>
                <strong style={{ fontSize: 12 }}>
                  Items ({block.items?.length || 0})
                </strong>
                <Button
                  size="sm"
                  disabled={!canWrite}
                  onClick={() =>
                    update({
                      items: [
                        ...(block.items || []),
                        {
                          id: newId(),
                          title: "New item",
                          subtitle: "",
                          body: "Add supporting details here.",
                          image: "/media/terrain-hero.jpg",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={12} /> Add
                </Button>
              </div>

              {(block.items || []).map((entry, index) => (
                <div key={entry.id} className="property-item-card">
                  <div
                    className="button-row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <small className="muted">Item #{index + 1}</small>
                    <IconButton
                      label="Remove item"
                      disabled={!canWrite}
                      onClick={() =>
                        update({
                          items: block.items?.filter((it) => it.id !== entry.id),
                        })
                      }
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  </div>
                  <input
                    aria-label="Item title"
                    disabled={!canWrite}
                    value={entry.title}
                    onChange={(e) =>
                      update({
                        items: block.items?.map((it) =>
                          it.id === entry.id
                            ? { ...it, title: e.target.value }
                            : it
                        ),
                      })
                    }
                  />
                  <textarea
                    rows={2}
                    aria-label="Item body"
                    disabled={!canWrite}
                    value={entry.body}
                    onChange={(e) =>
                      update({
                        items: block.items?.map((it) =>
                          it.id === entry.id
                            ? { ...it, body: e.target.value }
                            : it
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {subTab === "layout" ? (
        <div className="form-stack">
          <label>
            Layout arrangement
            <select
              disabled={!canWrite}
              value={block.layout}
              onChange={(e) =>
                update({ layout: e.target.value as Block["layout"] })
              }
            >
              <option value="overlay">Image overlay</option>
              <option value="split">Two-column split</option>
              <option value="centered">Centered</option>
            </select>
          </label>
          <label>
            Section spacing
            <select
              disabled={!canWrite}
              value={block.spacing || "comfortable"}
              onChange={(e) =>
                update({ spacing: e.target.value as Block["spacing"] })
              }
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </label>
          {block.type === "Product Grid" ||
          block.type === "Best Sellers" ||
          block.type === "Featured Categories" ? (
            <label>
              Grid columns
              <select
                disabled={!canWrite}
                value={String(block.columns || 4)}
                onChange={(e) =>
                  update({ columns: Number(e.target.value) as 2 | 3 | 4 })
                }
              >
                <option value="2">2 columns</option>
                <option value="3">3 columns</option>
                <option value="4">4 columns</option>
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {subTab === "style" ? (
        <div className="form-stack">
          <label>
            Color palette
            <select
              disabled={!canWrite}
              value={block.tone}
              onChange={(e) =>
                update({ tone: e.target.value as Block["tone"] })
              }
            >
              <option value="forest">Forest (Signature)</option>
              <option value="ink">Ink (Dark premium)</option>
              <option value="light">Light neutral</option>
            </select>
          </label>
          <label>
            Headline typography scale
            <select
              disabled={!canWrite}
              value={block.scale}
              onChange={(e) =>
                update({ scale: e.target.value as Block["scale"] })
              }
            >
              <option value="regular">Regular</option>
              <option value="large">Large display</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
