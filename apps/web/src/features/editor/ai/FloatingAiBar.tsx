"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Check,
  LoaderCircle,
  RotateCcw,
  Settings2,
  Sparkles,
  Wand2,
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
import type { ElementNode } from "@/features/builder/types";
import { useAiModels } from "@/hooks/use-ai-models";
import { aiAdminApi } from "@/lib/cms-ai-api";
import type { AIModelId } from "@/types/ai";

type AiScope = "element" | "section" | "page";

const SCOPE_OPTIONS: { value: AiScope; label: string }[] = [
  { value: "element", label: "Element" },
  { value: "section", label: "Section" },
  { value: "page", label: "Entire Page" },
];

function quickChipsForNode(node: ElementNode | null): string[] {
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

  const [scope, setScope] = useState<AiScope>("element");
  const [prompt, setPrompt] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pageId = useEditorStore((s) => s.pageId);
  const pageSlug = useEditorStore((s) => s.pageSlug);
  const viewport = useEditorStore((s) => s.viewport);
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const themeTokens = useEditorStore((s) => s.themeTokens);
  const aiPreview = useEditorStore((s) => s.aiPreview);
  const startAiPreview = useEditorStore((s) => s.startAiPreview);
  const applyAiPreview = useEditorStore((s) => s.applyAiPreview);
  const revertAiPreview = useEditorStore((s) => s.revertAiPreview);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!manualModelRef.current || !models.some((m) => m.id === selectedModel)) {
      setSelectedModel(defaultModelId);
    }
  }, [defaultModelId, models, selectedModel]);

  const primaryNode = useMemo(() => {
    if (!selectedIds.length) return null;
    return findNode(nodes, selectedIds[0]);
  }, [nodes, selectedIds]);

  const effectiveScope: AiScope = !primaryNode ? "page" : scope;

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

  const quickChips = useMemo(() => quickChipsForNode(primaryNode), [primaryNode]);

  const suggestMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      const path = primaryNode ? findNodePath(nodes, primaryNode.id) : [];
      const rootSection = path[0] || null;
      const targetSubtree =
        effectiveScope === "page"
          ? nodes
          : effectiveScope === "section"
            ? rootSection || primaryNode
            : primaryNode;

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
        scope: effectiveScope,
        selectedNodeIds:
          effectiveScope === "section" && rootSection
            ? [rootSection.id]
            : selectedIds,
        prompt: userPrompt,
        model: selectedModel,
        targetSubtree,
        pageOutline,
        themeTokens: themeTokens || undefined,
      });
    },
    onSuccess: (res) => {
      setErrorMsg(null);
      if (!res.operations.length) {
        setErrorMsg(
          res.explanation ||
            "AI could not determine a concrete operation. Try specifying exact styles or wording."
        );
        return;
      }
      const normalizedOps = normalizeApiOperations(res.operations);
      const previewNodes = applyOperations(nodes, normalizedOps);
      const diffs = computeNodeDiffs(nodes, previewNodes);
      if (!diffs.length) {
        setErrorMsg("AI suggestion produced no visual change against the current state.");
        return;
      }
      startAiPreview({
        prompt,
        summary: res.summary,
        explanation: res.explanation,
        model: res.model,
        scope: effectiveScope,
        targetNodeIds: res.targetNodeIds,
        operations: normalizedOps,
        diffs,
        previewNodes,
        beforeNodes: nodes,
      });
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : "AI suggestion failed");
    },
  });

  const submitPrompt = (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || !canUseAi || !canWrite || suggestMutation.isPending) return;
    setPrompt(trimmed);
    suggestMutation.mutate(trimmed);
  };

  if (!canUseAi) {
    return null;
  }

  return (
    <div className="ed-floating-ai-dock" role="region" aria-label="Contextual AI Editor">
      {aiPreview ? (
        <div className="ed-ai-preview-card">
          <div className="ed-ai-preview-head">
            <div className="ed-ai-preview-title">
              <Sparkles size={14} />
              <strong>{aiPreview.summary}</strong>
              <Badge tone="accent">{aiPreview.model}</Badge>
            </div>
            <div className="ed-ai-preview-actions">
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
                  applyAiPreview();
                  onNotify(`Applied AI change: ${aiPreview.summary}`);
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
              <div key={`${diff.nodeId}-${diff.field}-${i}`} className="ed-ai-diff-pill">
                <span className="ed-ai-diff-node">{diff.nodeLabel}</span>
                <code>{diff.field}</code>
                <span className="muted">{diff.before}</span>
                <span>→</span>
                <strong>{diff.after}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ed-ai-bar">
        <div className="ed-ai-context-row">
          <div className="ed-ai-context-left">
            <span className="ed-ai-spark">
              <Wand2 size={13} />
            </span>
            {primaryNode ? (
              <strong className="ed-ai-target">
                {primaryNode.label} <small>#{primaryNode.type}</small>
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
              disabled={!primaryNode || suggestMutation.isPending}
              onValueChange={(next) => {
                if (next) setScope(next as AiScope);
              }}
            >
              <SelectTrigger aria-label="AI edit scope" size="sm" className="ed-ai-scope-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
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
            onChange={(e) => setPrompt(e.target.value)}
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
