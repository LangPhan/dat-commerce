"use client";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Globe2,
  Monitor,
  PanelLeft,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import { StoreBlock } from "@/features/storefront/blocks";
import { StoreHeader } from "@/features/storefront/header-footer";
import { cn } from "@/lib/format";
import { pagePaths } from "@/mocks/pages";
import type { Product } from "@/types/commerce";
import type { Block, Proposal, ViewportMode } from "@/types/editor";
import { SectionIcon } from "./structure-panel";

const viewportMeta: Record<ViewportMode, { label: string; width: string }> = {
  desktop: { label: "Desktop", width: "1320px" },
  tablet: { label: "Tablet", width: "768px" },
  mobile: { label: "Mobile", width: "390px" },
};

export function EditorCanvas({
  page,
  mode,
  setMode,
  preview,
  setPreview,
  showBlocks,
  selectedBlock,
  activeProposal,
  isPublished,
  dirty,
  ready,
  catalog,
  select,
  move,
  duplicate,
  toggleVisibility,
  requestDelete,
  focusAI,
  saveDraft,
  openPanel,
  openCommand,
  acceptProposal,
  rejectProposal,
}: {
  page: string;
  mode: ViewportMode;
  setMode: (m: ViewportMode) => void;
  preview: "page" | "proposal" | null;
  setPreview: (p: "page" | "proposal" | null) => void;
  showBlocks: Block[];
  selectedBlock: Block | undefined;
  activeProposal: Proposal | null;
  isPublished: boolean;
  dirty: boolean;
  ready: boolean;
  catalog: Product[];
  select: (id: string) => void;
  move: (offset: number) => void;
  duplicate: () => void;
  toggleVisibility: () => void;
  requestDelete: () => void;
  focusAI: () => void;
  saveDraft: () => void;
  openPanel: (p: "structure" | "inspector") => void;
  openCommand: () => void;
  acceptProposal: () => void;
  rejectProposal: () => void;
}) {
  const statusLabel =
    preview === "page"
      ? "Preview"
      : dirty
        ? "Unsaved changes"
        : isPublished
          ? "Published"
          : "Draft";

  const statusTone =
    preview === "page"
      ? "accent"
      : dirty
        ? "amber"
        : isPublished
          ? "green"
          : "neutral";

  return (
    <main className="editor-main">
      <div className="canvas-toolbar">
        <div className="canvas-page">
          <IconButton
            className="panel-toggle"
            label="Toggle sections"
            onClick={() => openPanel("structure")}
          >
            <PanelLeft size={17} />
          </IconButton>
          <Globe2 size={15} />
          <strong>{page}</strong>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>

        <div className="viewport" aria-label="Preview viewport">
          {(
            [
              [Monitor, "desktop"],
              [Tablet, "tablet"],
              [Smartphone, "mobile"],
            ] as const
          ).map(([Icon, device]) => (
            <IconButton
              key={device}
              label={`${viewportMeta[device].label} (${viewportMeta[device].width})`}
              aria-pressed={mode === device}
              className={mode === device ? "active" : ""}
              onClick={() => setMode(device)}
            >
              <Icon size={15} />
            </IconButton>
          ))}
        </div>

        <div className="canvas-actions">
          <IconButton
            className="panel-toggle"
            label="Toggle inspector"
            onClick={() => openPanel("inspector")}
          >
            <Sparkles size={16} />
          </IconButton>
          <Button
            className="save-draft"
            onClick={saveDraft}
            disabled={!ready || !dirty}
          >
            Save draft
          </Button>
          <IconButton label="Command palette" onClick={openCommand}>
            <ChevronDown size={15} />
          </IconButton>
        </div>
      </div>

      {preview === "proposal" && activeProposal ? (
        <div className="proposal-banner" role="status">
          <span className="inline-label">
            <Sparkles size={14} /> Previewing AI proposal: {activeProposal.title}
          </span>
          <div className="button-row">
            <Button size="sm" onClick={rejectProposal}>
              Reject
            </Button>
            <Button size="sm" variant="primary" onClick={acceptProposal}>
              <Check size={13} /> Accept changes
            </Button>
            <IconButton label="Exit change preview" onClick={() => setPreview(null)}>
              <X size={14} />
            </IconButton>
          </div>
        </div>
      ) : null}

      <div className="canvas-scroll">
        <div className={cn("canvas-inner", `viewport-${mode}`)}>
          <div className="frame-label">
            <span>
              <Monitor size={13} /> {viewportMeta[mode].label} ·{" "}
              {viewportMeta[mode].width}
            </span>
            {preview === "page" ? (
              <button type="button" onClick={() => setPreview(null)}>
                Exit preview <X size={12} />
              </button>
            ) : (
              <Link href={pagePaths[page] || "/store"} target="_blank">
                Open live storefront <ArrowUpRight size={13} />
              </Link>
            )}
          </div>

          <div className="store editor-store">
            <StoreHeader preview={preview !== "page"} />
            {showBlocks
              .filter((item) =>
                preview === "page"
                  ? item.visible
                  : item.visible || item.id === selectedBlock?.id
              )
              .map((item, idx, arr) => {
                const isSelected =
                  preview !== "page" &&
                  (preview === "proposal"
                    ? item.id === activeProposal?.target
                    : item.id === selectedBlock?.id);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "editable-block",
                      isSelected && "selected-block",
                      !item.visible && "off-block"
                    )}
                  >
                    {preview !== "page" ? (
                      <button
                        type="button"
                        className="select-block"
                        aria-label={`Select ${item.label}`}
                        aria-pressed={item.id === selectedBlock?.id}
                        onClick={() => select(item.id)}
                      />
                    ) : null}

                    {preview !== "page" ? (
                      <div className="selection-bar">
                        <SectionIcon kind={item.type} size={12} />
                        <span>
                          {item.label} · {item.type}
                          {!item.visible ? " (Hidden)" : ""}
                        </span>

                        {isSelected ? (
                          <div className="selection-bar-actions">
                            <button
                              type="button"
                              aria-label="Ask AI about this section"
                              title="Ask AI"
                              onClick={focusAI}
                            >
                              <Sparkles size={11} />
                            </button>
                            <button
                              type="button"
                              aria-label="Move section up"
                              disabled={idx === 0}
                              onClick={() => move(-1)}
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              aria-label="Move section down"
                              disabled={idx === arr.length - 1}
                              onClick={() => move(1)}
                            >
                              <ArrowDown size={11} />
                            </button>
                            <button
                              type="button"
                              aria-label="Duplicate section"
                              onClick={duplicate}
                            >
                              <Copy size={11} />
                            </button>
                            <button
                              type="button"
                              aria-label="Toggle visibility"
                              onClick={toggleVisibility}
                            >
                              {item.visible ? (
                                <Eye size={11} />
                              ) : (
                                <EyeOff size={11} />
                              )}
                            </button>
                            <button
                              type="button"
                              aria-label="Delete section"
                              onClick={requestDelete}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <StoreBlock block={item} catalog={catalog} />
                  </div>
                );
              })}

            {!showBlocks.length ? (
              <Empty
                title="This page has no sections"
                text="Add a reusable section from the structure panel to start building."
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
