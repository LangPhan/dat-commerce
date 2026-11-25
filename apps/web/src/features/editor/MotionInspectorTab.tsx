"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Library,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Unlink,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/builder/store/editor-store";
import type { ElementNode, ViewportMode } from "@/features/builder/types";
import { findPresetByKey, getPresetsByCategory } from "@/features/motion/presets";
import { resolveElementMotionForViewport } from "@/features/motion/resolve";
import type {
  AnimationPresetDefinition,
  ContinuousMotionConfig,
  ContinuousPresetKey,
  ElementMotionConfig,
  EntranceMotionConfig,
  EntrancePresetKey,
  GlobalMotionSettings,
  HoverMotionConfig,
  HoverPresetKey,
  InteractionMotionConfig,
  InteractionPresetKey,
  MotionCategory,
  ResponsiveMotionOverride,
  ScrollEffectKey,
  ScrollMode,
  ScrollMotionConfig,
  StaggerMotionConfig,
  TextAnimationPresetKey,
  TextMotionConfig,
} from "@/features/motion/types";
import { cn } from "@/lib/format";
import { PropertyPopoverRow, SelectControl, SliderControl } from "./inspector-controls";

const TEXT_CAPABLE_TYPES = new Set([
  "heading",
  "text_editor",
  "button",
  "promotion_banner",
]);

const STAGGER_CAPABLE_TYPES = new Set([
  "section",
  "container",
  "grid",
  "flex",
  "columns",
  "column",
  "product_grid",
  "product_carousel",
  "category_grid",
  "icon_list",
  "image_gallery",
]);

const EASING_OPTIONS = [
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In Out" },
  { value: "easeIn", label: "Ease In" },
  { value: "ease", label: "Ease" },
  { value: "linear", label: "Linear" },
  { value: "spring", label: "Spring" },
  { value: "custom", label: "Global Custom Bezier" },
];

const DIRECTION_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "reverse", label: "Reverse" },
  { value: "alternate", label: "Alternate" },
  { value: "alternate-reverse", label: "Alternate Reverse" },
];

const SCROLL_MODE_OPTIONS: { value: ScrollMode; label: string }[] = [
  { value: "reveal", label: "Scroll Reveal" },
  { value: "linked", label: "Scroll-Linked" },
  { value: "parallax", label: "Parallax" },
  { value: "sticky", label: "Sticky Effect" },
];

const SCROLL_EFFECTS_BY_MODE: Record<ScrollMode, { value: ScrollEffectKey; label: string }[]> = {
  reveal: [
    { value: "scrollFade", label: "Fade on Scroll" },
    { value: "scrollSlide", label: "Slide on Scroll" },
    { value: "scrollZoom", label: "Zoom on Scroll" },
    { value: "revealTop", label: "Reveal from Top" },
    { value: "revealBottom", label: "Reveal from Bottom" },
    { value: "revealLeft", label: "Reveal from Left" },
    { value: "revealRight", label: "Reveal from Right" },
  ],
  linked: [
    { value: "translateY", label: "Translate Y" },
    { value: "translateX", label: "Translate X" },
    { value: "scale", label: "Scale" },
    { value: "rotate", label: "Rotate" },
    { value: "opacity", label: "Opacity" },
    { value: "blur", label: "Blur" },
    { value: "skew", label: "Skew" },
  ],
  parallax: [
    { value: "parallaxVertical", label: "Vertical Parallax" },
    { value: "parallaxHorizontal", label: "Horizontal Parallax" },
    { value: "parallaxBackground", label: "Background Parallax" },
  ],
  sticky: [
    { value: "stickyScale", label: "Scale while Scrolling" },
    { value: "stickyFade", label: "Fade while Scrolling" },
    { value: "stickyTransform", label: "Transform while Scrolling" },
  ],
};

function CollapsibleMotionGroup({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ed-motion-group">
      <button
        type="button"
        className="ed-motion-group-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ed-motion-group-title">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <strong>{title}</strong>
        </span>
        {badge ? <Badge tone="accent">{badge}</Badge> : null}
      </button>
      {open ? <div className="ed-motion-group-body">{children}</div> : null}
    </div>
  );
}

