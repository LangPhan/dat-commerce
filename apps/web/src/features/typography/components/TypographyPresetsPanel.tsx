"use client";

import {
  AlertTriangle,
  Copy,
  Monitor,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ViewportMode } from "@/features/builder/types";
import { getBrandPaletteOptions } from "@/features/editor/brand-palette";
import {
  ColorControl,
  SelectControl,
  UnitControl,
} from "@/features/editor/inspector-controls";
import { cn } from "@/lib/format";
import type { ThemeTokens } from "@/types/api-cms-ai";
import { evaluatePresetAccessibility } from "../accessibility";
import {
  DEFAULT_PREVIEW_SAMPLES,
  DEFAULT_TYPOGRAPHY_PRESETS,
  FONT_ROLE_METADATA,
  PRESET_CATEGORY_LABELS,
  createCustomPreset,
  getOrderedPresetList,
  resetSinglePreset,
} from "../defaults";
import { BUILTIN_FONT_NAMES } from "../font-catalog";
import {
  resetResponsiveMetricViewport,
  resolvePresetValuesForViewport,
  updateResponsiveMetricValue,
} from "../resolve";
import type {
  NormalizedGlobalTypography,
  PresetCategory,
  TypographyFontRole,
  TypographyPreset,
} from "../types";

const WEIGHT_SELECT_ITEMS = [100, 200, 300, 400, 500, 600, 700, 800, 900].map(
  (w) => ({ value: String(w), label: String(w) })
);

