"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ModelSelector } from "@/components/shared/ai-components";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiModelSettingsPanel } from "@/features/admin/ai-settings";
import {
  collectEditablePartsMap,
  getElementPart,
} from "@/features/builder/parts";
import {
  applyOperations,
  computeNodeDiffs,
  findNode,
  findNodePath,
  flattenTree,
  isContainerType,
  normalizeApiOperations,
} from "@/features/builder/operations";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { resolveStylesForViewport } from "@/features/builder/style-compiler";
import type {
  AiChatTurn,
  AiScopeMode,
  DiffRow,
  ElementNode,
} from "@/features/builder/types";
import {
  applyTypographyOperations,
  partitionAiOperations,
} from "@/features/typography/ai-operations";
import { normalizeGlobalTypography } from "@/features/typography/defaults";
import { useAiModels } from "@/hooks/use-ai-models";
import { aiAdminApi } from "@/lib/cms-ai-api";
import type { AIModelId } from "@/types/ai";
import type { EditorChatHistoryItem } from "@/types/api-cms-ai";

const SCOPE_OPTIONS: { value: AiScopeMode; label: string }[] = [
  { value: "element", label: "Element" },
  { value: "section", label: "Section" },
  { value: "page", label: "Entire Page" },
  { value: "typography", label: "Global Typography" },
];

function quickChipsForNode(
  node: ElementNode | null,
  partKey?: string | null,
  scope?: AiScopeMode
): string[] {
  if (scope === "typography") {
    return [
      "Use Playfair Display for headings and Inter for body",
      "Make all headings slightly smaller and use weight 600",
      "Make typography feel like a luxury editorial brand",
      "Increase body line height to 1.7 for readability",
    ];
  }
  if (node && partKey) {
    const partDef = getElementPart(node.type, partKey);
    if (partDef) {
      return [
        `Change ${partDef.label} text color`,
        `Round ${partDef.label} corners to 14px`,
        `Add subtle shadow to ${partDef.label}`,
        `Increase ${partDef.label} font size`,
      ];
    }
  }
  if (node && (node.type === "product_grid" || node.type === "product_carousel")) {
    return [
      "Round product cards 16px & light bg",
      "Make prices forest green #18794E",
      "Highlight Sale badges in amber",
      "Center titles & stack 2 cols on mobile",
    ];
  }
  if (node?.type === "form") {
    return [
      "Round inputs & soften borders",
      "Make submit button pill dark green",
      "Increase field label contrast",
      "Add spacious form spacing",
    ];
  }
  if (!node) {
    return [
      "Make the hero section look more premium",
      "Increase vertical padding across sections",
    ];
  }
  if (node.type === "heading" || node.type === "text_editor") {
    return [
      "Change text color to #2563eb",
      "Make the font size 56px",
      "Center align text",
      "Make this heading uppercase",
    ];
  }
  if (node.type === "button" || node.type === "add_to_cart") {
    return [
      "Make button larger with rounded corners",
      "Add a subtle shadow",
      "Use dark slate background",
    ];
  }
  if (isContainerType(node.type)) {
    return [
      "Make this section look more premium",
      "On mobile, stack cards vertically",
      "Change background to a dark blue gradient",
      "Increase top and bottom padding to 48px",
    ];
  }
  return [
    "Add 24px margin below this element",
    "Add a subtle shadow",
    "Center align",
  ];
}

