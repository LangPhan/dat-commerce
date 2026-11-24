"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { ViewportMode } from "@/features/builder/types";
import { cn } from "@/lib/format";
import { GlobalTypographyStyleTag } from "../GlobalTypographyStyleTag";
import {
  DEFAULT_PREVIEW_SAMPLES,
  PRESET_CATEGORY_LABELS,
  getOrderedPresetList,
  normalizeGlobalTypography,
} from "../defaults";
import { resolvePresetValuesForViewport } from "../resolve";
import type { GlobalTypographyTokens, NormalizedGlobalTypography } from "../types";

export function TypographyPreviewPanel({
  typography,
  colors,
  viewport,
  onViewportChange,
  selectedPresetId,
  onSelectPreset,
  affectedPresets,
  compact = false,
}: {
  typography: GlobalTypographyTokens | NormalizedGlobalTypography;
  colors?: { background?: string; surface?: string; text?: string; muted?: string; primary?: string; border?: string };
  viewport: ViewportMode;
  onViewportChange: (vp: ViewportMode) => void;
  selectedPresetId?: string;
  onSelectPreset?: (presetId: string) => void;
  affectedPresets?: string[];
  compact?: boolean;
}) {
  const normalized = normalizeGlobalTypography(typography);
  const presets = getOrderedPresetList(normalized.presets);
  const affectedSet = new Set(affectedPresets || []);

  const previewWidthClass =
    viewport === "mobile"
      ? "max-w-[390px]"
      : viewport === "tablet"
        ? "max-w-[768px]"
        : "max-w-full";

  return (
    <div className="typo-preview-shell">
      <GlobalTypographyStyleTag
        typography={normalized}
        scopeId={compact ? "preview-compact" : "preview-full"}
        scopeSelector={compact ? ".typo-preview-stage-compact" : ".typo-preview-stage-full"}
        forceViewport={viewport}
      />
      <div className="typo-preview-toolbar">
        <div className="typo-preview-toolbar-title">
          <strong>Live Storefront Typography Preview</strong>
          <span>Real-time specimen rendered with CSS variables</span>
        </div>
        <div className="typo-viewport-toggle" role="group" aria-label="Preview viewport">
          {(
            [
              ["desktop", "Desktop", Monitor],
              ["tablet", "Tablet", Tablet],
              ["mobile", "Mobile", Smartphone],
            ] as const
          ).map(([vp, label, Icon]) => (
            <button
              key={vp}
              type="button"
              className={cn("typo-vp-btn", viewport === vp && "active")}
              onClick={() => onViewportChange(vp)}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="typo-preview-scroll">
        <div
          className={cn(
            compact ? "typo-preview-stage-compact" : "typo-preview-stage-full",
            "typo-preview-canvas",
            previewWidthClass
          )}
          style={{
            background: colors?.background || "#FFFFFF",
            color: colors?.text || "#111318",
            borderColor: colors?.border || "#E5E7EB",
          }}
        >
          {presets.map((preset) => {
            const resolved = resolvePresetValuesForViewport(
              preset,
              normalized,
              viewport
            );
            const sample =
              DEFAULT_PREVIEW_SAMPLES[preset.id] ||
              `${preset.name} — Engineered for performance and timeless form.`;
            const isSelected = selectedPresetId === preset.id;
            const isAiAffected = affectedSet.has(preset.id);

            return (
              <div
                key={preset.id}
                role={onSelectPreset ? "button" : undefined}
                tabIndex={onSelectPreset ? 0 : undefined}
                className={cn(
                  "typo-preview-row",
                  isSelected && "selected",
                  isAiAffected && "ai-affected"
                )}
                onClick={() => onSelectPreset?.(preset.id)}
                onKeyDown={(e) => {
                  if (onSelectPreset && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelectPreset(preset.id);
                  }
                }}
              >
                <div className="typo-preview-row-meta">
                  <span className="typo-preview-name">
                    {preset.name}
                    <small>{PRESET_CATEGORY_LABELS[preset.category]}</small>
                  </span>
                  <span className="typo-preview-specs">
                    {resolved.fontFamilyName} · {resolved.fontSize} · w
                    {resolved.fontWeight} · lh {resolved.lineHeight} · ls{" "}
                    {resolved.letterSpacing}
                  </span>
                </div>
                <div
                  data-typography-preset={preset.id}
                  className={cn(
                    "typo-preview-sample",
                    preset.id === "button" && "is-btn-sample"
                  )}
                  style={
                    preset.id === "button"
                      ? {
                          background: colors?.primary || "#5B46E8",
                          color: "#FFFFFF",
                        }
                      : preset.id === "link" && !preset.color
                        ? { color: colors?.primary || "#5B46E8" }
                        : undefined
                  }
                >
                  {sample}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
