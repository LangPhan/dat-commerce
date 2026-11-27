"use client";

import {
  CalendarClock,
  Layers,
  Palette,
  Sliders,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BLEND_MODE_OPTIONS,
  EFFECT_BY_TYPE,
  EXCLUSIVE_GROUP_OPTIONS,
  ZONE_LABELS,
} from "../catalog";
import type {
  ExperienceBlendMode,
  ExperienceSummaryDto,
  ExperienceZone,
  LayerBlendMode,
  LayerTrigger,
  RecurrenceRule,
} from "../types";
import { useExperienceStudioStore } from "./experience-store";

type InspectorTab = "effect" | "theme" | "schedule" | "interact";

function strVal(props: Record<string, unknown>, key: string, fallback = ""): string {
  const v = props[key];
  return typeof v === "string" ? v : fallback;
}

function numVal(props: Record<string, unknown>, key: string, fallback = 0): number {
  const v = props[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function boolVal(props: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = props[key];
  return typeof v === "boolean" ? v : fallback;
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <label className="exp-field">
      <div className="exp-field-head">
        <span>{label}</span>
        <code>
          {value}
          {unit}
        </code>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#FFFFFF";
  return (
    <label className="exp-field">
      <div className="exp-field-head">
        <span>{label}</span>
        <code>{safeHex.toUpperCase()}</code>
      </div>
      <div className="exp-color-row">
        <input
          type="color"
          value={safeHex}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
        />
      </div>
    </label>
  );
}

function ColorListField({
  label,
  colors,
  disabled,
  onChange,
}: {
  label: string;
  colors: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="exp-field">
      <div className="exp-field-head">
        <span>{label}</span>
        {!disabled && colors.length < 6 ? (
          <button
            type="button"
            className="exp-mini-link"
            onClick={() => onChange([...colors, "#FACC15"])}
          >
            + Add swatch
          </button>
        ) : null}
      </div>
      <div className="exp-swatch-list">
        {colors.map((hex, i) => (
          <div key={i} className="exp-swatch-chip">
            <input
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#FFFFFF"}
              disabled={disabled}
              onChange={(e) => {
                const next = [...colors];
                next[i] = e.target.value.toUpperCase();
                onChange(next);
              }}
            />
            {!disabled && colors.length > 1 ? (
              <button
                type="button"
                aria-label="Remove swatch"
                onClick={() => onChange(colors.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExperienceInspector({
  allExperiences,
  canWrite,
  canPublish,
  scheduling,
  onSchedule,
}: {
  allExperiences: ExperienceSummaryDto[];
  canWrite: boolean;
  canPublish: boolean;
  scheduling: boolean;
  onSchedule: (body: {
    startsAt: string;
    endsAt?: string | null;
    timezone: string;
    recurrenceRule: RecurrenceRule;
  }) => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("effect");

  const config = useExperienceStudioStore((s) => s.config);
  const selectedLayerId = useExperienceStudioStore((s) => s.selectedLayerId);
  const meta = useExperienceStudioStore((s) => s.meta);
  const schedule = useExperienceStudioStore((s) => s.schedule);
  const interaction = useExperienceStudioStore((s) => s.interaction);

  const updateLayer = useExperienceStudioStore((s) => s.updateLayer);
  const updateLayerProps = useExperienceStudioStore((s) => s.updateLayerProps);
  const removeLayer = useExperienceStudioStore((s) => s.removeLayer);
  const updateThemeOverride = useExperienceStudioStore((s) => s.updateThemeOverride);
  const updateMotion = useExperienceStudioStore((s) => s.updateMotion);
  const updateMeta = useExperienceStudioStore((s) => s.updateMeta);
  const updateSchedule = useExperienceStudioStore((s) => s.updateSchedule);
  const updateInteraction = useExperienceStudioStore((s) => s.updateInteraction);

  const layer = config.layers.find((l) => l.id === selectedLayerId) || null;
  const catalogDef = layer ? EFFECT_BY_TYPE[layer.type] : null;
  const disabled = !canWrite || Boolean(layer?.locked);

  const overlappingCount = allExperiences.filter(
    (e) =>
      e.id !== useExperienceStudioStore.getState().experienceId &&
      (e.status === "ACTIVE" || e.status === "SCHEDULED")
  ).length;

  return (
    <aside className="ed-right-inspector exp-inspector" aria-label="Experience Inspector">
      <div className="ed-inspector-tabs exp-inspector-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "effect"}
          className={`ed-inspector-tab exp-tab-btn${tab === "effect" ? " active" : ""}`}
          onClick={() => setTab("effect")}
        >
          <Sliders size={12} />
          <span>Effect</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "theme"}
          className={`ed-inspector-tab exp-tab-btn${tab === "theme" ? " active" : ""}`}
          onClick={() => setTab("theme")}
        >
          <Palette size={12} />
          <span>Theme</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "schedule"}
          className={`ed-inspector-tab exp-tab-btn${tab === "schedule" ? " active" : ""}`}
          onClick={() => setTab("schedule")}
        >
          <CalendarClock size={12} />
          <span>Schedule</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "interact"}
          className={`ed-inspector-tab exp-tab-btn${tab === "interact" ? " active" : ""}`}
          onClick={() => setTab("interact")}
        >
          <Layers size={12} />
          <span>Interact</span>
        </button>
      </div>

      <div className="exp-inspector-scroll">
        {tab === "effect" ? (
          !layer ? (
            <div className="exp-empty-box">
              <Sparkles size={20} />
              <strong>Select a layer</strong>
              <p>Click any layer in the left Layers tab or add a new effect to customize its properties.</p>
            </div>
          ) : (
            <div className="exp-inspector-sections">
              <div className="exp-section-card">
                <div className="exp-section-head">
                  <strong>{catalogDef?.name || layer.type}</strong>
                  {canWrite ? (
                    <button
                      type="button"
                      className="exp-danger-icon"
                      title="Delete layer"
                      onClick={() => removeLayer(layer.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>

                <label className="exp-field">
                  <span>Layer Label</span>
                  <input
                    type="text"
                    value={layer.label}
                    disabled={disabled}
                    onChange={(e) => updateLayer(layer.id, { label: e.target.value })}
                  />
                </label>

                <label className="exp-field">
                  <span>Storefront Zone</span>
                  <select
                    value={layer.zone}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLayer(layer.id, { zone: e.target.value as ExperienceZone })
                    }
                  >
                    {(catalogDef?.allowedZones || Object.keys(ZONE_LABELS)).map((z) => (
                      <option key={z} value={z}>
                        {ZONE_LABELS[z as ExperienceZone] || z}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="exp-two-col">
                  <SliderField
                    label="Opacity"
                    value={Math.round(layer.opacity * 100)}
                    min={10}
                    max={100}
                    unit="%"
                    disabled={disabled}
                    onChange={(v) => updateLayer(layer.id, { opacity: v / 100 })}
                  />
                  <SliderField
                    label="Z-Index"
                    value={layer.zIndex}
                    min={1}
                    max={60}
                    disabled={disabled}
                    onChange={(v) => updateLayer(layer.id, { zIndex: v })}
                  />
                </div>

                <div className="exp-two-col">
                  <label className="exp-field">
                    <span>Blend Mode</span>
                    <select
                      value={layer.blendMode}
                      disabled={disabled}
                      onChange={(e) =>
                        updateLayer(layer.id, { blendMode: e.target.value as LayerBlendMode })
                      }
                    >
                      <option value="normal">Normal</option>
                      <option value="screen">Screen (Glow)</option>
                      <option value="lighter">Lighter (Additive)</option>
                    </select>
                  </label>
                  <label className="exp-field">
                    <span>Trigger</span>
                    <select
                      value={layer.trigger}
                      disabled={disabled}
                      onChange={(e) =>
                        updateLayer(layer.id, { trigger: e.target.value as LayerTrigger })
                      }
                    >
                      <option value="immediate">Immediate</option>
                      <option value="on_scroll">On Scroll</option>
                      <option value="timed_burst">Timed Burst</option>
                    </select>
                  </label>
                </div>

                <div className="exp-vis-row">
                  <span>Visible on</span>
                  {(["desktop", "tablet", "mobile"] as const).map((bp) => (
                    <label key={bp} className="exp-check-pill">
                      <input
                        type="checkbox"
                        checked={layer.visibility[bp]}
                        disabled={disabled}
                        onChange={(e) =>
                          updateLayer(layer.id, {
                            visibility: { ...layer.visibility, [bp]: e.target.checked },
                          })
                        }
                      />
                      <span>{bp}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="exp-section-card">
                <div className="exp-section-head">
                  <strong>Effect Parameters</strong>
                </div>

                {layer.type === "snowfall" ? (
                  <>
                    <SliderField
                      label="Snowflake Density"
                      value={numVal(layer.props, "density", 75)}
                      min={10}
                      max={200}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { density: v })}
                    />
                    <SliderField
                      label="Fall Speed"
                      value={numVal(layer.props, "speed", 1)}
                      min={0.2}
                      max={3}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { speed: v })}
                    />
                    <SliderField
                      label="Wind Drift"
                      value={numVal(layer.props, "wind", 0.35)}
                      min={-2}
                      max={2}
                      step={0.05}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { wind: v })}
                    />
                    <label className="exp-field">
                      <span>Snow Variant</span>
                      <select
                        value={strVal(layer.props, "variant", "mixed")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { variant: e.target.value })}
                      >
                        <option value="mixed">Mixed (Bokeh + Crystal)</option>
                        <option value="soft_bokeh">Soft Bokeh</option>
                        <option value="crystal_flakes">Crystal Snowflakes</option>
                      </select>
                    </label>
                    <ColorField
                      label="Snow Color"
                      value={strVal(layer.props, "color", "#FFFFFF")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { color: c })}
                    />
                  </>
                ) : null}

                {layer.type === "blossom_petals" ? (
                  <>
                    <label className="exp-field">
                      <span>Botanical Species</span>
                      <select
                        value={strVal(layer.props, "species", "cherry_blossom")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { species: e.target.value })}
                      >
                        <option value="cherry_blossom">Cherry Blossom (Hoa Anh Đào)</option>
                        <option value="apricot_blossom">Apricot Blossom (Hoa Mai)</option>
                        <option value="peach_blossom">Peach Blossom (Hoa Đào)</option>
                        <option value="autumn_leaf">Autumn Maple Leaves</option>
                        <option value="rose_petal">Rose Petals</option>
                      </select>
                    </label>
                    <SliderField
                      label="Petal Density"
                      value={numVal(layer.props, "density", 45)}
                      min={10}
                      max={160}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { density: v })}
                    />
                    <SliderField
                      label="Drift Speed"
                      value={numVal(layer.props, "speed", 0.9)}
                      min={0.2}
                      max={2.5}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { speed: v })}
                    />
                    <SliderField
                      label="Sway Amplitude"
                      value={numVal(layer.props, "swayAmplitude", 1.2)}
                      min={0}
                      max={3}
                      step={0.1}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { swayAmplitude: v })}
                    />
                    <ColorListField
                      label="Petal Colors"
                      colors={
                        Array.isArray(layer.props.colors)
                          ? (layer.props.colors as string[])
                          : ["#FBCFE8", "#F9A8D4"]
                      }
                      disabled={disabled}
                      onChange={(colors) => updateLayerProps(layer.id, { colors })}
                    />
                  </>
                ) : null}

                {layer.type === "floating_hearts" ? (
                  <>
                    <SliderField
                      label="Heart Density"
                      value={numVal(layer.props, "density", 32)}
                      min={8}
                      max={120}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { density: v })}
                    />
                    <SliderField
                      label="Rise Speed"
                      value={numVal(layer.props, "speed", 0.85)}
                      min={0.2}
                      max={2.5}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { speed: v })}
                    />
                    <label className="exp-field">
                      <span>Motion Direction</span>
                      <select
                        value={strVal(layer.props, "direction", "rise")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { direction: e.target.value })}
                      >
                        <option value="rise">Rise Upward</option>
                        <option value="float">Gentle Float</option>
                      </select>
                    </label>
                    <ColorListField
                      label="Heart Palette"
                      colors={
                        Array.isArray(layer.props.colors)
                          ? (layer.props.colors as string[])
                          : ["#FB7185", "#F43F5E"]
                      }
                      disabled={disabled}
                      onChange={(colors) => updateLayerProps(layer.id, { colors })}
                    />
                  </>
                ) : null}

                {layer.type === "golden_particles" ? (
                  <>
                    <SliderField
                      label="Particle Density"
                      value={numVal(layer.props, "density", 65)}
                      min={10}
                      max={180}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { density: v })}
                    />
                    <SliderField
                      label="Drift Speed"
                      value={numVal(layer.props, "speed", 0.7)}
                      min={0.1}
                      max={2.5}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { speed: v })}
                    />
                    <label className="exp-field">
                      <span>Sparkle Shape</span>
                      <select
                        value={strVal(layer.props, "shape", "sparkle_star")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { shape: e.target.value })}
                      >
                        <option value="sparkle_star">4-Point Star</option>
                        <option value="gold_dust">Gold Dust</option>
                        <option value="diamond">Diamond</option>
                      </select>
                    </label>
                    <ColorListField
                      label="Gold Palette"
                      colors={
                        Array.isArray(layer.props.colors)
                          ? (layer.props.colors as string[])
                          : ["#FACC15", "#FDE047"]
                      }
                      disabled={disabled}
                      onChange={(colors) => updateLayerProps(layer.id, { colors })}
                    />
                  </>
                ) : null}

                {layer.type === "fireworks" ? (
                  <>
                    <SliderField
                      label="Burst Frequency"
                      value={numVal(layer.props, "burstRate", 0.85)}
                      min={0.2}
                      max={2.0}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { burstRate: v })}
                    />
                    <SliderField
                      label="Sparks per Burst"
                      value={numVal(layer.props, "particleCount", 56)}
                      min={20}
                      max={120}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { particleCount: v })}
                    />
                    <SliderField
                      label="Gravity"
                      value={numVal(layer.props, "gravity", 0.45)}
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { gravity: v })}
                    />
                    <label className="exp-field">
                      <span>Launch Zone</span>
                      <select
                        value={strVal(layer.props, "launchZone", "top_sky")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { launchZone: e.target.value })}
                      >
                        <option value="top_sky">Upper Sky</option>
                        <option value="full_viewport">Full Viewport</option>
                      </select>
                    </label>
                    <ColorListField
                      label="Burst Colors"
                      colors={
                        Array.isArray(layer.props.colors)
                          ? (layer.props.colors as string[])
                          : ["#EF4444", "#FACC15", "#FB923C"]
                      }
                      disabled={disabled}
                      onChange={(colors) => updateLayerProps(layer.id, { colors })}
                    />
                  </>
                ) : null}

                {layer.type === "confetti_burst" ? (
                  <>
                    <SliderField
                      label="Confetti Density"
                      value={numVal(layer.props, "density", 50)}
                      min={15}
                      max={160}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { density: v })}
                    />
                    <SliderField
                      label="Fall Speed"
                      value={numVal(layer.props, "speed", 1.0)}
                      min={0.3}
                      max={3.0}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { speed: v })}
                    />
                    <ColorListField
                      label="Confetti Colors"
                      colors={
                        Array.isArray(layer.props.colors)
                          ? (layer.props.colors as string[])
                          : ["#F43F5E", "#FACC15", "#3B82F6", "#10B981"]
                      }
                      disabled={disabled}
                      onChange={(colors) => updateLayerProps(layer.id, { colors })}
                    />
                  </>
                ) : null}

                {layer.type === "santa_sleigh" ? (
                  <>
                    <SliderField
                      label="Flight Interval"
                      value={numVal(layer.props, "flightIntervalSeconds", 14)}
                      min={6}
                      max={60}
                      unit="s"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { flightIntervalSeconds: v })}
                    />
                    <SliderField
                      label="Flight Duration"
                      value={numVal(layer.props, "flightDurationSeconds", 9)}
                      min={4}
                      max={24}
                      unit="s"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { flightDurationSeconds: v })}
                    />
                    <SliderField
                      label="Sky Altitude"
                      value={numVal(layer.props, "altitudePct", 12)}
                      min={4}
                      max={45}
                      unit="%"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { altitudePct: v })}
                    />
                    <SliderField
                      label="Scale"
                      value={numVal(layer.props, "scale", 1.0)}
                      min={0.5}
                      max={1.6}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { scale: v })}
                    />
                    <label className="exp-field">
                      <span>Flight Direction</span>
                      <select
                        value={strVal(layer.props, "direction", "ltr")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { direction: e.target.value })}
                      >
                        <option value="ltr">Left to Right</option>
                        <option value="rtl">Right to Left</option>
                      </select>
                    </label>
                    <ColorField
                      label="Sleigh Color"
                      value={strVal(layer.props, "sleighColor", "#B91C1C")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { sleighColor: c })}
                    />
                    <ColorField
                      label="Stardust Glow"
                      value={strVal(layer.props, "glowColor", "#FDE047")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { glowColor: c })}
                    />
                  </>
                ) : null}

                {layer.type === "string_lights" ? (
                  <>
                    <label className="exp-field">
                      <span>Light Style</span>
                      <select
                        value={strVal(layer.props, "style", "christmas_bulbs")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { style: e.target.value })}
                      >
                        <option value="christmas_bulbs">Christmas Bulbs</option>
                        <option value="warm_fairy">Warm Fairy</option>
                        <option value="icicle_lights">Icicle Lights</option>
                        <option value="neon_pulse">Neon Pulse</option>
                      </select>
                    </label>
                    <SliderField
                      label="Bulb Count"
                      value={numVal(layer.props, "bulbCount", 22)}
                      min={8}
                      max={48}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { bulbCount: v })}
                    />
                    <SliderField
                      label="Twinkle Speed"
                      value={numVal(layer.props, "twinkleSpeed", 1.1)}
                      min={0.3}
                      max={3}
                      step={0.1}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { twinkleSpeed: v })}
                    />
                    <SliderField
                      label="Glow Intensity"
                      value={numVal(layer.props, "glowIntensity", 0.8)}
                      min={0.1}
                      max={1}
                      step={0.05}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { glowIntensity: v })}
                    />
                    <ColorListField
                      label="Bulb Colors"
                      colors={
                        Array.isArray(layer.props.colors)
                          ? (layer.props.colors as string[])
                          : ["#EF4444", "#22C55E", "#FACC15", "#3B82F6"]
                      }
                      disabled={disabled}
                      onChange={(colors) => updateLayerProps(layer.id, { colors })}
                    />
                  </>
                ) : null}

                {layer.type === "festive_lanterns" ? (
                  <>
                    <SliderField
                      label="Lantern Count"
                      value={numVal(layer.props, "count", 6)}
                      min={2}
                      max={12}
                      step={2}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { count: v })}
                    />
                    <SliderField
                      label="Sway Intensity"
                      value={numVal(layer.props, "swayIntensity", 1.0)}
                      min={0}
                      max={2}
                      step={0.1}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { swayIntensity: v })}
                    />
                    <label className="exp-field">
                      <span>Calligraphy Emblem</span>
                      <input
                        type="text"
                        maxLength={4}
                        value={strVal(layer.props, "emblemText", "福")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { emblemText: e.target.value })}
                      />
                    </label>
                    <ColorField
                      label="Silk Color"
                      value={strVal(layer.props, "primaryColor", "#DC2626")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { primaryColor: c })}
                    />
                    <ColorField
                      label="Gold Trim"
                      value={strVal(layer.props, "trimColor", "#FACC15")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { trimColor: c })}
                    />
                  </>
                ) : null}

                {layer.type === "corner_floral_frame" ? (
                  <>
                    <label className="exp-field">
                      <span>Ornamental Motif</span>
                      <select
                        value={strVal(layer.props, "motif", "peach_branch")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { motif: e.target.value })}
                      >
                        <option value="peach_branch">Peach Blossom Branch</option>
                        <option value="apricot_branch">Apricot Blossom Branch</option>
                        <option value="cherry_branch">Cherry Blossom Branch</option>
                        <option value="pine_holly">Pine & Holly Wreath</option>
                        <option value="gold_deco">Art-Deco Gold Frame</option>
                        <option value="romantic_floral">Romantic Floral</option>
                        <option value="spiderweb_gothic">Gothic Spiderweb</option>
                      </select>
                    </label>
                    <SliderField
                      label="Corner Scale"
                      value={numVal(layer.props, "scale", 1.0)}
                      min={0.5}
                      max={1.6}
                      step={0.05}
                      unit="x"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { scale: v })}
                    />
                    <ColorField
                      label="Primary Color"
                      value={strVal(layer.props, "primaryColor", "#F472B6")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { primaryColor: c })}
                    />
                    <ColorField
                      label="Accent Color"
                      value={strVal(layer.props, "accentColor", "#FACC15")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { accentColor: c })}
                    />
                  </>
                ) : null}

                {layer.type === "promo_banner" ? (
                  <>
                    <label className="exp-field">
                      <span>Badge Label</span>
                      <input
                        type="text"
                        value={strVal(layer.props, "badgeText", "")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { badgeText: e.target.value })}
                      />
                    </label>
                    <label className="exp-field">
                      <span>Headline</span>
                      <input
                        type="text"
                        value={strVal(layer.props, "headline", "")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { headline: e.target.value })}
                      />
                    </label>
                    <label className="exp-field">
                      <span>Subtext</span>
                      <input
                        type="text"
                        value={strVal(layer.props, "subtext", "")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { subtext: e.target.value })}
                      />
                    </label>
                    <div className="exp-two-col">
                      <label className="exp-field">
                        <span>Promo Code</span>
                        <input
                          type="text"
                          value={strVal(layer.props, "promoCode", "")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { promoCode: e.target.value })}
                        />
                      </label>
                      <label className="exp-field">
                        <span>Animation</span>
                        <select
                          value={strVal(layer.props, "animationStyle", "shimmer")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { animationStyle: e.target.value })}
                        >
                          <option value="shimmer">Shimmer Sweep</option>
                          <option value="pulse_glow">Pulse Glow</option>
                          <option value="ticker">Ticker</option>
                          <option value="slide_in">Slide In</option>
                        </select>
                      </label>
                    </div>
                    <div className="exp-two-col">
                      <label className="exp-field">
                        <span>CTA Label</span>
                        <input
                          type="text"
                          value={strVal(layer.props, "ctaLabel", "")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { ctaLabel: e.target.value })}
                        />
                      </label>
                      <label className="exp-field">
                        <span>CTA URL</span>
                        <input
                          type="text"
                          value={strVal(layer.props, "ctaUrl", "/store/shop")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { ctaUrl: e.target.value })}
                        />
                      </label>
                    </div>
                    <ColorField
                      label="Background"
                      value={strVal(layer.props, "bgColor", "#18181B")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { bgColor: c })}
                    />
                    <ColorField
                      label="Accent"
                      value={strVal(layer.props, "accentColor", "#FACC15")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { accentColor: c })}
                    />
                  </>
                ) : null}

                {layer.type === "countdown_bar" ? (
                  <>
                    <label className="exp-field">
                      <span>Countdown Title</span>
                      <input
                        type="text"
                        value={strVal(layer.props, "title", "Flash Sale Ends In")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { title: e.target.value })}
                      />
                    </label>
                    <label className="exp-check-row">
                      <input
                        type="checkbox"
                        checked={boolVal(layer.props, "syncWithExperienceEnd", true)}
                        disabled={disabled}
                        onChange={(e) =>
                          updateLayerProps(layer.id, { syncWithExperienceEnd: e.target.checked })
                        }
                      />
                      <span>Auto-sync timer with scheduled End Time</span>
                    </label>
                    <label className="exp-field">
                      <span>Variant</span>
                      <select
                        value={strVal(layer.props, "variant", "full_bar")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { variant: e.target.value })}
                      >
                        <option value="full_bar">Full Top Bar</option>
                        <option value="hero_ribbon">Hero Ribbon</option>
                        <option value="floating_pill">Floating Pill</option>
                      </select>
                    </label>
                    <ColorField
                      label="Bar Background"
                      value={strVal(layer.props, "bgColor", "#991B1B")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { bgColor: c })}
                    />
                    <ColorField
                      label="Urgent Highlight"
                      value={strVal(layer.props, "urgentColor", "#FACC15")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { urgentColor: c })}
                    />
                    <div className="exp-two-col">
                      <label className="exp-field">
                        <span>CTA Label</span>
                        <input
                          type="text"
                          value={strVal(layer.props, "ctaLabel", "Grab Deal")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { ctaLabel: e.target.value })}
                        />
                      </label>
                      <label className="exp-field">
                        <span>CTA URL</span>
                        <input
                          type="text"
                          value={strVal(layer.props, "ctaUrl", "/store/shop")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { ctaUrl: e.target.value })}
                        />
                      </label>
                    </div>
                  </>
                ) : null}

                {layer.type === "ambient_glow" ? (
                  <>
                    <label className="exp-field">
                      <span>Atmosphere Style</span>
                      <select
                        value={strVal(layer.props, "style", "gold_spotlight")}
                        disabled={disabled}
                        onChange={(e) => updateLayerProps(layer.id, { style: e.target.value })}
                      >
                        <option value="frost_vignette">Arctic Frost Vignette</option>
                        <option value="rose_aura">Romantic Rose Aura</option>
                        <option value="gold_spotlight">Golden Spotlight</option>
                        <option value="aurora_ribbon">Aurora Ribbon</option>
                        <option value="crimson_glow">Crimson Glow</option>
                      </select>
                    </label>
                    <SliderField
                      label="Intensity"
                      value={numVal(layer.props, "intensity", 0.35)}
                      min={0.05}
                      max={0.9}
                      step={0.05}
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { intensity: v })}
                    />
                    <ColorField
                      label="Primary Glow"
                      value={strVal(layer.props, "primaryColor", "#FACC15")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { primaryColor: c })}
                    />
                    <ColorField
                      label="Secondary Glow"
                      value={strVal(layer.props, "secondaryColor", "#F43F5E")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { secondaryColor: c })}
                    />
                  </>
                ) : null}

                {layer.type === "floating_sticker" ? (
                  <>
                    <div className="exp-two-col">
                      <label className="exp-field">
                        <span>Sticker Text</span>
                        <input
                          type="text"
                          value={strVal(layer.props, "text", "FLASH DROP")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { text: e.target.value })}
                        />
                      </label>
                      <label className="exp-field">
                        <span>Subtext</span>
                        <input
                          type="text"
                          value={strVal(layer.props, "subtext", "")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { subtext: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="exp-two-col">
                      <label className="exp-field">
                        <span>Corner Anchor</span>
                        <select
                          value={strVal(layer.props, "anchor", "bottom-left")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { anchor: e.target.value })}
                        >
                          <option value="bottom-left">Bottom Left</option>
                          <option value="bottom-right">Bottom Right</option>
                          <option value="top-left">Top Left</option>
                          <option value="top-right">Top Right</option>
                        </select>
                      </label>
                      <label className="exp-field">
                        <span>Motion</span>
                        <select
                          value={strVal(layer.props, "motion", "float")}
                          disabled={disabled}
                          onChange={(e) => updateLayerProps(layer.id, { motion: e.target.value })}
                        >
                          <option value="float">Float</option>
                          <option value="pulse">Pulse</option>
                          <option value="gentle_swing">Gentle Swing</option>
                          <option value="none">Static</option>
                        </select>
                      </label>
                    </div>
                    <SliderField
                      label="Horizontal Offset"
                      value={numVal(layer.props, "offsetX", 2)}
                      min={1}
                      max={40}
                      unit="%"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { offsetX: v })}
                    />
                    <SliderField
                      label="Vertical Offset"
                      value={numVal(layer.props, "offsetY", 10)}
                      min={2}
                      max={40}
                      unit="%"
                      disabled={disabled}
                      onChange={(v) => updateLayerProps(layer.id, { offsetY: v })}
                    />
                    <ColorField
                      label="Background"
                      value={strVal(layer.props, "bgColor", "#DC2626")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { bgColor: c })}
                    />
                    <ColorField
                      label="Text Color"
                      value={strVal(layer.props, "textColor", "#FFFFFF")}
                      disabled={disabled}
                      onChange={(c) => updateLayerProps(layer.id, { textColor: c })}
                    />
                  </>
                ) : null}
              </div>
            </div>
          )
        ) : null}

        {tab === "theme" ? (
          <div className="exp-inspector-sections">
            <div className="exp-section-card">
              <div className="exp-section-head">
                <strong>Non-Destructive Theme Override</strong>
              </div>
              <p className="exp-muted-note">
                Overlays colors, surfaces, and CTA highlights without altering your store&apos;s permanent base theme.
              </p>

              <label className="exp-check-row">
                <input
                  type="checkbox"
                  checked={config.themeOverride.enabled}
                  disabled={!canWrite}
                  onChange={(e) => updateThemeOverride({ enabled: e.target.checked })}
                />
                <span>Enable Storefront Theme Override</span>
              </label>

              <label className="exp-field">
                <span>Override Mode</span>
                <select
                  value={config.themeOverride.mode}
                  disabled={!canWrite || !config.themeOverride.enabled}
                  onChange={(e) =>
                    updateThemeOverride({
                      mode: e.target.value as "accent_tint" | "full_palette" | "dark_luxe",
                    })
                  }
                >
                  <option value="accent_tint">Accent & Surface Tint</option>
                  <option value="full_palette">Full Custom Palette</option>
                  <option value="dark_luxe">Dark Luxe Takeover (Black Friday / Night)</option>
                </select>
              </label>

              <ColorField
                label="Primary Brand Accent"
                value={config.themeOverride.colors?.primary || "#274E36"}
                disabled={!canWrite || !config.themeOverride.enabled}
                onChange={(c) => updateThemeOverride({ colors: { primary: c } })}
              />
              <ColorField
                label="Secondary Accent"
                value={config.themeOverride.colors?.accent || "#FACC15"}
                disabled={!canWrite || !config.themeOverride.enabled}
                onChange={(c) => updateThemeOverride({ colors: { accent: c } })}
              />

              {config.themeOverride.mode !== "accent_tint" ? (
                <>
                  <ColorField
                    label="Page Background"
                    value={config.themeOverride.colors?.background || "#0B0C10"}
                    disabled={!canWrite || !config.themeOverride.enabled}
                    onChange={(c) => updateThemeOverride({ colors: { background: c } })}
                  />
                  <ColorField
                    label="Card Surface"
                    value={config.themeOverride.colors?.surface || "#14161D"}
                    disabled={!canWrite || !config.themeOverride.enabled}
                    onChange={(c) => updateThemeOverride({ colors: { surface: c } })}
                  />
                  <ColorField
                    label="Text Color"
                    value={config.themeOverride.colors?.text || "#F8FAFC"}
                    disabled={!canWrite || !config.themeOverride.enabled}
                    onChange={(c) => updateThemeOverride({ colors: { text: c } })}
                  />
                </>
              ) : null}
            </div>

            <div className="exp-section-card">
              <div className="exp-section-head">
                <strong>CTA & Motion Guardrails</strong>
              </div>
              <label className="exp-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(config.themeOverride.ctaHighlight?.enabled)}
                  disabled={!canWrite || !config.themeOverride.enabled}
                  onChange={(e) =>
                    updateThemeOverride({ ctaHighlight: { enabled: e.target.checked } })
                  }
                />
                <span>Highlight Storefront Add-to-Cart CTAs</span>
              </label>
              <label className="exp-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(config.themeOverride.ctaHighlight?.shimmer)}
                  disabled={!canWrite || !config.themeOverride.ctaHighlight?.enabled}
                  onChange={(e) =>
                    updateThemeOverride({
                      ctaHighlight: {
                        enabled: Boolean(config.themeOverride.ctaHighlight?.enabled),
                        shimmer: e.target.checked,
                      },
                    })
                  }
                />
                <span>Shimmer Animation on Buttons</span>
              </label>
              <label className="exp-check-row">
                <input
                  type="checkbox"
                  checked={config.motion.respectReducedMotion}
                  disabled={!canWrite}
                  onChange={(e) =>
                    updateMotion({ respectReducedMotion: e.target.checked })
                  }
                />
                <span>Respect prefers-reduced-motion</span>
              </label>
            </div>
          </div>
        ) : null}

        {tab === "schedule" ? (
          <div className="exp-inspector-sections">
            <div className="exp-section-card">
              <div className="exp-section-head">
                <strong>Event Metadata & Targeting</strong>
              </div>
              <label className="exp-field">
                <span>Category</span>
                <select
                  value={meta.category}
                  disabled={!canWrite}
                  onChange={(e) => updateMeta({ category: e.target.value })}
                >
                  <option value="SEASON">Season (Winter, Spring...)</option>
                  <option value="HOLIDAY">Holiday (Christmas, Halloween...)</option>
                  <option value="CULTURAL">Cultural Event (Lunar New Year...)</option>
                  <option value="OCCASION">Special Occasion (Valentine&apos;s...)</option>
                  <option value="CAMPAIGN">Marketing Campaign (Black Friday...)</option>
                  <option value="FLASH_SALE">Flash Sale</option>
                  <option value="CUSTOM">Custom Event</option>
                </select>
              </label>

              <label className="exp-field">
                <span>Target Storefront Routes (comma-separated)</span>
                <input
                  type="text"
                  value={interaction.targetPages.join(", ")}
                  disabled={!canWrite}
                  onChange={(e) =>
                    updateInteraction({
                      targetPages: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="*, /store, /store/shop*"
                />
              </label>
            </div>

            <div className="exp-section-card">
              <div className="exp-section-head">
                <strong>Automatic Schedule Window</strong>
              </div>
              <label className="exp-field">
                <span>Starts At</span>
                <input
                  type="datetime-local"
                  value={schedule.startsAt ? schedule.startsAt.slice(0, 16) : ""}
                  disabled={!canWrite}
                  onChange={(e) =>
                    updateSchedule({
                      startsAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                    })
                  }
                />
              </label>
              <label className="exp-field">
                <span>Ends At (auto-reverts storefront)</span>
                <input
                  type="datetime-local"
                  value={schedule.endsAt ? schedule.endsAt.slice(0, 16) : ""}
                  disabled={!canWrite}
                  onChange={(e) =>
                    updateSchedule({
                      endsAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                    })
                  }
                />
              </label>
              <label className="exp-field">
                <span>Recurrence</span>
                <select
                  value={schedule.recurrenceRule}
                  disabled={!canWrite}
                  onChange={(e) =>
                    updateSchedule({ recurrenceRule: e.target.value as RecurrenceRule })
                  }
                >
                  <option value="NONE">One-time event</option>
                  <option value="YEARLY">Repeat Yearly (Holiday / Season)</option>
                  <option value="MONTHLY">Repeat Monthly</option>
                </select>
              </label>
              {canPublish ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={scheduling || !schedule.startsAt}
                  onClick={() =>
                    onSchedule({
                      startsAt: schedule.startsAt,
                      endsAt: schedule.endsAt || null,
                      timezone: schedule.timezone || "UTC",
                      recurrenceRule: schedule.recurrenceRule || "NONE",
                    })
                  }
                >
                  <CalendarClock size={13} />
                  {scheduling ? "Arming Schedule..." : "Save & Arm Schedule"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "interact" ? (
          <div className="exp-inspector-sections">
            <div className="exp-section-card">
              <div className="exp-section-head">
                <strong>Multi-Event Composition Rules</strong>
              </div>
              <p className="exp-muted-note">
                Control how this experience interacts when overlapping with {overlappingCount} other active/scheduled event(s).
              </p>

              <SliderField
                label="Priority Weight"
                value={interaction.priority}
                min={0}
                max={1000}
                step={5}
                disabled={!canWrite}
                onChange={(v) => updateInteraction({ priority: v })}
              />

              <div className="exp-field">
                <span>Blend Mode</span>
                <div className="exp-blend-cards">
                  {BLEND_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canWrite}
                      className={`exp-blend-card${interaction.blendMode === opt.value ? " active" : ""}`}
                      onClick={() =>
                        updateInteraction({ blendMode: opt.value as ExperienceBlendMode })
                      }
                    >
                      <strong>{opt.label}</strong>
                      <small>{opt.description}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="exp-field">
                <span>Exclusive Conflict Groups</span>
                <div className="exp-group-chips">
                  {EXCLUSIVE_GROUP_OPTIONS.map((grp) => {
                    const active = interaction.exclusiveGroups.includes(grp.value);
                    return (
                      <button
                        key={grp.value}
                        type="button"
                        disabled={!canWrite}
                        title={grp.hint}
                        className={`exp-group-chip${active ? " active" : ""}`}
                        onClick={() => {
                          const next = active
                            ? interaction.exclusiveGroups.filter((g) => g !== grp.value)
                            : [...interaction.exclusiveGroups, grp.value];
                          updateInteraction({ exclusiveGroups: next });
                        }}
                      >
                        {grp.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <SliderField
                label="Max Particle Budget"
                value={interaction.maxParticleBudget}
                min={10}
                max={400}
                step={10}
                disabled={!canWrite}
                onChange={(v) => updateInteraction({ maxParticleBudget: v })}
              />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