export function FloatingAiBar({
  canUseAi,
  canWrite,
  onNotify,
}: {
  canUseAi: boolean;
  canWrite: boolean;
  onNotify: (msg: string) => void;
}) {
  const { models, defaultModelId } = useAiModels();
  const [selectedModel, setSelectedModel] = useState<AIModelId>(defaultModelId);
  const manualModelRef = useRef(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [threadCollapsed, setThreadCollapsed] = useState(false);

  const pageId = useEditorStore((s) => s.pageId);
  const pageSlug = useEditorStore((s) => s.pageSlug);
  const viewport = useEditorStore((s) => s.viewport);
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedPart = useEditorStore((s) => s.selectedPart);
  const themeTokens = useEditorStore((s) => s.themeTokens);
  const aiPreview = useEditorStore((s) => s.aiPreview);
  const lastAppliedAiCompare = useEditorStore((s) => s.lastAppliedAiCompare);
  const aiBarOpen = useEditorStore((s) => s.aiBarOpen);
  const prompt = useEditorStore((s) => s.aiDraftPrompt);
  const scope = useEditorStore((s) => s.aiScope);
  const aiChatByPage = useEditorStore((s) => s.aiChatByPage);

  const startAiPreview = useEditorStore((s) => s.startAiPreview);
  const setAiPreviewViewMode = useEditorStore((s) => s.setAiPreviewViewMode);
  const applyAiPreview = useEditorStore((s) => s.applyAiPreview);
  const revertAiPreview = useEditorStore((s) => s.revertAiPreview);
  const setLastAppliedCompareViewingBefore = useEditorStore(
    (s) => s.setLastAppliedCompareViewingBefore
  );
  const dismissLastAppliedCompare = useEditorStore(
    (s) => s.dismissLastAppliedCompare
  );
  const setAiBarOpen = useEditorStore((s) => s.setAiBarOpen);
  const setAiDraftPrompt = useEditorStore((s) => s.setAiDraftPrompt);
  const setAiScope = useEditorStore((s) => s.setAiScope);
  const appendAiChatTurn = useEditorStore((s) => s.appendAiChatTurn);
  const clearAiChatForPage = useEditorStore((s) => s.clearAiChatForPage);
  const selectNode = useEditorStore((s) => s.selectNode);
  const expandAncestors = useEditorStore((s) => s.expandAncestors);

  const pageKey = pageId || pageSlug || "home";
  const turns = useMemo(
    () => aiChatByPage[pageKey] ?? [],
    [aiChatByPage, pageKey]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!manualModelRef.current || !models.some((m) => m.id === selectedModel)) {
      setSelectedModel(defaultModelId);
    }
  }, [defaultModelId, models, selectedModel]);

  useEffect(() => {
    if (
      turns.length &&
      !threadCollapsed &&
      aiBarOpen &&
      typeof threadEndRef.current?.scrollIntoView === "function"
    ) {
      threadEndRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [turns.length, threadCollapsed, aiBarOpen]);

  const primaryNode = useMemo(() => {
    if (!selectedIds.length) return null;
    return findNode(nodes, selectedIds[0]);
  }, [nodes, selectedIds]);

  const effectiveScope: AiScopeMode =
    scope === "typography" ? "typography" : !primaryNode ? "page" : scope;

  const currentPropertyChips = useMemo(() => {
    if (!primaryNode) return [];
    const { resolved } = resolveStylesForViewport(primaryNode.styles, viewport);
    const entries: string[] = [];
    if (resolved.fontSize) entries.push(`Size: ${resolved.fontSize}`);
    if (resolved.fontWeight) entries.push(`Weight: ${resolved.fontWeight}`);
    if (resolved.color) entries.push(`Color: ${resolved.color}`);
    if (resolved.backgroundColor) entries.push(`Bg: ${resolved.backgroundColor}`);
    if (resolved.paddingTop || resolved.padding) {
      entries.push(`Pad: ${resolved.paddingTop || resolved.padding}`);
    }
    if (resolved.marginBottom) entries.push(`MB: ${resolved.marginBottom}`);
    return entries.slice(0, 4);
  }, [primaryNode, viewport]);

  const activePartKey =
    primaryNode && selectedPart?.nodeId === primaryNode.id
      ? selectedPart.partKey
      : null;
  const activePartDef =
    primaryNode && activePartKey
      ? getElementPart(primaryNode.type, activePartKey)
      : null;

  const quickChips = useMemo(
    () => quickChipsForNode(primaryNode, activePartKey, effectiveScope),
    [primaryNode, activePartKey, effectiveScope]
  );

  const suggestMutation = useMutation({
    mutationFn: async (vars: {
      userPrompt: string;
      targetNode: ElementNode | null;
      reqScope: AiScopeMode;
      reqSelectedIds: string[];
      reqSelectedPart: string | null;
      historyPayload: EditorChatHistoryItem[];
    }) => {
      const path = vars.targetNode ? findNodePath(nodes, vars.targetNode.id) : [];
      const rootSection = path[0] || null;
      const targetSubtree =
        vars.reqScope === "page"
          ? nodes
          : vars.reqScope === "section"
            ? rootSection || vars.targetNode
            : vars.reqSelectedIds.length > 1
              ? vars.reqSelectedIds
                  .map((id) => findNode(nodes, id))
                  .filter((n): n is ElementNode => n !== null)
              : vars.targetNode;
      const subtreeList = Array.isArray(targetSubtree)
        ? targetSubtree
        : targetSubtree
          ? [targetSubtree]
          : [];
      const editableParts = collectEditablePartsMap(subtreeList);

      const pageOutline = flattenTree(nodes).map((item) => ({
        id: item.node.id,
        type: item.node.type,
        label: item.node.label,
        depth: item.depth,
        parentId: item.parentId,
      }));

      return aiAdminApi.suggestEditorChanges({
        pageId: pageId || undefined,
        pageSlug,
        viewport,
        scope: vars.reqScope,
        selectedNodeIds:
          vars.reqScope === "section" && rootSection
            ? [rootSection.id]
            : vars.reqSelectedIds,
        prompt: vars.userPrompt,
        model: selectedModel,
        targetSubtree,
        pageOutline,
        themeTokens: themeTokens
          ? {
              ...themeTokens,
              typography: normalizeGlobalTypography(themeTokens.typography),
            }
          : undefined,
        history: vars.historyPayload,
        selectedPart: vars.reqSelectedPart || undefined,
        editableParts: Object.keys(editableParts).length
          ? editableParts
          : undefined,
      });
    },
    onSuccess: (res, vars) => {
      setErrorMsg(null);
      const partLabel = vars.targetNode && vars.reqSelectedPart
        ? getElementPart(vars.targetNode.type, vars.reqSelectedPart)?.label
        : undefined;
      const targetLabel =
        vars.reqScope === "typography"
          ? "Global Typography"
          : vars.targetNode
            ? `${vars.targetNode.label}${partLabel ? ` › ${partLabel}` : ""}`
            : `${pageSlug} (page)`;

      const { nodeOps, typographyOps } = partitionAiOperations(res.operations || []);
      const normalizedOps = nodeOps.length ? normalizeApiOperations(nodeOps) : [];
      const previewNodes = normalizedOps.length ? applyOperations(nodes, normalizedOps) : nodes;
      const nodeDiffs = normalizedOps.length ? computeNodeDiffs(nodes, previewNodes) : [];

      let previewThemeTokens = themeTokens;
      let affectedPresets: string[] = [];
      const typoDiffRows: DiffRow[] = [];
      if (typographyOps.length && themeTokens) {
        const applied = applyTypographyOperations(themeTokens, typographyOps);
        if (applied.diffs.length) {
          previewThemeTokens = applied.nextTokens;
          affectedPresets = applied.affectedPresets;
          for (const d of applied.diffs) {
            const arrowIdx = d.indexOf(" -> ");
            const colonIdx = d.indexOf(":");
            if (colonIdx > 0 && arrowIdx > colonIdx) {
              typoDiffRows.push({
                nodeId: "global-typography",
                nodeLabel: d.slice(0, colonIdx).trim(),
                field: "typography",
                before: d.slice(colonIdx + 1, arrowIdx).trim(),
                after: d.slice(arrowIdx + 4).trim(),
              });
            } else {
              typoDiffRows.push({
                nodeId: "global-typography",
                nodeLabel: "Global Typography",
                field: "token",
                before: "Current",
                after: d,
              });
            }
          }
        }
      }

      const diffs = [...nodeDiffs, ...typoDiffRows];
      const totalOps = normalizedOps.length + typographyOps.length;
      const turnId = `ai-turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (!totalOps || !diffs.length) {
        const message = !totalOps
          ? res.explanation ||
            "AI could not determine a concrete operation. Try specifying exact styles or wording."
          : "AI suggestion produced no visual change against the current state.";
        setErrorMsg(message);
        appendAiChatTurn(pageKey, {
          id: turnId,
          timestamp: new Date().toISOString(),
          prompt: vars.userPrompt,
          summary: res.summary || "No changes generated",
          explanation: message,
          model: res.model,
          scope: vars.reqScope,
          targetLabel,
          targetNodeIds: vars.reqSelectedIds,
          status: "error",
          diffCount: 0,
          error: message,
        });
        return;
      }

      const turn: AiChatTurn = {
        id: turnId,
        timestamp: new Date().toISOString(),
        prompt: vars.userPrompt,
        summary: res.summary,
        explanation: res.explanation,
        model: res.model,
        scope: vars.reqScope,
        targetLabel,
        targetNodeIds: res.targetNodeIds,
        status: "previewing",
        diffCount: diffs.length,
      };
      appendAiChatTurn(pageKey, turn);
      setThreadCollapsed(false);

      startAiPreview({
        turnId,
        prompt: vars.userPrompt,
        summary: res.summary,
        explanation: res.explanation,
        model: res.model,
        scope: vars.reqScope,
        targetNodeIds: res.targetNodeIds,
        operations: normalizedOps,
        typographyOperations: typographyOps,
        diffs,
        previewNodes,
        beforeNodes: nodes,
        beforeThemeTokens: themeTokens,
        previewThemeTokens: previewThemeTokens !== themeTokens ? previewThemeTokens : undefined,
        affectedPresets,
        viewMode: "after",
      });
    },
    onError: (err, vars) => {
      const msg = err instanceof Error ? err.message : "AI suggestion failed";
      setErrorMsg(msg);
      appendAiChatTurn(pageKey, {
        id: `ai-err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: vars.userPrompt,
        summary: "Request failed",
        model: selectedModel,
        scope: vars.reqScope,
        targetLabel: vars.targetNode
          ? vars.targetNode.label
          : `${pageSlug} (page)`,
        targetNodeIds: vars.reqSelectedIds,
        status: "error",
        diffCount: 0,
        error: msg,
      });
    },
  });

  const submitPrompt = (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || !canUseAi || !canWrite || suggestMutation.isPending) return;
    setAiDraftPrompt(trimmed);

    const historyPayload: EditorChatHistoryItem[] = [];
    for (const turn of turns.slice(-6)) {
      historyPayload.push({
        role: "user",
        content: turn.prompt,
        targetLabel: turn.targetLabel,
      });
      if (turn.summary || turn.explanation) {
        historyPayload.push({
          role: "assistant",
          content: [turn.summary, turn.explanation].filter(Boolean).join(" — "),
        });
      }
    }

    suggestMutation.mutate({
      userPrompt: trimmed,
      targetNode: primaryNode,
      reqScope: effectiveScope,
      reqSelectedIds: selectedIds,
      reqSelectedPart: activePartKey,
      historyPayload,
    });
  };

  if (!canUseAi) {
    return null;
  }

  if (!aiBarOpen) {
    return (
      <button
        type="button"
        className="ed-ai-minimized-pill"
        aria-label="Show AI chat"
        title="Open Contextual AI Chat"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setAiBarOpen(true);
        }}
      >
        <Sparkles size={13} />
        <span>AI Chat</span>
        {primaryNode ? (
          <Badge tone="neutral">{primaryNode.label}</Badge>
        ) : null}
        {aiPreview ? (
          <Badge tone="green">Preview active</Badge>
        ) : turns.length > 0 ? (
          <Badge tone="accent">{turns.length}</Badge>
        ) : null}
        <ChevronUp size={13} />
      </button>
    );
  }

  return (
    <div
      className="ed-floating-ai-dock"
      role="region"
      aria-label="Contextual AI Editor"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {aiPreview ? (
        <div className="ed-ai-preview-card">
          <div className="ed-ai-preview-head">
            <div className="ed-ai-preview-title">
              <Sparkles size={14} />
              <strong>{aiPreview.summary}</strong>
              <Badge tone="accent">{aiPreview.model}</Badge>
              {aiPreview.affectedPresets?.map((p) => (
                <Badge key={p} tone="neutral">
                  {p}
                </Badge>
              ))}
            </div>
            <div className="ed-ai-preview-actions">
              <div
                className="ed-ai-compare-toggle"
                role="group"
                aria-label="Compare before and after AI changes"
              >
                <button
                  type="button"
                  className={aiPreview.viewMode === "before" ? "active" : undefined}
                  onClick={() => setAiPreviewViewMode("before")}
                >
                  Before
                </button>
                <button
                  type="button"
                  className={aiPreview.viewMode !== "before" ? "active" : undefined}
                  onClick={() => setAiPreviewViewMode("after")}
                >
                  After
                </button>
              </div>
              <Button size="sm" onClick={revertAiPreview}>
                <RotateCcw size={12} /> Revert
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  inputRef.current?.focus();
                }}
              >
                Refine
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const summary = aiPreview.summary;
                  applyAiPreview();
                  onNotify(`Applied AI change: ${summary}`);
                }}
              >
                <Check size={12} /> Apply Changes
              </Button>
            </div>
          </div>

          {aiPreview.explanation ? (
            <p className="ed-ai-preview-desc">{aiPreview.explanation}</p>
          ) : null}

          <div className="ed-ai-diff-strip">
            {aiPreview.diffs.slice(0, 6).map((diff, i) => (
              <div
                key={`${diff.nodeId}-${diff.field}-${i}`}
                className="ed-ai-diff-pill"
              >
                <span className="ed-ai-diff-node">{diff.nodeLabel}</span>
                <code>{diff.field}</code>
                <span className="muted">{diff.before}</span>
                <span>→</span>
                <strong>{diff.after}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : !aiPreview && lastAppliedAiCompare ? (
        <div
          className="ed-ai-compare-strip"
          role="region"
          aria-label="Applied AI comparison"
        >
          <div className="ed-ai-compare-info">
            <Sparkles size={13} />
            <span>
              Applied: <strong>{lastAppliedAiCompare.summary}</strong>
            </span>
          </div>
          <div className="ed-ai-preview-actions">
            <div
              className="ed-ai-compare-toggle"
              role="group"
              aria-label="Compare applied AI before and after"
            >
              <button
                type="button"
                className={lastAppliedAiCompare.viewingBefore ? "active" : undefined}
                onClick={() => setLastAppliedCompareViewingBefore(true)}
              >
                Before
              </button>
              <button
                type="button"
                className={!lastAppliedAiCompare.viewingBefore ? "active" : undefined}
                onClick={() => setLastAppliedCompareViewingBefore(false)}
              >
                After
              </button>
            </div>
            <IconButton
              label="Dismiss comparison"
              title="Close Before/After compare bar"
              onClick={dismissLastAppliedCompare}
            >
              <X size={13} />
            </IconButton>
          </div>
        </div>
      ) : null}

      {turns.length > 0 ? (
        <div className="ed-ai-thread-card">
          <div className="ed-ai-thread-head">
            <span className="ed-ai-thread-label">
              <MessageSquare size={12} />
              <strong>Context History</strong>
              <Badge tone="neutral">{turns.length}</Badge>
            </span>
            <div className="ed-ai-thread-actions">
              <button
                type="button"
                className="ed-mini-link"
                onClick={() => setThreadCollapsed((v) => !v)}
              >
                {threadCollapsed ? "Expand" : "Collapse"}
              </button>
              <button
                type="button"
                className="ed-mini-link"
                aria-label="Clear AI chat history"
                onClick={() => clearAiChatForPage(pageKey)}
              >
                <Trash2 size={11} /> Clear
              </button>
            </div>
          </div>

          {!threadCollapsed ? (
            <div className="ed-ai-thread" role="log" aria-live="polite">
              {turns.map((turn) => (
                <div key={turn.id} className="ed-ai-turn">
                  <div className="ed-ai-turn-user">
                    <button
                      type="button"
                      className="ed-ai-turn-target"
                      title="Focus this target element on canvas"
                      disabled={!turn.targetNodeIds.length}
                      onClick={() => {
                        const targetId = turn.targetNodeIds[0];
                        if (targetId && findNode(nodes, targetId)) {
                          selectNode(targetId);
                          expandAncestors([targetId]);
                        }
                      }}
                    >
                      {turn.targetLabel}
                    </button>
                    <span className="ed-ai-turn-prompt">{turn.prompt}</span>
                    <Badge
                      tone={
                        turn.status === "applied"
                          ? "green"
                          : turn.status === "previewing"
                            ? "accent"
                            : "neutral"
                      }
                    >
                      {turn.status}
                    </Badge>
                  </div>
                  {turn.summary || turn.error ? (
                    <div className="ed-ai-turn-reply">
                      <span>{turn.error || turn.summary}</span>
                      <small className="muted"> · {turn.model}</small>
                    </div>
                  ) : null}
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ed-ai-bar">
        <div className="ed-ai-context-row">
          <div className="ed-ai-context-left">
            <span className="ed-ai-spark">
              <Wand2 size={13} />
            </span>
            {effectiveScope === "typography" ? (
              <strong className="ed-ai-target">
                Global Typography <small>store-wide tokens</small>
              </strong>
            ) : primaryNode ? (
              <strong className="ed-ai-target">
                {primaryNode.label}
                {activePartDef ? ` › ${activePartDef.label}` : ""}{" "}
                <small>
                  {activePartDef?.repeating ? "syncs all" : `#${primaryNode.type}`}
                </small>
              </strong>
            ) : (
              <strong className="ed-ai-target">
                {pageSlug} <small>entire page</small>
              </strong>
            )}
            <div className="ed-ai-prop-chips">
              {currentPropertyChips.map((chip) => (
                <span key={chip} className="ed-ai-prop-chip">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="ed-ai-context-right">
            <Select
              items={SCOPE_OPTIONS}
              value={effectiveScope}
              disabled={suggestMutation.isPending}
              onValueChange={(next) => {
                if (next) setAiScope(next as AiScopeMode);
              }}
            >
              <SelectTrigger
                aria-label="AI edit scope"
                size="sm"
                className="ed-ai-scope-trigger"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={!primaryNode && (opt.value === "element" || opt.value === "section")}
                  >
                    Scope: {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ModelSelector
              value={selectedModel}
              models={models}
              compact
              disabled={suggestMutation.isPending}
              onChange={(next) => {
                manualModelRef.current = true;
                setSelectedModel(next);
              }}
            />

            <IconButton
              label="Configure AI Models"
              title="AI Model Settings (select & reorder priority)"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={14} />
            </IconButton>

            <IconButton
              label="Hide AI chat"
              title="Hide AI chat bar"
              onClick={() => setAiBarOpen(false)}
            >
              <ChevronDown size={14} />
            </IconButton>
          </div>
        </div>

        <form
          className="ed-ai-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            submitPrompt();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            aria-label="Contextual AI prompt"
            placeholder={
              canWrite
                ? primaryNode
                  ? `Ask AI to style or modify "${primaryNode.label}"...`
                  : "Ask AI to improve this page..."
                : "Content write permission required"
            }
            disabled={!canWrite || suggestMutation.isPending}
            value={prompt}
            onChange={(e) => setAiDraftPrompt(e.target.value)}
          />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={!canWrite || !prompt.trim() || suggestMutation.isPending}
          >
            {suggestMutation.isPending ? (
              <>
                <LoaderCircle size={13} className="spin" /> Thinking...
              </>
            ) : (
              <>
                <Sparkles size={13} /> Generate
              </>
            )}
          </Button>
        </form>

        <div className="ed-ai-chips-row">
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={!canWrite || suggestMutation.isPending}
              className="ed-ai-quick-chip"
              onClick={() => submitPrompt(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        {errorMsg ? (
          <p className="ed-ai-error" role="alert">
            {errorMsg}
          </p>
        ) : null}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>AI Model Settings &amp; Priority</DialogTitle>
            <DialogDescription>
              Select which gateway models appear on the Floating AI Bar and order their priority (#1 is default).
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <AiModelSettingsPanel
              compact
              notify={onNotify}
              onSaved={(updated) => {
                manualModelRef.current = false;
                setSelectedModel(updated.defaultModelId);
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
