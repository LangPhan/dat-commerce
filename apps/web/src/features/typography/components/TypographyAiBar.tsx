"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Eye, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ViewportMode } from "@/features/builder/types";
import { aiAdminApi } from "@/lib/cms-ai-api";
import type { ThemeTokens } from "@/types/api-cms-ai";
import { applyTypographyOperations, partitionAiOperations } from "../ai-operations";

const QUICK_PROMPTS = [
  "Use Playfair Display for headings and Inter for body",
  "Make all headings slightly smaller and use a medium font weight",
  "Make typography feel like a luxury editorial brand",
];

export type TypographyAiPreviewState = {
  prompt: string;
  summary: string;
  explanation: string;
  model: string;
  diffs: string[];
  affectedPresets: string[];
  beforeTokens: ThemeTokens;
  previewTokens: ThemeTokens;
  viewMode: "after" | "before";
};

export function TypographyAiBar({
  tokens,
  viewport,
  disabled,
  aiPreview,
  onStartPreview,
  onToggleViewMode,
  onApplyPreview,
  onRejectPreview,
  onUndoLastAi,
  canUndo,
}: {
  tokens: ThemeTokens;
  viewport: ViewportMode;
  disabled?: boolean;
  aiPreview: TypographyAiPreviewState | null;
  onStartPreview: (preview: TypographyAiPreviewState) => void;
  onToggleViewMode: (viewMode: "before" | "after") => void;
  onApplyPreview: () => void;
  onRejectPreview: () => void;
  onUndoLastAi?: () => void;
  canUndo?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const aiSettingsQuery = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: () => aiAdminApi.getSettings(),
    staleTime: 60_000,
  });

  const suggestMutation = useMutation({
    mutationFn: (text: string) =>
      aiAdminApi.suggestEditorChanges({
        pageSlug: "theme",
        viewport,
        scope: "typography",
        prompt: text,
        model: aiSettingsQuery.data?.defaultModelId,
        themeTokens: tokens,
      }),
    onSuccess: (res, text) => {
      setError(null);
      const { typographyOps } = partitionAiOperations(res.operations || []);
      if (!typographyOps.length) {
        setError(
          res.explanation ||
            "AI did not emit any global typography changes. Try naming specific presets or fonts."
        );
        return;
      }
      const applied = applyTypographyOperations(tokens, typographyOps);
      if (!applied.diffs.length) {
        setError("AI suggestion made no changes against current typography.");
        return;
      }
      onStartPreview({
        prompt: text,
        summary: res.summary,
        explanation: res.explanation,
        model: res.model,
        diffs: applied.diffs,
        affectedPresets: applied.affectedPresets,
        beforeTokens: tokens,
        previewTokens: applied.nextTokens,
        viewMode: "after",
      });
      setPrompt("");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "AI typography request failed");
    },
  });

  const submit = (text = prompt) => {
    const clean = text.trim();
    if (!clean || disabled || suggestMutation.isPending) return;
    setError(null);
    suggestMutation.mutate(clean);
  };

  return (
    <div className="typo-ai-shell">
      <div className="typo-ai-row">
        <div className="typo-ai-input-wrap">
          <Sparkles size={14} className="typo-ai-icon" />
          <input
            type="text"
            disabled={disabled || suggestMutation.isPending}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder='Describe a global typography change (e.g. "Use Playfair Display for headings and Inter for body")...'
            className="typo-ai-input"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={disabled || !prompt.trim() || suggestMutation.isPending}
          onClick={() => submit()}
        >
          {suggestMutation.isPending ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <span>Ask AI</span>
          )}
        </Button>
        {canUndo && onUndoLastAi && !aiPreview ? (
          <Button type="button" size="sm" onClick={onUndoLastAi}>
            <RotateCcw size={12} />
            <span>Undo</span>
          </Button>
        ) : null}
      </div>

      {!aiPreview ? (
        <div className="typo-ai-chips">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={disabled || suggestMutation.isPending}
              className="typo-ai-chip"
              onClick={() => submit(q)}
            >
              {q}
            </button>
          ))}
        </div>
      ) : (
        <div className="typo-ai-preview-banner">
          <div className="typo-ai-preview-head">
            <div className="typo-ai-preview-title">
              <strong>AI Preview: {aiPreview.summary}</strong>
              {aiPreview.affectedPresets.length ? (
                <div className="typo-ai-affected">
                  {aiPreview.affectedPresets.map((p) => (
                    <Badge key={p} tone="accent">
                      {p}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="typo-ai-preview-actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  onToggleViewMode(
                    aiPreview.viewMode === "after" ? "before" : "after"
                  )
                }
              >
                <Eye size={12} />
                <span>
                  {aiPreview.viewMode === "after" ? "Viewing After" : "Viewing Before"}
                </span>
              </button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={onApplyPreview}
              >
                <Check size={12} />
                <span>Apply Changes</span>
              </Button>
              <Button type="button" size="sm" onClick={onRejectPreview}>
                <X size={12} />
                <span>Reject</span>
              </Button>
            </div>
          </div>
          {aiPreview.explanation ? (
            <p className="typo-ai-explanation">{aiPreview.explanation}</p>
          ) : null}
          <ul className="typo-ai-diffs">
            {aiPreview.diffs.slice(0, 8).map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {error ? <div className="typo-ai-error">{error}</div> : null}
    </div>
  );
}
