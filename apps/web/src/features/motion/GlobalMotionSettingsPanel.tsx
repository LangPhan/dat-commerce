"use client";

import {
  Library,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
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
import {
  SelectControl,
  SliderControl,
} from "@/features/editor/inspector-controls";
import { cn } from "@/lib/format";
import { DEFAULT_GLOBAL_MOTION, normalizeGlobalMotion, resolveEasingCss } from "./defaults";
import { getPresetsByCategory, SYSTEM_ANIMATION_PRESETS } from "./presets";
import type {
  AnimationPresetDefinition,
  EntrancePresetKey,
  GlobalMotionSettings,
  NormalizedGlobalMotion,
} from "./types";

type MotionSubTab = "behavior" | "tokens" | "presets";

const CUBIC_BEZIER_RE =
  /^cubic-bezier\(\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*\)$/;

const ENTRANCE_OPTIONS = getPresetsByCategory("entrance").map((p) => ({
  value: p.config.entrance?.preset || "fadeInUp",
  label: p.name,
}));

const EASING_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "ease", label: "Ease" },
  { value: "easeIn", label: "Ease In" },
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In Out" },
  { value: "custom", label: "Custom Cubic Bezier" },
];

export function GlobalMotionSettingsPanel({
  motion,
  customPresets = [],
  canWrite,
  onChange,
  onOpenLibrary,
}: {
  motion?: Partial<GlobalMotionSettings> | null;
  customPresets?: AnimationPresetDefinition[];
  canWrite: boolean;
  onChange: (next: GlobalMotionSettings, summary: string) => void;
  onOpenLibrary?: () => void;
}) {
  const settings = normalizeGlobalMotion(motion);
  const [subTab, setSubTab] = useState<MotionSubTab>("behavior");
  const [resetOpen, setResetOpen] = useState(false);
  const [previewTick, setPreviewTick] = useState(1);
  const [bezierErr, setBezierErr] = useState("");

  const patch = (partial: Partial<GlobalMotionSettings>, summary: string) => {
    onChange({ ...settings, ...partial }, summary);
  };

  const patchTiming = (
    key: keyof NormalizedGlobalMotion["timingTokens"],
    val: number
  ) => {
    onChange(
      {
        ...settings,
        timingTokens: { ...settings.timingTokens, [key]: val },
      },
      `Update motion ${key} token (${val}ms)`
    );
  };

  const patchEasing = (
    key: keyof NormalizedGlobalMotion["easingTokens"],
    val: string
  ) => {
    if (key === "custom" && val.trim() && !CUBIC_BEZIER_RE.test(val.trim())) {
      setBezierErr("Use valid cubic-bezier(x1, y1, x2, y2), e.g. cubic-bezier(0.16, 1, 0.3, 1)");
      return;
    }
    setBezierErr("");
    onChange(
      {
        ...settings,
        easingTokens: { ...settings.easingTokens, [key]: val.trim() },
      },
      `Update motion easing token (${key})`
    );
  };

  const activeEaseCss = resolveEasingCss(settings.defaultEasing, settings);
  const demoPreset = (settings.defaultEntrancePreset || "fadeInUp") as EntrancePresetKey;

  return (
    <div className="typo-workspace" data-testid="global-motion-workspace">
      <div className="typo-workspace-head">
        <div className="typo-subtab-nav" role="tablist" aria-label="Global Motion sections">
          {(
            [
              ["behavior", "Behavior & Defaults"],
              ["tokens", "Timing & Easing Tokens"],
              ["presets", `Reusable Presets (${customPresets.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={subTab === key}
              className={cn("typo-subtab-btn", subTab === key && "active")}
              onClick={() => setSubTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ed-inline-actions">
          {onOpenLibrary ? (
            <Button size="sm" variant="secondary" onClick={onOpenLibrary}>
              <Library size={12} /> Preset Library
            </Button>
          ) : null}
          <Popover open={resetOpen} onOpenChange={setResetOpen}>
            <PopoverTrigger disabled={!canWrite} className="btn btn-sm">
              <RotateCcw size={12} />
              <span>Reset Motion Defaults</span>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-[280px]">
              <PopoverHeader>
                <PopoverTitle>Reset Global Motion?</PopoverTitle>
                <PopoverDescription>
                  Restores global switches, mobile behavior, timing tokens, and easing curves to factory defaults.
                </PopoverDescription>
              </PopoverHeader>
              <div className="ed-inline-actions" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                <Button size="sm" variant="ghost" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    onChange({ ...DEFAULT_GLOBAL_MOTION }, "Reset Global Motion to defaults");
                    setResetOpen(false);
                  }}
                >
                  Confirm Reset
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Fixed-height stage ensures 0px layout shift across Global Motion subtabs */}
      <div className="motion-subtab-stage">
        {subTab === "behavior" ? (
          <div className="theme-panel-stack" style={{ padding: 14 }}>
            <div className="theme-two-grid">
              <div className="theme-card-box">
                <div className="ed-inspector-sec-head">
                  <strong>
                    <Sparkles size={13} style={{ display: "inline", marginRight: 5 }} />
                    Master Controls
                  </strong>
                  <Badge tone={settings.enabled ? "green" : "amber"}>
                    {settings.enabled ? "Active" : "Paused Globally"}
                  </Badge>
                </div>

                <label className="ed-check-row">
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={settings.enabled}
                    onChange={(e) =>
                      patch({ enabled: e.target.checked }, e.target.checked ? "Enable global animations" : "Disable global animations")
                    }
                  />
                  <span>Enable Global Animations</span>
                </label>

                <label className="ed-check-row">
                  <input
                    type="checkbox"
                    disabled={!canWrite || !settings.enabled}
                    checked={settings.scrollEffectsEnabled}
                    onChange={(e) =>
                      patch({ scrollEffectsEnabled: e.target.checked }, "Toggle global scroll effects")
                    }
                  />
                  <span>Enable Scroll Animations &amp; Parallax</span>
                </label>

                <label className="ed-check-row">
                  <input
                    type="checkbox"
                    disabled={!canWrite || !settings.enabled}
                    checked={settings.hoverEffectsEnabled}
                    onChange={(e) =>
                      patch({ hoverEffectsEnabled: e.target.checked }, "Toggle global hover effects")
                    }
                  />
                  <span>Enable Hover Effects (pointer devices)</span>
                </label>
              </div>

              <div className="theme-card-box">
                <div className="ed-inspector-sec-head">
                  <strong>
                    <Smartphone size={13} style={{ display: "inline", marginRight: 5 }} />
                    Responsive &amp; Accessibility
                  </strong>
                  <ShieldCheck size={14} className="muted" />
                </div>

                <SelectControl
                  label="Mobile Animation Behavior"
                  value={settings.mobileBehavior}
                  disabled={!canWrite}
                  options={[
                    { value: "full", label: "Full — run all configured animations" },
                    { value: "reduced", label: "Reduced — shorter duration, no parallax/loops" },
                    { value: "disabled", label: "Disabled — static layout on mobile" },
                  ]}
                  onChange={(v) =>
                    patch(
                      { mobileBehavior: v as GlobalMotionSettings["mobileBehavior"] },
                      `Set mobile motion behavior (${v})`
                    )
                  }
                />

                <SelectControl
                  label="Reduced Motion Policy (prefers-reduced-motion)"
                  value={settings.reducedMotionPolicy}
                  disabled={!canWrite}
                  options={[
                    { value: "respect-system", label: "Respect OS prefers-reduced-motion" },
                    { value: "essential-only", label: "Essential feedback only" },
                    { value: "always-reduced", label: "Always reduce motion storefront-wide" },
                  ]}
                  onChange={(v) =>
                    patch(
                      {
                        reducedMotionPolicy:
                          v as GlobalMotionSettings["reducedMotionPolicy"],
                      },
                      `Set reduced motion policy (${v})`
                    )
                  }
                />
              </div>
            </div>

            <div className="theme-two-grid">
              <div className="theme-card-box">
                <strong>Default Motion Properties</strong>
                <SelectControl
                  label="Default Entrance Preset"
                  value={String(settings.defaultEntrancePreset)}
                  disabled={!canWrite}
                  options={ENTRANCE_OPTIONS}
                  onChange={(v) =>
                    patch({ defaultEntrancePreset: v }, `Set default entrance preset (${v})`)
                  }
                />
                <SliderControl
                  label="Default Entrance Duration"
                  value={settings.defaultDuration}
                  min={100}
                  max={2000}
                  step={20}
                  unit="ms"
                  disabled={!canWrite}
                  onChange={(v) =>
                    patch({ defaultDuration: parseInt(v, 10) || 550 }, `Set default duration (${v})`)
                  }
                />
                <SliderControl
                  label="Default Hover Duration"
                  value={settings.defaultHoverDuration}
                  min={80}
                  max={800}
                  step={10}
                  unit="ms"
                  disabled={!canWrite}
                  onChange={(v) =>
                    patch({ defaultHoverDuration: parseInt(v, 10) || 220 }, `Set default hover duration (${v})`)
                  }
                />
                <SelectControl
                  label="Default Easing"
                  value={settings.defaultEasing}
                  disabled={!canWrite}
                  options={EASING_OPTIONS}
                  onChange={(v) =>
                    patch({ defaultEasing: v }, `Set default easing (${v})`)
                  }
                />
              </div>

              <div className="theme-card-box">
                <div className="ed-inspector-sec-head">
                  <strong>Live Global Defaults Preview</strong>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPreviewTick((t) => t + 1)}
                  >
                    <Play size={11} /> Replay
                  </Button>
                </div>
                <div className="motion-global-preview-stage">
                  <div
                    key={previewTick}
                    className={cn(
                      "motion-global-preview-card",
                      settings.enabled && "m-entrance-active"
                    )}
                    style={
                      {
                        "--m-ent-name": `m-${demoPreset}`,
                        "--m-ent-dur": `${settings.defaultDuration}ms`,
                        "--m-ent-delay": "0ms",
                        "--m-ent-ease": activeEaseCss,
                        "--m-ent-repeat": "1",
                        "--m-ent-dir": "normal",
                      } as CSSProperties
                    }
                  >
                    <strong>{demoPreset}</strong>
                    <span className="muted">
                      {settings.defaultDuration}ms · {settings.defaultEasing}
                    </span>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
                  New animated blocks inherit these defaults automatically and resolve CSS variables{" "}
                  <code>--motion-fast</code>, <code>--motion-normal</code>, and <code>--motion-slow</code>.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {subTab === "tokens" ? (
          <div className="theme-panel-stack" style={{ padding: 14 }}>
            <div className="theme-two-grid">
              <div className="theme-card-box">
                <div className="ed-inspector-sec-head">
                  <strong>Timing Tokens</strong>
                  <Badge tone="neutral">CSS Vars</Badge>
                </div>
                <SliderControl
                  label="Fast (--motion-fast)"
                  value={settings.timingTokens.fast}
                  min={60}
                  max={500}
                  step={10}
                  unit="ms"
                  disabled={!canWrite}
                  onChange={(v) => patchTiming("fast", parseInt(v, 10) || 180)}
                />
                <SliderControl
                  label="Normal (--motion-normal)"
                  value={settings.timingTokens.normal}
                  min={150}
                  max={1200}
                  step={20}
                  unit="ms"
                  disabled={!canWrite}
                  onChange={(v) => patchTiming("normal", parseInt(v, 10) || 450)}
                />
                <SliderControl
                  label="Slow (--motion-slow)"
                  value={settings.timingTokens.slow}
                  min={300}
                  max={2500}
                  step={50}
                  unit="ms"
                  disabled={!canWrite}
                  onChange={(v) => patchTiming("slow", parseInt(v, 10) || 850)}
                />

                <div className="ed-inline-actions" style={{ marginTop: 4 }}>
                  <Button size="sm" variant="secondary" onClick={() => setPreviewTick((t) => t + 1)}>
                    <Play size={11} /> Test Timing Rhythm
                  </Button>
                </div>

                <div className="motion-token-bars">
                  {(
                    [
                      ["Fast", settings.timingTokens.fast],
                      ["Normal", settings.timingTokens.normal],
                      ["Slow", settings.timingTokens.slow],
                    ] as const
                  ).map(([label, ms]) => (
                    <div key={`${label}-${previewTick}`} className="motion-token-track">
                      <span>
                        {label} ({ms}ms)
                      </span>
                      <div className="motion-token-rail">
                        <div
                          className="motion-token-dot m-entrance-active"
                          style={
                            {
                              "--m-ent-name": "m-slideInLeft",
                              "--m-ent-dur": `${ms}ms`,
                              "--m-ent-delay": "0ms",
                              "--m-ent-ease": activeEaseCss,
                              "--m-ent-repeat": "1",
                              "--m-ent-dir": "normal",
                            } as CSSProperties
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="theme-card-box">
                <div className="ed-inspector-sec-head">
                  <strong>Easing Tokens</strong>
                  <Badge tone="accent">Curves</Badge>
                </div>
                {(
                  [
                    ["linear", "Linear"],
                    ["ease", "Ease"],
                    ["easeIn", "Ease In"],
                    ["easeOut", "Ease Out"],
                    ["easeInOut", "Ease In Out"],
                    ["custom", "Custom Cubic Bezier"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="ed-ctrl-field">
                    <span className="ed-ctrl-label">{label}</span>
                    <input
                      type="text"
                      className="ed-text-input"
                      disabled={!canWrite}
                      defaultValue={settings.easingTokens[key]}
                      key={`${key}-${settings.easingTokens[key]}`}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== settings.easingTokens[key]) {
                          patchEasing(key, e.target.value);
                        }
                      }}
                    />
                  </label>
                ))}
                {bezierErr ? <p className="ed-form-err">{bezierErr}</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {subTab === "presets" ? (
          <div className="theme-panel-stack" style={{ padding: 14 }}>
            <div className="ed-inspector-sec-head">
              <div>
                <strong>Storefront Reusable Animation Presets</strong>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                  Updating a linked custom preset propagates automatically to all elements referencing it while preserving element-level overrides.
                </p>
              </div>
              {onOpenLibrary ? (
                <Button size="sm" variant="primary" onClick={onOpenLibrary}>
                  <Library size={12} /> Manage in Library
                </Button>
              ) : null}
            </div>

            {customPresets.length === 0 ? (
              <div className="theme-card-box" style={{ alignItems: "center", padding: 28, textAlign: "center" }}>
                <Sparkles size={20} className="muted" />
                <strong>No custom animation presets yet</strong>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  {SYSTEM_ANIMATION_PRESETS.length} built-in system presets are available immediately. Open the Preset Library to save custom reusable presets for your store.
                </p>
                {onOpenLibrary ? (
                  <Button size="sm" variant="secondary" onClick={onOpenLibrary}>
                    Create Custom Preset
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="theme-two-grid">
                {customPresets.map((preset) => (
                  <div key={preset.id} className="theme-card-box">
                    <div className="ed-inspector-sec-head">
                      <strong>{preset.name}</strong>
                      <Badge tone="accent">{preset.category}</Badge>
                    </div>
                    <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                      {preset.description || "Custom reusable animation preset"}
                    </p>
                    <div className="ed-inline-actions" style={{ fontSize: 11 }}>
                      <Badge tone="neutral">{preset.defaultDuration}ms</Badge>
                      <Badge tone="neutral">{preset.defaultEasing}</Badge>
                      <code style={{ fontSize: 10.5 }}>{preset.presetKey}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