function PresetPopoverRow({
  title,
  summary,
  disabled,
  badge,
  children,
}: {
  title: string;
  summary: string;
  disabled?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <div className="typo-prop-row">
        <div className="typo-prop-meta">
          <div className="typo-prop-title-line">
            <strong>{title}</strong>
            {badge ? <Badge tone="accent">{badge}</Badge> : null}
          </div>
          <span className="typo-prop-summary">{summary}</span>
        </div>
        <PopoverTrigger disabled={disabled} className="btn btn-sm">
          <SlidersHorizontal size={12} />
          <span>Edit</span>
        </PopoverTrigger>
      </div>
      <PopoverContent side="bottom" align="end" className="w-[330px]">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{summary}</PopoverDescription>
        </PopoverHeader>
        <div className="typo-pop-stack">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function TypographyPresetsPanel({
  tokens,
  typography,
  selectedPresetId,
  onSelectPreset,
  viewport,
  onViewportChange,
  disabled,
  onChangeTypography,
  onAddBrandColor,
  onNotify,
}: {
  tokens: ThemeTokens;
  typography: NormalizedGlobalTypography;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  viewport: ViewportMode;
  onViewportChange: (vp: ViewportMode) => void;
  disabled?: boolean;
  onChangeTypography: (
    next: NormalizedGlobalTypography,
    summary: string,
    meta?: { presetId?: string; breakpoint?: ViewportMode | "all" }
  ) => void;
  onAddBrandColor?: (name: string, hex: string) => void;
  onNotify?: (msg: string) => void;
}) {
  const [newPresetName, setNewPresetName] = useState("");
  const [newBaseId, setNewBaseId] = useState("h3");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);

  const orderedPresets = getOrderedPresetList(typography.presets);
  const activePreset =
    typography.presets[selectedPresetId] || orderedPresets[0];
  const resolved = resolvePresetValuesForViewport(
    activePreset,
    typography,
    viewport
  );
  const palette = getBrandPaletteOptions(tokens);
  const warnings = evaluatePresetAccessibility(
    activePreset,
    typography,
    tokens.colors,
    viewport
  );

  const updateActivePreset = (
    updater: (prev: TypographyPreset) => TypographyPreset,
    summary: string
  ) => {
    const updated = updater(activePreset);
    onChangeTypography(
      {
        ...typography,
        presets: { ...typography.presets, [activePreset.id]: updated },
      },
      summary,
      { presetId: activePreset.id, breakpoint: viewport }
    );
  };

  const handleCreatePreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    const base = typography.presets[newBaseId] || activePreset;
    const created = createCustomPreset(trimmed, base, typography.presets);
    onChangeTypography(
      {
        ...typography,
        presets: { ...typography.presets, [created.id]: created },
      },
      `Create preset ${created.name}`,
      { presetId: created.id, breakpoint: "all" }
    );
    onSelectPreset(created.id);
    setNewPresetName("");
    setCreateOpen(false);
    onNotify?.(`Created custom preset "${created.name}"`);
  };

  const handleDuplicatePreset = () => {
    const created = createCustomPreset(
      `${activePreset.name} Copy`,
      activePreset,
      typography.presets
    );
    onChangeTypography(
      {
        ...typography,
        presets: { ...typography.presets, [created.id]: created },
      },
      `Duplicate ${activePreset.name}`,
      { presetId: created.id, breakpoint: "all" }
    );
    onSelectPreset(created.id);
    onNotify?.(`Duplicated preset as "${created.name}"`);
  };

  const handleDeleteCustom = () => {
    if (activePreset.builtIn) return;
    const nextPresets = { ...typography.presets };
    delete nextPresets[activePreset.id];
    onChangeTypography(
      { ...typography, presets: nextPresets },
      `Delete preset ${activePreset.name}`,
      { presetId: activePreset.id, breakpoint: "all" }
    );
    onSelectPreset("h1");
    onNotify?.(`Deleted custom preset "${activePreset.name}"`);
  };

  const handleResetPreset = () => {
    if (!DEFAULT_TYPOGRAPHY_PRESETS[activePreset.id]) return;
    onChangeTypography(
      resetSinglePreset(typography, activePreset.id),
      `Reset ${activePreset.name} to default`,
      { presetId: activePreset.id, breakpoint: "all" }
    );
    onNotify?.(`Reset ${activePreset.name} to default`);
  };

  const fontRoleOptions = (
    ["primary", "secondary", "heading", "body", "monospace"] as TypographyFontRole[]
  ).map((r) => ({
    value: r,
    label: `${FONT_ROLE_METADATA[r].label} (${typography.fonts[r].family})`,
  }));

  const fontChoiceOptions = [
    ...fontRoleOptions,
    ...BUILTIN_FONT_NAMES.map((f) => ({ value: f, label: f })),
  ];

  const grouped: Record<PresetCategory, TypographyPreset[]> = {
    headings: [],
    body: [],
    interactive: [],
    custom: [],
  };
  for (const preset of orderedPresets) {
    grouped[preset.category]?.push(preset);
  }

  return (
    <div className="typo-presets-grid">
      <div className="typo-preset-list-col">
        <div className="typo-preset-list-header">
          <strong>Presets ({orderedPresets.length})</strong>
          <Popover open={createOpen} onOpenChange={setCreateOpen}>
            <PopoverTrigger disabled={disabled} className="btn btn-sm">
              <Plus size={12} />
              <span>New</span>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-[290px]">
              <PopoverHeader>
                <PopoverTitle>Create Custom Preset</PopoverTitle>
                <PopoverDescription>
                  Inherits initial styles from a base preset.
                </PopoverDescription>
              </PopoverHeader>
              <div className="typo-pop-stack">
                <div className="typo-field-group">
                  <span className="typo-field-label">Preset Name</span>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g. Hero Kicker, Product Badge"
                    className="typo-text-input"
                  />
                </div>
                <div className="typo-field-group">
                  <span className="typo-field-label">Copy styles from</span>
                  <select
                    value={newBaseId}
                    onChange={(e) => setNewBaseId(e.target.value)}
                    className="typo-select-native"
                  >
                    {orderedPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={!newPresetName.trim()}
                  onClick={handleCreatePreset}
                >
                  Create Preset
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="typo-preset-list-scroll">
          {(
            ["headings", "body", "interactive", "custom"] as PresetCategory[]
          ).map((cat) => {
            const list = grouped[cat];
            if (!list.length) return null;
            return (
              <div key={cat} className="typo-preset-group">
                <div className="typo-preset-group-label">
                  {PRESET_CATEGORY_LABELS[cat]}
                </div>
                {list.map((p) => {
                  const pRes = resolvePresetValuesForViewport(
                    p,
                    typography,
                    viewport
                  );
                  const hasCustomBp =
                    pRes.fontSizeMeta.isCustomized ||
                    pRes.lineHeightMeta.isCustomized ||
                    pRes.letterSpacingMeta.isCustomized;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        "typo-preset-item",
                        p.id === activePreset.id && "active"
                      )}
                      onClick={() => onSelectPreset(p.id)}
                    >
                      <span className="typo-preset-item-name">
                        {p.name}
                        {hasCustomBp ? (
                          <span
                            className="typo-custom-dot"
                            title={`Customized on ${viewport}`}
                          />
                        ) : null}
                      </span>
                      <span className="typo-preset-item-spec">
                        {pRes.fontSize} · w{p.fontWeight}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="typo-preset-editor-col">
        <div className="typo-preset-editor-top">
          <div>
            <div className="typo-preset-active-title">
              <strong>{activePreset.name}</strong>
              <Badge tone="neutral">{activePreset.id}</Badge>
              {!activePreset.builtIn ? <Badge tone="accent">Custom</Badge> : null}
            </div>
            <div className="typo-viewport-inline" role="group">
              {(
                [
                  ["desktop", "Desktop", Monitor],
                  ["tablet", "Tablet", Tablet],
                  ["mobile", "Mobile", Smartphone],
                ] as const
              ).map(([vp, label, Icon]) => {
                const vpRes = resolvePresetValuesForViewport(
                  activePreset,
                  typography,
                  vp
                );
                const customHere =
                  vp !== "desktop" &&
                  (vpRes.fontSizeMeta.isCustomized ||
                    vpRes.lineHeightMeta.isCustomized ||
                    vpRes.letterSpacingMeta.isCustomized);
                return (
                  <button
                    key={vp}
                    type="button"
                    className={cn("typo-vp-btn", viewport === vp && "active")}
                    onClick={() => onViewportChange(vp)}
                  >
                    <Icon size={12} />
                    <span>{label}</span>
                    {customHere ? <span className="typo-custom-dot" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="typo-preset-actions">
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={handleDuplicatePreset}
              title="Duplicate preset"
            >
              <Copy size={12} />
            </Button>
            {!activePreset.builtIn ? (
              <>
                <Popover
                  open={renameOpen}
                  onOpenChange={(open) => {
                    setRenameOpen(open);
                    if (open) setRenameValue(activePreset.name);
                  }}
                >
                  <PopoverTrigger disabled={disabled} className="btn btn-sm">
                    <Pencil size={12} />
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-[240px]">
                    <PopoverHeader>
                      <PopoverTitle>Rename Preset</PopoverTitle>
                    </PopoverHeader>
                    <div className="typo-pop-stack">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="typo-text-input"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={!renameValue.trim()}
                        onClick={() => {
                          updateActivePreset(
                            (prev) => ({ ...prev, name: renameValue.trim() }),
                            `Rename preset to ${renameValue.trim()}`
                          );
                          setRenameOpen(false);
                        }}
                      >
                        Save Name
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={handleDeleteCustom}
                  title="Delete custom preset"
                >
                  <Trash2 size={12} />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={handleResetPreset}
                title="Reset preset to defaults"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        <div
          className="typo-active-specimen-card"
          style={{
            background: tokens.colors.background,
            color: resolved.color || tokens.colors.text,
            borderColor: tokens.colors.border || "var(--border)",
          }}
        >
          <div className="typo-active-specimen-meta">
            <span>Live {viewport} preview</span>
            <code>
              {resolved.fontFamilyName} · {resolved.fontSize} · w{resolved.fontWeight} · lh {resolved.lineHeight}
            </code>
          </div>
          <div
            className="typo-active-specimen-text"
            style={{
              fontFamily: resolved.fontStack,
              fontSize: resolved.fontSize,
              fontWeight: Number(resolved.fontWeight),
              fontStyle: resolved.fontStyle,
              lineHeight: resolved.lineHeight,
              letterSpacing: resolved.letterSpacing,
              textTransform: resolved.textTransform,
              textDecoration: resolved.textDecoration,
              color:
                activePreset.id === "button"
                  ? "#FFFFFF"
                  : resolved.color || (activePreset.id === "link" ? tokens.colors.primary : tokens.colors.text),
              ...(activePreset.id === "button"
                ? {
                    display: "inline-flex",
                    padding: "8px 16px",
                    borderRadius: tokens.radius.button,
                    background: tokens.colors.primary,
                  }
                : {}),
            }}
          >
            {DEFAULT_PREVIEW_SAMPLES[activePreset.id] ||
              `${activePreset.name} — Discover Your Style`}
          </div>
        </div>

        <div className="typo-prop-groups">
          <PresetPopoverRow
            title="Font & Responsive Scale"
            summary={`${resolved.fontFamilyName} · ${resolved.fontSize} · Weight ${resolved.fontWeight}`}
            badge={
              resolved.fontSizeMeta.isCustomized
                ? `${viewport} custom`
                : activePreset.useFluid
                  ? "clamp()"
                  : undefined
            }
            disabled={disabled}
          >
            <SelectControl
              label="Font Family / Role"
              value={activePreset.fontFamily}
              options={fontChoiceOptions}
              onChange={(val) =>
                val &&
                updateActivePreset(
                  (prev) => ({ ...prev, fontFamily: val }),
                  `Update ${activePreset.name} font family`
                )
              }
            />
            <UnitControl
              label={`Font Size (${viewport})`}
              value={resolved.fontSizeMeta.value}
              overridden={resolved.fontSizeMeta.isCustomized}
              viewport={viewport}
              onReset={
                viewport !== "desktop" && resolved.fontSizeMeta.isCustomized
                  ? () =>
                      updateActivePreset(
                        (prev) => ({
                          ...prev,
                          fontSize: resetResponsiveMetricViewport(
                            prev.fontSize,
                            viewport,
                            resolved.fontSizeMeta.value
                          ),
                        }),
                        `Reset ${activePreset.name} ${viewport} fontSize`
                      )
                  : undefined
              }
              onChange={(nextVal) =>
                nextVal &&
                updateActivePreset(
                  (prev) => ({
                    ...prev,
                    fontSize: updateResponsiveMetricValue(
                      prev.fontSize,
                      viewport,
                      nextVal,
                      resolved.fontSizeMeta.value
                    ),
                  }),
                  `Update ${activePreset.name} ${viewport} fontSize`
                )
              }
            />
            {resolved.fontSizeMeta.inheritedFrom ? (
              <div className="typo-inherited-note">
                Inherited from {resolved.fontSizeMeta.inheritedFrom}
              </div>
            ) : null}

            <div className="typo-fluid-box">
              <div className="typo-fluid-row">
                <span>Fluid Typography (`clamp()`)</span>
                <button
                  type="button"
                  className={cn(
                    "typo-pill-btn",
                    activePreset.useFluid && "active"
                  )}
                  onClick={() =>
                    updateActivePreset(
                      (prev) => ({
                        ...prev,
                        useFluid: !prev.useFluid,
                        fluidSize:
                          prev.fluidSize ||
                          "clamp(1.25rem, 1rem + 1.2vw, 2.5rem)",
                      }),
                      `Toggle fluid sizing on ${activePreset.name}`
                    )
                  }
                >
                  {activePreset.useFluid ? "Enabled" : "Off"}
                </button>
              </div>
              {activePreset.useFluid ? (
                <input
                  type="text"
                  value={activePreset.fluidSize || ""}
                  onChange={(e) =>
                    updateActivePreset(
                      (prev) => ({ ...prev, fluidSize: e.target.value }),
                      `Edit fluid clamp on ${activePreset.name}`
                    )
                  }
                  placeholder="clamp(1.5rem, 1.2rem + 1.5vw, 3rem)"
                  className="typo-text-input"
                />
              ) : null}
            </div>

            <div className="typo-two-col">
              <SelectControl
                label="Font Weight"
                value={String(activePreset.fontWeight)}
                options={WEIGHT_SELECT_ITEMS}
                onChange={(v) =>
                  v &&
                  updateActivePreset(
                    (prev) => ({ ...prev, fontWeight: Number(v) }),
                    `Set ${activePreset.name} weight ${v}`
                  )
                }
              />
              <SelectControl
                label="Font Style"
                value={activePreset.fontStyle || "normal"}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "italic", label: "Italic" },
                  { value: "oblique", label: "Oblique" },
                ]}
                onChange={(v) =>
                  updateActivePreset(
                    (prev) => ({
                      ...prev,
                      fontStyle: (v as TypographyPreset["fontStyle"]) || "normal",
                    }),
                    `Set ${activePreset.name} style`
                  )
                }
              />
            </div>
            <SelectControl
              label="Font Stretch"
              value={activePreset.fontStretch || "normal"}
              options={[
                { value: "condensed", label: "Condensed" },
                { value: "semi-condensed", label: "Semi-Condensed" },
                { value: "normal", label: "Normal" },
                { value: "semi-expanded", label: "Semi-Expanded" },
                { value: "expanded", label: "Expanded" },
              ]}
              onChange={(v) =>
                updateActivePreset(
                  (prev) => ({
                    ...prev,
                    fontStretch: v as TypographyPreset["fontStretch"],
                  }),
                  `Set ${activePreset.name} stretch`
                )
              }
            />
          </PresetPopoverRow>

          <PresetPopoverRow
            title="Text Appearance"
            summary={[
              activePreset.color || "Inherit color",
              activePreset.textTransform || "none",
              activePreset.textDecoration || "none",
            ].join(" · ")}
            disabled={disabled}
          >
            <ColorControl
              label="Preset Color (optional)"
              value={activePreset.color || ""}
              placeholder={tokens.colors.text}
              palette={palette}
              displayMode="inline"
              onAddPaletteColor={onAddBrandColor}
              onReset={
                activePreset.color
                  ? () =>
                      updateActivePreset(
                        (prev) => ({ ...prev, color: "" }),
                        `Clear ${activePreset.name} color override`
                      )
                  : undefined
              }
              onChange={(hex) =>
                updateActivePreset(
                  (prev) => ({ ...prev, color: hex }),
                  `Update ${activePreset.name} color`
                )
              }
            />
            <div className="typo-two-col">
              <SelectControl
                label="Text Transform"
                value={activePreset.textTransform || "none"}
                options={[
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                  { value: "lowercase", label: "Lowercase" },
                  { value: "capitalize", label: "Capitalize" },
                ]}
                onChange={(v) =>
                  updateActivePreset(
                    (prev) => ({
                      ...prev,
                      textTransform: v as TypographyPreset["textTransform"],
                    }),
                    `Update ${activePreset.name} transform`
                  )
                }
              />
              <SelectControl
                label="Text Decoration"
                value={activePreset.textDecoration || "none"}
                options={[
                  { value: "none", label: "None" },
                  { value: "underline", label: "Underline" },
                  { value: "line-through", label: "Line Through" },
                ]}
                onChange={(v) =>
                  updateActivePreset(
                    (prev) => ({
                      ...prev,
                      textDecoration: v as TypographyPreset["textDecoration"],
                    }),
                    `Update ${activePreset.name} decoration`
                  )
                }
              />
            </div>
            <SelectControl
              label="Text Alignment (optional)"
              value={activePreset.textAlign || ""}
              options={[
                { value: "", label: "Inherit" },
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
                { value: "justify", label: "Justify" },
              ]}
              onChange={(v) =>
                updateActivePreset(
                  (prev) => ({
                    ...prev,
                    textAlign: (v || undefined) as TypographyPreset["textAlign"],
                  }),
                  `Update ${activePreset.name} align`
                )
              }
            />
          </PresetPopoverRow>

          <PresetPopoverRow
            title="Spacing & Rhythm"
            summary={`LH ${resolved.lineHeight} · LS ${resolved.letterSpacing}${activePreset.wordSpacing ? ` · WS ${activePreset.wordSpacing}` : ""}`}
            badge={
              resolved.lineHeightMeta.isCustomized ||
              resolved.letterSpacingMeta.isCustomized
                ? `${viewport} custom`
                : undefined
            }
            disabled={disabled}
          >
            <div className="typo-field-group">
              <div className="typo-fluid-row">
                <span className="typo-field-label">
                  Line Height ({viewport})
                  {resolved.lineHeightMeta.inheritedFrom
                    ? ` · from ${resolved.lineHeightMeta.inheritedFrom}`
                    : ""}
                </span>
                {viewport !== "desktop" && resolved.lineHeightMeta.isCustomized ? (
                  <button
                    type="button"
                    className="typo-reset-link"
                    onClick={() =>
                      updateActivePreset(
                        (prev) => ({
                          ...prev,
                          lineHeight: resetResponsiveMetricViewport(
                            prev.lineHeight,
                            viewport,
                            resolved.lineHeightMeta.value
                          ),
                        }),
                        `Reset ${activePreset.name} ${viewport} lineHeight`
                      )
                    }
                  >
                    Reset
                  </button>
                ) : null}
              </div>
              <input
                type="number"
                step="0.05"
                min="0.8"
                max="3.5"
                value={String(resolved.lineHeightMeta.value)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  updateActivePreset(
                    (prev) => ({
                      ...prev,
                      lineHeight: updateResponsiveMetricValue(
                        prev.lineHeight,
                        viewport,
                        n,
                        resolved.lineHeightMeta.value
                      ),
                    }),
                    `Update ${activePreset.name} ${viewport} lineHeight`
                  );
                }}
                className="typo-text-input"
              />
            </div>

            <UnitControl
              label={`Letter Spacing (${viewport})`}
              value={resolved.letterSpacingMeta.value}
              overridden={resolved.letterSpacingMeta.isCustomized}
              viewport={viewport}
              onReset={
                viewport !== "desktop" && resolved.letterSpacingMeta.isCustomized
                  ? () =>
                      updateActivePreset(
                        (prev) => ({
                          ...prev,
                          letterSpacing: resetResponsiveMetricViewport(
                            prev.letterSpacing,
                            viewport,
                            resolved.letterSpacingMeta.value
                          ),
                        }),
                        `Reset ${activePreset.name} ${viewport} letterSpacing`
                      )
                  : undefined
              }
              onChange={(val) =>
                updateActivePreset(
                  (prev) => ({
                    ...prev,
                    letterSpacing: updateResponsiveMetricValue(
                      prev.letterSpacing,
                      viewport,
                      val || "0px",
                      resolved.letterSpacingMeta.value
                    ),
                  }),
                  `Update ${activePreset.name} ${viewport} letterSpacing`
                )
              }
            />

            <UnitControl
              label="Word Spacing"
              value={activePreset.wordSpacing || ""}
              placeholder="normal"
              onChange={(val) =>
                updateActivePreset(
                  (prev) => ({ ...prev, wordSpacing: val }),
                  `Update ${activePreset.name} wordSpacing`
                )
              }
            />
          </PresetPopoverRow>

          <PresetPopoverRow
            title="Advanced Typography"
            summary={[
              activePreset.textWrap || "wrap",
              activePreset.textOverflow || "clip",
              activePreset.textShadow ? "shadow" : "no shadow",
            ].join(" · ")}
            disabled={disabled}
          >
            <div className="typo-two-col">
              <SelectControl
                label="Text Wrap"
                value={activePreset.textWrap || "wrap"}
                options={[
                  { value: "wrap", label: "Wrap" },
                  { value: "balance", label: "Balance" },
                  { value: "pretty", label: "Pretty" },
                  { value: "nowrap", label: "No Wrap" },
                ]}
                onChange={(v) =>
                  updateActivePreset(
                    (prev) => ({
                      ...prev,
                      textWrap: v as TypographyPreset["textWrap"],
                    }),
                    `Update ${activePreset.name} textWrap`
                  )
                }
              />
              <SelectControl
                label="Text Overflow"
                value={activePreset.textOverflow || "clip"}
                options={[
                  { value: "clip", label: "Clip" },
                  { value: "ellipsis", label: "Ellipsis" },
                ]}
                onChange={(v) =>
                  updateActivePreset(
                    (prev) => ({
                      ...prev,
                      textOverflow: v as TypographyPreset["textOverflow"],
                    }),
                    `Update ${activePreset.name} textOverflow`
                  )
                }
              />
            </div>
            <UnitControl
              label="Text Indent"
              value={activePreset.textIndent || ""}
              placeholder="0px"
              onChange={(val) =>
                updateActivePreset(
                  (prev) => ({ ...prev, textIndent: val }),
                  `Update ${activePreset.name} textIndent`
                )
              }
            />
            <div className="typo-field-group">
              <span className="typo-field-label">Text Shadow</span>
              <input
                type="text"
                value={activePreset.textShadow || ""}
                onChange={(e) =>
                  updateActivePreset(
                    (prev) => ({ ...prev, textShadow: e.target.value }),
                    `Update ${activePreset.name} textShadow`
                  )
                }
                placeholder="e.g. 0 2px 10px rgba(0,0,0,0.18)"
                className="typo-text-input"
              />
            </div>
          </PresetPopoverRow>
        </div>

        {warnings.length ? (
          <div className="typo-a11y-warnings" role="status">
            <div className="typo-a11y-title">
              <AlertTriangle size={13} />
              <span>Accessibility &amp; Readability Advisory</span>
            </div>
            <ul>
              {warnings.map((w) => (
                <li key={w.id}>{w.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="typo-a11y-ok">
            Contrast &amp; readability metrics pass recommended thresholds for {viewport}.
          </div>
        )}
      </div>
    </div>
  );
}
