"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";
import { ModelSelector } from "@/components/shared/ai-components";
import { Button, IconButton } from "@/components/ui/button";
import { useAiModels } from "@/hooks/use-ai-models";
import type { AIModelId } from "@/types/ai";
import { experienceAdminApi } from "../api";
import { useExperienceStudioStore } from "./experience-store";

const QUICK_PROMPTS = [
  "Design a Christmas experience with Santa sleigh, lights & snow",
  "Lunar New Year with fireworks, peach blossoms & red lanterns",
  "Black Friday dark luxe mode with golden particles",
  "Add a live Flash Sale countdown bar & golden sparks",
  "Make the particles gentler and slower",
];

export function ExperienceAiBar({
  onNotify,
}: {
  onNotify: (msg: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [expanded, setExpanded] = useState(false);

  const {
    models,
    defaultModelId,
    isLoading: modelsLoading,
  } = useAiModels();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const activeModel = (selectedModel || defaultModelId || "claude-sonnet-4") as AIModelId;

  const experienceId = useExperienceStudioStore((s) => s.experienceId);
  const config = useExperienceStudioStore((s) => s.config);
  const aiBarOpen = useExperienceStudioStore((s) => s.aiBarOpen);
  const aiHistory = useExperienceStudioStore((s) => s.aiHistory);
  const aiPreview = useExperienceStudioStore((s) => s.aiPreview);

  const toggleAiBar = useExperienceStudioStore((s) => s.toggleAiBar);
  const pushAiChatTurn = useExperienceStudioStore((s) => s.pushAiChatTurn);
  const clearAiChat = useExperienceStudioStore((s) => s.clearAiChat);
  const setAiPreview = useExperienceStudioStore((s) => s.setAiPreview);
  const toggleAiPreviewMode = useExperienceStudioStore((s) => s.toggleAiPreviewMode);
  const applyAiPreview = useExperienceStudioStore((s) => s.applyAiPreview);
  const discardAiPreview = useExperienceStudioStore((s) => s.discardAiPreview);

  const designMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      const beforeConfig = structuredClone(
        useExperienceStudioStore.getState().config
      );
      const historyPayload = useExperienceStudioStore
        .getState()
        .aiHistory.slice(-8)
        .map((t) => ({ role: t.role, content: t.content }));

      const res = await experienceAdminApi.aiDesign({
        experienceId: experienceId || undefined,
        prompt: userPrompt,
        model: activeModel,
        currentConfig: beforeConfig,
        history: historyPayload,
      });
      return { res, beforeConfig, userPrompt };
    },
    onSuccess: ({ res, beforeConfig, userPrompt }) => {
      pushAiChatTurn({
        id: `u-${Date.now()}`,
        role: "user",
        content: userPrompt,
      });
      pushAiChatTurn({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.explanation || res.summary,
        summary: res.summary,
        operations: res.operations,
        model: res.model,
        latencyMs: res.latencyMs,
      });
      setAiPreview({
        beforeConfig,
        proposedConfig: res.proposedConfig,
        summary: res.summary,
        explanation: res.explanation,
        operations: res.operations,
      });
      setPrompt("");
      setExpanded(true);
    },
    onError: (err) => {
      onNotify(err instanceof Error ? err.message : "AI design request failed");
    },
  });

  if (!aiBarOpen) return null;

  const submitPrompt = (text?: string) => {
    const clean = (text ?? prompt).trim();
    if (!clean || designMutation.isPending) return;
    designMutation.mutate(clean);
  };

  return (
    <div className="ed-ai-bar exp-ai-bar" role="region" aria-label="AI Experience Creative Director">
      {aiPreview ? (
        <div className="exp-ai-diff-banner">
          <div className="exp-ai-diff-info">
            <Sparkles size={14} />
            <div>
              <strong>{aiPreview.summary}</strong>
              <small>
                {aiPreview.operations.length} change(s) · {aiPreview.explanation}
              </small>
            </div>
          </div>
          <div className="exp-ai-diff-actions">
            <div className="ed-viewport-seg">
              <button
                type="button"
                className={`exp-route-btn${aiPreview.viewMode === "before" ? " active" : ""}`}
                onClick={() => toggleAiPreviewMode("before")}
              >
                Before
              </button>
              <button
                type="button"
                className={`exp-route-btn${aiPreview.viewMode === "after" ? " active" : ""}`}
                onClick={() => toggleAiPreviewMode("after")}
              >
                After
              </button>
            </div>
            <Button size="sm" onClick={discardAiPreview}>
              <RotateCcw size={12} /> Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                applyAiPreview();
                onNotify("Applied AI seasonal design to draft");
              }}
            >
              <Check size={12} /> Apply Design
            </Button>
          </div>
        </div>
      ) : null}

      {expanded && aiHistory.length > 0 ? (
        <div className="exp-ai-history">
          <div className="exp-ai-history-head">
            <span>AI Design Conversation</span>
            <button type="button" onClick={clearAiChat} title="Clear chat">
              <Trash2 size={12} /> Clear
            </button>
          </div>
          <div className="exp-ai-turns">
            {aiHistory.map((t) => (
              <div key={t.id} className={`exp-ai-turn role-${t.role}`}>
                <strong>{t.role === "user" ? "You" : "Creative Director AI"}</strong>
                <p>{t.content}</p>
                {t.operations?.length ? (
                  <ul>
                    {t.operations.map((op, i) => (
                      <li key={i}>{op.description || `${op.type} ${op.targetId}`}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="exp-ai-chips">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            className="exp-ai-chip"
            disabled={designMutation.isPending}
            onClick={() => submitPrompt(q)}
          >
            <Wand2 size={11} />
            <span>{q}</span>
          </button>
        ))}
      </div>

      <form
        className="exp-ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          submitPrompt();
        }}
      >
        <div className="exp-ai-model">
          <ModelSelector
            models={models}
            value={activeModel}
            onChange={(m) => setSelectedModel(m)}
            disabled={modelsLoading || designMutation.isPending}
            compact
          />
        </div>

        <input
          type="text"
          className="exp-ai-input"
          placeholder={`Ask AI to design or refine "${config.layers.length} layer(s)" (e.g. "Add falling snow and a 24h flash sale countdown")...`}
          value={prompt}
          disabled={designMutation.isPending}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="exp-ai-controls">
          {aiHistory.length > 0 ? (
            <IconButton
              label={expanded ? "Collapse chat" : "Expand chat"}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </IconButton>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!prompt.trim() || designMutation.isPending}
          >
            {designMutation.isPending ? (
              <>
                <LoaderCircle size={13} className="spin" />
                <span>Designing...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Design</span>
              </>
            )}
          </Button>
          <IconButton label="Hide AI bar" onClick={() => toggleAiBar(false)}>
            <X size={14} />
          </IconButton>
        </div>
      </form>
    </div>
  );
}