export function MotionInspectorTab({
  node,
  viewport,
  globalMotion,
  customPresets,
  canWrite,
  onOpenLibrary,
}: {
  node: ElementNode;
  viewport: ViewportMode;
  globalMotion?: GlobalMotionSettings | null;
  customPresets: AnimationPresetDefinition[];
  canWrite: boolean;
  onOpenLibrary: (category?: MotionCategory | "all") => void;
}) {
  const updateNodeMotion = useEditorStore((s) => s.updateNodeMotion);
  const setNodeMotion = useEditorStore((s) => s.setNodeMotion);
  const removeNodeMotion = useEditorStore((s) => s.removeNodeMotion);
  const updateNodeResponsiveMotion = useEditorStore((s) => s.updateNodeResponsiveMotion);
  const replayNodeMotion = useEditorStore((s) => s.replayNodeMotion);
  const toggleNodeMotionPause = useEditorStore((s) => s.toggleNodeMotionPause);
  const setNodeScrollProgress = useEditorStore((s) => s.setNodeScrollProgress);
  const resetNodeMotionPreview = useEditorStore((s) => s.resetNodeMotionPreview);
  const paused = useEditorStore((s) => Boolean(s.motionPausedNodeIds[node.id]));
  const scrollProgress = useEditorStore((s) => s.motionScrollProgressByNodeId[node.id] ?? null);

  const disabled = !canWrite || node.locked;

  const resolved = useMemo(
    () => resolveElementMotionForViewport(node.motion, viewport, customPresets, globalMotion),
    [node.motion, viewport, customPresets, globalMotion]
  );

  const linkedPreset = useMemo(
    () => findPresetByKey(resolved.presetRef, customPresets),
    [resolved.presetRef, customPresets]
  );

  const entranceOptions = useMemo(
    () => [
      { value: "none", label: "None" },
      ...getPresetsByCategory("entrance").map((p) => ({
        value: p.presetKey,
        label: `${p.group ? `${p.group} · ` : ""}${p.name}`,
      })),
    ],
    []
  );

  const hoverOptions = useMemo(
    () => [
      { value: "none", label: "None" },
      ...getPresetsByCategory("hover").map((p) => ({
        value: p.config.hover?.preset || "scaleUp",
        label: p.name,
      })),
    ],
    []
  );

  const interactionOptions = useMemo(
    () => [
      { value: "none", label: "None" },
      ...getPresetsByCategory("interaction").map((p) => ({
        value: p.config.interaction?.preset || "buttonPress",
        label: p.name,
      })),
    ],
    []
  );

  const continuousOptions = useMemo(
    () => [
      { value: "none", label: "None" },
      ...getPresetsByCategory("continuous").map((p) => ({
        value: p.config.continuous?.preset || "floating",
        label: p.name,
      })),
    ],
    []
  );

  const textOptions = useMemo(
    () => [
      { value: "none", label: "None" },
      ...getPresetsByCategory("text").map((p) => ({
        value: p.config.text?.preset || "textFadeIn",
        label: `${p.group ? `${p.group} · ` : ""}${p.name}`,
      })),
    ],
    []
  );

  // Breakpoint-aware patch helper: Desktop edits base, Tablet/Mobile edit responsive override ONLY
  const patchSection = <K extends keyof ResponsiveMotionOverride>(
    key: K,
    value: ResponsiveMotionOverride[K],
    summary: string
  ) => {
    if (disabled) return;
    if (viewport === "desktop") {
      updateNodeMotion(
        node.id,
        { enabled: true, [key]: value } as Partial<ElementMotionConfig>,
        summary
      );
    } else {
      updateNodeResponsiveMotion(
        node.id,
        viewport,
        { [key]: value } as ResponsiveMotionOverride,
        `${summary} (${viewport})`
      );
    }
  };

  const entrance: EntranceMotionConfig = resolved.entrance || {};
  const scroll: ScrollMotionConfig = resolved.scroll || {};
  const hover: HoverMotionConfig = resolved.hover || {};
  const interaction: InteractionMotionConfig = resolved.interaction || {};
  const continuous: ContinuousMotionConfig = resolved.continuous || {};
  const textCfg: TextMotionConfig = resolved.text || {};
  const stagger: StaggerMotionConfig = resolved.stagger || {};

  const activeScrollMode: ScrollMode = scroll.mode || "reveal";
  const scrollEffectOptions = SCROLL_EFFECTS_BY_MODE[activeScrollMode];
  const isTextCapable = TEXT_CAPABLE_TYPES.has(node.type);
  const isStaggerCapable = STAGGER_CAPABLE_TYPES.has(node.type);

  return (
    <div className="ed-motion-inspector">
      <div className="ed-motion-transport">
        <div className="ed-motion-transport-btns" role="group" aria-label="Animation playback controls">
          <button type="button" className="ed-mini-icon-btn" title="Play / Replay animation" aria-label="Play animation" onClick={() => replayNodeMotion(node.id)}>
            <Play size={12} />
          </button>
          <button type="button" className={cn("ed-mini-icon-btn", paused && "active")} title={paused ? "Resume animation" : "Pause animation"} aria-label={paused ? "Resume animation" : "Pause animation"} onClick={() => toggleNodeMotionPause(node.id)}>
            <Pause size={12} />
          </button>
          <button type="button" className="ed-mini-icon-btn" title="Restart animation" aria-label="Restart animation" onClick={() => resetNodeMotionPreview(node.id)}>
            <RotateCcw size={12} />
          </button>
          <button type="button" className="ed-mini-icon-btn" title="Stop preview" aria-label="Stop animation" onClick={() => { toggleNodeMotionPause(node.id, true); setNodeScrollProgress(node.id, null); }}>
            <Square size={11} />
          </button>
          <button type="button" className="ed-mini-icon-btn" title="Remove all animations" aria-label="Remove animation" disabled={disabled || !node.motion} onClick={() => removeNodeMotion(node.id, "all")}>
            <Trash2 size={12} />
          </button>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onOpenLibrary("all")}>
          <Library size={12} />
          <span>Library</span>
        </Button>
      </div>

      <div className="ed-motion-vp-bar">
        <div className="ed-motion-vp-meta">
          <span className="ed-ctrl-label" style={{ textTransform: "capitalize" }}>{viewport}</span>
          {resolved.disabledByGlobal ? (
            <Badge tone="amber">Disabled Globally</Badge>
          ) : resolved.disabledByBreakpoint ? (
            <Badge tone="amber">Disabled on {viewport}</Badge>
          ) : resolved.hasCustomOverride ? (
            <Badge tone="accent">Custom</Badge>
          ) : viewport !== "desktop" ? (
            <Badge tone="neutral">Inherited</Badge>
          ) : (
            <Badge tone="neutral">Base</Badge>
          )}
        </div>
        {viewport !== "desktop" ? (
          <div className="ed-motion-vp-actions">
            <label className="ed-check-row" style={{ fontSize: 11 }}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={resolved.disabledByBreakpoint}
                onChange={(e) =>
                  updateNodeResponsiveMotion(node.id, viewport, { enabled: !e.target.checked }, `${e.target.checked ? "Disable" : "Enable"} motion on ${viewport}`)
                }
              />
              <span>Disable</span>
            </label>
            {resolved.hasCustomOverride ? (
              <button type="button" className="ed-link-btn" disabled={disabled} onClick={() => updateNodeResponsiveMotion(node.id, viewport, null, `Reset ${viewport} motion to inherited`)}>
                Reset
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {linkedPreset ? (
        <div className="ed-motion-preset-ref">
          <div className="ed-motion-vp-meta">
            <Sparkles size={12} />
            <span>Preset: <strong>{linkedPreset.name}</strong></span>
          </div>
          <div className="ed-motion-vp-actions">
            <button type="button" className="ed-link-btn" disabled={disabled} onClick={() => setNodeMotion(node.id, { schemaVersion: 1, enabled: true, presetRef: linkedPreset.presetKey }, `Reset ${node.label} to preset ${linkedPreset.name}`)}>
              Reset
            </button>
            <button type="button" className="ed-link-btn" disabled={disabled} title="Detach preset while keeping current settings" onClick={() => setNodeMotion(node.id, { ...linkedPreset.config, ...(node.motion || {}), presetRef: undefined }, `Detach preset on ${node.label}`)}>
              <Unlink size={11} />
            </button>
          </div>
        </div>
      ) : null}

      <CollapsibleMotionGroup title="Entrance" badge={entrance.enabled && entrance.preset && entrance.preset !== "none" ? entrance.preset : null} defaultOpen>
        <div className="ed-control-stack">
          <SelectControl
            label="Animation"
            value={entrance.enabled ? entrance.preset || "none" : "none"}
            options={entranceOptions}
            disabled={disabled}
            onChange={(val) => {
              const p = val as EntrancePresetKey;
              patchSection("entrance", { ...entrance, enabled: p !== "none", preset: p, trigger: entrance.trigger || "viewport", duration: entrance.duration ?? 600, delay: entrance.delay ?? 0, easing: entrance.easing || "easeOut" }, `Set entrance ${p}`);
              if (p !== "none") replayNodeMotion(node.id);
            }}
          />
          {entrance.enabled && entrance.preset && entrance.preset !== "none" ? (
            <>
              <SelectControl label="Trigger" value={entrance.trigger || "viewport"} options={[{ value: "viewport", label: "Viewport Entry" }, { value: "load", label: "Page Load" }]} disabled={disabled} onChange={(v) => patchSection("entrance", { ...entrance, trigger: v as "load" | "viewport" }, "Update entrance trigger")} />
              <SliderControl label="Duration (ms)" value={entrance.duration ?? 600} min={100} max={2500} step={50} disabled={disabled} onChange={(v) => patchSection("entrance", { ...entrance, duration: Number(v) }, "Update entrance duration")} />
              <SliderControl label="Delay (ms)" value={entrance.delay ?? 0} min={0} max={2000} step={50} disabled={disabled} onChange={(v) => patchSection("entrance", { ...entrance, delay: Number(v) }, "Update entrance delay")} />
              <SelectControl label="Easing" value={EASING_OPTIONS.some((o) => o.value === (entrance.easing || "easeOut")) ? (entrance.easing || "easeOut") : "custom"} options={EASING_OPTIONS} disabled={disabled} onChange={(v) => patchSection("entrance", { ...entrance, easing: v }, "Update entrance easing")} />
              <PropertyPopoverRow label="Timing & Threshold" summary={`Repeat ${entrance.repeat ?? 1}× · ${Math.round((entrance.threshold ?? 0.15) * 100)}% view`} disabled={disabled}>
                <div className="ed-popover-stack">
                  <SliderControl label="Repeat Count" value={entrance.repeat ?? 1} min={1} max={10} step={1} onChange={(v) => patchSection("entrance", { ...entrance, repeat: Number(v) }, "Update entrance repeat")} />
                  <SliderControl label="Repeat Delay (ms)" value={entrance.repeatDelay ?? 0} min={0} max={3000} step={100} onChange={(v) => patchSection("entrance", { ...entrance, repeatDelay: Number(v) }, "Update repeat delay")} />
                  <SelectControl label="Direction" value={entrance.direction || "normal"} options={DIRECTION_OPTIONS} onChange={(v) => patchSection("entrance", { ...entrance, direction: v as EntranceMotionConfig["direction"] }, "Update entrance direction")} />
                  <SliderControl label="Viewport Threshold" value={entrance.threshold ?? 0.15} min={0} max={1} step={0.05} onChange={(v) => patchSection("entrance", { ...entrance, threshold: Number(v) }, "Update viewport threshold")} />
                  <SliderControl label="Offset Distance (px)" value={entrance.distance ?? 24} min={0} max={160} step={4} onChange={(v) => patchSection("entrance", { ...entrance, distance: Number(v) }, "Update entrance distance")} />
                </div>
              </PropertyPopoverRow>
            </>
          ) : null}
        </div>
      </CollapsibleMotionGroup>

      <CollapsibleMotionGroup title="Scroll" badge={scroll.enabled && scroll.effect && scroll.effect !== "none" ? scroll.mode || "scroll" : null}>
        <div className="ed-control-stack">
          <label className="ed-check-row">
            <input type="checkbox" disabled={disabled} checked={Boolean(scroll.enabled)} onChange={(e) => patchSection("scroll", { ...scroll, enabled: e.target.checked, mode: scroll.mode || "parallax", effect: scroll.effect && scroll.effect !== "none" ? scroll.effect : "parallaxVertical", intensity: scroll.intensity ?? 30, speed: scroll.speed ?? 30 }, `${e.target.checked ? "Enable" : "Disable"} scroll effect`)} />
            <span>Enable Scroll Effect</span>
          </label>
          {scroll.enabled ? (
            <>
              <SelectControl label="Mode" value={activeScrollMode} options={SCROLL_MODE_OPTIONS} disabled={disabled} onChange={(v) => { const nextMode = v as ScrollMode; patchSection("scroll", { ...scroll, enabled: true, mode: nextMode, effect: SCROLL_EFFECTS_BY_MODE[nextMode][0].value }, `Set scroll mode ${nextMode}`); }} />
              <SelectControl label="Effect" value={scroll.effect || scrollEffectOptions[0].value} options={scrollEffectOptions} disabled={disabled} onChange={(v) => patchSection("scroll", { ...scroll, effect: v as ScrollEffectKey }, `Set scroll effect ${v}`)} />
              <SliderControl label="Intensity / Speed" value={scroll.intensity ?? scroll.speed ?? 30} min={0} max={120} step={2} disabled={disabled} onChange={(v) => patchSection("scroll", { ...scroll, intensity: Number(v), speed: Number(v) }, "Update scroll intensity")} />
              <div className="ed-scroll-preview-box">
                <div className="ed-ctrl-head">
                  <span className="ed-ctrl-label">Scroll Progress Preview</span>
                  <span className="ed-ctrl-value">{scrollProgress === null ? "Live" : `${Math.round(scrollProgress)}%`}</span>
                </div>
                <input type="range" min={0} max={100} step={1} aria-label="Simulated scroll progress" value={scrollProgress ?? 50} onChange={(e) => setNodeScrollProgress(node.id, Number(e.target.value))} className="ed-range-input" />
                <div className="ed-inline-actions" style={{ marginTop: 6 }}>
                  <Button size="sm" variant="secondary" onClick={() => { setNodeScrollProgress(node.id, 0); window.setTimeout(() => setNodeScrollProgress(node.id, 50), 180); window.setTimeout(() => setNodeScrollProgress(node.id, 100), 380); }}>
                    <Play size={11} /> Scrub
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setNodeScrollProgress(node.id, null)}>Reset</Button>
                </div>
              </div>
              <PropertyPopoverRow label="Range, Min/Max & Sticky" summary={`${scroll.start ?? 0}%–${scroll.end ?? 100}% · ${scroll.direction || "normal"}`} disabled={disabled}>
                <div className="ed-popover-stack">
                  <SliderControl label="Scroll Start (%)" value={scroll.start ?? 0} min={0} max={90} step={5} onChange={(v) => patchSection("scroll", { ...scroll, start: Number(v) }, "Update scroll start")} />
                  <SliderControl label="Scroll End (%)" value={scroll.end ?? 100} min={10} max={100} step={5} onChange={(v) => patchSection("scroll", { ...scroll, end: Number(v) }, "Update scroll end")} />
                  <SelectControl label="Direction" value={scroll.direction || "normal"} options={[{ value: "normal", label: "Normal" }, { value: "reverse", label: "Reverse" }]} onChange={(v) => patchSection("scroll", { ...scroll, direction: v as ScrollMotionConfig["direction"] }, "Update scroll direction")} />
                  <SliderControl label="Viewport Offset (px)" value={scroll.offset ?? 0} min={-200} max={200} step={10} onChange={(v) => patchSection("scroll", { ...scroll, offset: Number(v) }, "Update scroll offset")} />
                  {activeScrollMode === "sticky" ? (
                    <>
                      <SliderControl label="Sticky Offset (px)" value={scroll.stickyOffset ?? 24} min={0} max={240} step={4} onChange={(v) => patchSection("scroll", { ...scroll, stickyOffset: Number(v) }, "Update sticky offset")} />
                      <SliderControl label="Sticky Duration (px)" value={scroll.stickyDuration ?? 600} min={150} max={1600} step={50} onChange={(v) => patchSection("scroll", { ...scroll, stickyDuration: Number(v) }, "Update sticky duration")} />
                    </>
                  ) : null}
                </div>
              </PropertyPopoverRow>
            </>
          ) : null}
        </div>
      </CollapsibleMotionGroup>

      <CollapsibleMotionGroup title="Hover" badge={hover.enabled && hover.preset && hover.preset !== "none" ? hover.preset : null} defaultOpen>
        <div className="ed-control-stack">
          <SelectControl
            label="Effect"
            value={hover.enabled ? hover.preset || "none" : "none"}
            options={hoverOptions}
            disabled={disabled}
            onChange={(v) => {
              const preset = v as HoverPresetKey;
              patchSection("hover", { ...hover, enabled: preset !== "none", preset, duration: hover.duration ?? 240, easing: hover.easing || "easeOut" }, `Set hover ${preset}`);
            }}
          />
          {hover.enabled && hover.preset && hover.preset !== "none" ? (
            <>
              <SliderControl label="Duration (ms)" value={hover.duration ?? 240} min={50} max={1200} step={20} disabled={disabled} onChange={(v) => patchSection("hover", { ...hover, duration: Number(v) }, "Update hover duration")} />
              <PropertyPopoverRow label="Transform, Shadow & Easing" summary={`Scale ${hover.scale ?? 1} · Y ${hover.translateY ?? 0}px`} disabled={disabled}>
                <div className="ed-popover-stack">
                  <SliderControl label="Scale" value={hover.scale ?? 1.03} min={0.8} max={1.35} step={0.01} onChange={(v) => patchSection("hover", { ...hover, scale: Number(v) }, "Update hover scale")} />
                  <SliderControl label="Translate X (px)" value={hover.translateX ?? 0} min={-40} max={40} step={1} onChange={(v) => patchSection("hover", { ...hover, translateX: Number(v) }, "Update hover X")} />
                  <SliderControl label="Translate Y (px)" value={hover.translateY ?? 0} min={-40} max={40} step={1} onChange={(v) => patchSection("hover", { ...hover, translateY: Number(v) }, "Update hover Y")} />
                  <SliderControl label="Rotate (deg)" value={hover.rotate ?? 0} min={-25} max={25} step={1} onChange={(v) => patchSection("hover", { ...hover, rotate: Number(v) }, "Update hover rotate")} />
                  <SliderControl label="Opacity" value={hover.opacity ?? 1} min={0.2} max={1} step={0.05} onChange={(v) => patchSection("hover", { ...hover, opacity: Number(v) }, "Update hover opacity")} />
                  <SliderControl label="Blur (px)" value={hover.blur ?? 0} min={0} max={12} step={0.5} onChange={(v) => patchSection("hover", { ...hover, blur: Number(v) }, "Update hover blur")} />
                  <SliderControl label="Delay (ms)" value={hover.delay ?? 0} min={0} max={500} step={20} onChange={(v) => patchSection("hover", { ...hover, delay: Number(v) }, "Update hover delay")} />
                  <SelectControl label="Easing" value={hover.easing || "easeOut"} options={EASING_OPTIONS} onChange={(v) => patchSection("hover", { ...hover, easing: v }, "Update hover easing")} />
                </div>
              </PropertyPopoverRow>
            </>
          ) : null}
        </div>
      </CollapsibleMotionGroup>

      <CollapsibleMotionGroup title="Click & Interaction" badge={interaction.enabled && interaction.preset && interaction.preset !== "none" ? interaction.preset : null}>
        <div className="ed-control-stack">
          <SelectControl
            label="Interaction Effect"
            value={interaction.enabled ? interaction.preset || "none" : "none"}
            options={interactionOptions}
            disabled={disabled}
            onChange={(v) => {
              const preset = v as InteractionPresetKey;
              patchSection("interaction", { ...interaction, enabled: preset !== "none", preset, triggers: interaction.triggers?.length ? interaction.triggers : ["click", "tap", "active"], duration: interaction.duration ?? 160 }, `Set interaction ${preset}`);
            }}
          />
          {interaction.enabled && interaction.preset && interaction.preset !== "none" ? (
            <PropertyPopoverRow label="Interaction Timing" summary={`${interaction.duration ?? 160}ms · Scale ${interaction.scale ?? 0.96}`} disabled={disabled}>
              <div className="ed-popover-stack">
                <SliderControl label="Press Scale" value={interaction.scale ?? 0.96} min={0.85} max={1.1} step={0.01} onChange={(v) => patchSection("interaction", { ...interaction, scale: Number(v) }, "Update click scale")} />
                <SliderControl label="Duration (ms)" value={interaction.duration ?? 160} min={60} max={800} step={20} onChange={(v) => patchSection("interaction", { ...interaction, duration: Number(v) }, "Update click duration")} />
                <SelectControl label="Primary Trigger" value={interaction.trigger || "click"} options={[{ value: "click", label: "Click / Tap" }, { value: "focus", label: "Focus" }, { value: "active", label: "Active Press" }, { value: "toggle", label: "Toggle State" }]} onChange={(v) => patchSection("interaction", { ...interaction, trigger: v as InteractionMotionConfig["trigger"] }, "Update interaction trigger")} />
              </div>
            </PropertyPopoverRow>
          ) : null}
        </div>
      </CollapsibleMotionGroup>

      <CollapsibleMotionGroup title="Continuous" badge={continuous.enabled && continuous.preset && continuous.preset !== "none" ? continuous.preset : null}>
        <div className="ed-control-stack">
          <SelectControl
            label="Ambient Loop"
            value={continuous.enabled ? continuous.preset || "none" : "none"}
            options={continuousOptions}
            disabled={disabled}
            onChange={(v) => {
              const preset = v as ContinuousPresetKey;
              patchSection("continuous", { ...continuous, enabled: preset !== "none", preset, duration: continuous.duration ?? 2400, infinite: continuous.infinite !== false, pauseOnHover: continuous.pauseOnHover !== false }, `Set continuous ${preset}`);
            }}
          />
          {continuous.enabled && continuous.preset && continuous.preset !== "none" ? (
            <>
              <div className="ed-motion-a11y-warn" role="note">
                <AlertTriangle size={13} />
                <span>Continuous motion can distract motion-sensitive users. Auto-disabled under <code>prefers-reduced-motion</code>.</span>
              </div>
              <PropertyPopoverRow label="Loop Timing & Pause" summary={`${continuous.duration ?? 2400}ms · ${continuous.infinite !== false ? "Infinite" : `${continuous.repeat ?? 2}×`}`} disabled={disabled}>
                <div className="ed-popover-stack">
                  <SliderControl label="Duration (ms)" value={continuous.duration ?? 2400} min={400} max={8000} step={100} onChange={(v) => patchSection("continuous", { ...continuous, duration: Number(v) }, "Update loop duration")} />
                  <label className="ed-check-row">
                    <input type="checkbox" checked={continuous.infinite !== false} onChange={(e) => patchSection("continuous", { ...continuous, infinite: e.target.checked }, "Toggle infinite loop")} />
                    <span>Infinite Repeat</span>
                  </label>
                  <label className="ed-check-row">
                    <input type="checkbox" checked={continuous.pauseOnHover !== false} onChange={(e) => patchSection("continuous", { ...continuous, pauseOnHover: e.target.checked }, "Toggle pause on hover")} />
                    <span>Pause on Hover</span>
                  </label>
                  <SelectControl label="Direction" value={continuous.direction || "normal"} options={DIRECTION_OPTIONS} onChange={(v) => patchSection("continuous", { ...continuous, direction: v as ContinuousMotionConfig["direction"] }, "Update loop direction")} />
                </div>
              </PropertyPopoverRow>
            </>
          ) : null}
        </div>
      </CollapsibleMotionGroup>

      {isTextCapable ? (
        <CollapsibleMotionGroup title="Text Animation" badge={textCfg.enabled && textCfg.preset && textCfg.preset !== "none" ? textCfg.preset : null}>
          <div className="ed-control-stack">
            <SelectControl
              label="Text Effect"
              value={textCfg.enabled ? textCfg.preset || "none" : "none"}
              options={textOptions}
              disabled={disabled}
              onChange={(v) => {
                const preset = v as TextAnimationPresetKey;
                patchSection("text", { ...textCfg, enabled: preset !== "none", preset, duration: textCfg.duration ?? 520, staggerMs: textCfg.staggerMs ?? (preset === "staggerChar" || preset === "typingEffect" ? 30 : 75) }, `Set text animation ${preset}`);
                if (preset !== "none") replayNodeMotion(node.id);
              }}
            />
            {textCfg.enabled && textCfg.preset && textCfg.preset !== "none" ? (
              <PropertyPopoverRow label="Text Timing & Stagger" summary={`${textCfg.duration ?? 520}ms · ${textCfg.staggerMs ?? 60}ms step`} disabled={disabled}>
                <div className="ed-popover-stack">
                  <SliderControl label="Duration (ms)" value={textCfg.duration ?? 520} min={150} max={4000} step={50} onChange={(v) => patchSection("text", { ...textCfg, duration: Number(v) }, "Update text duration")} />
                  <SliderControl label="Stagger Step (ms)" value={textCfg.staggerMs ?? 60} min={10} max={250} step={5} onChange={(v) => patchSection("text", { ...textCfg, staggerMs: Number(v) }, "Update text stagger")} />
                  <SliderControl label="Delay (ms)" value={textCfg.delay ?? 0} min={0} max={1500} step={50} onChange={(v) => patchSection("text", { ...textCfg, delay: Number(v) }, "Update text delay")} />
                </div>
              </PropertyPopoverRow>
            ) : null}
          </div>
        </CollapsibleMotionGroup>
      ) : null}

      {isStaggerCapable ? (
        <CollapsibleMotionGroup title="Stagger Children" badge={stagger.enabled ? `${stagger.interval ?? 80}ms` : null}>
          <div className="ed-control-stack">
            <label className="ed-check-row">
              <input type="checkbox" disabled={disabled} checked={Boolean(stagger.enabled)} onChange={(e) => { patchSection("stagger", { ...stagger, enabled: e.target.checked, preset: stagger.preset || "fadeInUp", interval: stagger.interval ?? 80, maxDelay: stagger.maxDelay ?? 600, duration: stagger.duration ?? 500, order: stagger.order || "sequential" }, `${e.target.checked ? "Enable" : "Disable"} child stagger`); if (e.target.checked) replayNodeMotion(node.id); }} />
              <span>Stagger Child Cards / Items</span>
            </label>
            {stagger.enabled ? (
              <PropertyPopoverRow label="Stagger Cadence" summary={`${stagger.interval ?? 80}ms · ${stagger.order || "sequential"} (cap ${stagger.maxDelay ?? 600}ms)`} disabled={disabled}>
                <div className="ed-popover-stack">
                  <SliderControl label="Initial Delay (ms)" value={stagger.initialDelay ?? 0} min={0} max={1000} step={25} onChange={(v) => patchSection("stagger", { ...stagger, initialDelay: Number(v) }, "Update stagger initial delay")} />
                  <SliderControl label="Interval (ms)" value={stagger.interval ?? 80} min={20} max={300} step={10} onChange={(v) => patchSection("stagger", { ...stagger, interval: Number(v) }, "Update stagger interval")} />
                  <SliderControl label="Max Total Delay Cap (ms)" value={stagger.maxDelay ?? 600} min={200} max={1500} step={50} onChange={(v) => patchSection("stagger", { ...stagger, maxDelay: Number(v) }, "Update stagger cap")} />
                  <SelectControl label="Sequence Order" value={stagger.order || "sequential"} options={[{ value: "sequential", label: "Sequential (1, 2, 3…)" }, { value: "row", label: "Row by Row" }, { value: "column", label: "Column by Column" }]} onChange={(v) => patchSection("stagger", { ...stagger, order: v as StaggerMotionConfig["order"] }, "Update stagger order")} />
                  <SelectControl label="Direction" value={stagger.direction || "forward"} options={[{ value: "forward", label: "Forward" }, { value: "reverse", label: "Reverse" }, { value: "center", label: "From Center" }]} onChange={(v) => patchSection("stagger", { ...stagger, direction: v as StaggerMotionConfig["direction"] }, "Update stagger direction")} />
                </div>
              </PropertyPopoverRow>
            ) : null}
          </div>
        </CollapsibleMotionGroup>
      ) : null}

      <CollapsibleMotionGroup title="Advanced">
        <div className="ed-control-stack">
          <label className="ed-check-row">
            <input type="checkbox" disabled={disabled} checked={node.motion?.enabled !== false} onChange={(e) => updateNodeMotion(node.id, { enabled: e.target.checked }, `${e.target.checked ? "Enable" : "Disable"} element animations`)} />
            <span>Animations Enabled on Element</span>
          </label>
          <label className="ed-ctrl-field">
            <span className="ed-ctrl-label">Custom Cubic Bezier</span>
            <input
              className="ed-text-input"
              disabled={disabled}
              placeholder="cubic-bezier(0.22, 1, 0.36, 1)"
              value={entrance.easing?.startsWith("cubic-bezier(") ? entrance.easing : ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (!v || /^cubic-bezier\(\s*[0-9]*\.?[0-9]+\s*,\s*-?[0-9]*\.?[0-9]+\s*,\s*[0-9]*\.?[0-9]+\s*,\s*-?[0-9]*\.?[0-9]+\s*\)$/.test(v)) {
                  patchSection("entrance", { ...entrance, easing: v || "easeOut" }, "Update custom easing");
                }
              }}
            />
          </label>
        </div>
      </CollapsibleMotionGroup>
    </div>
  );
}
