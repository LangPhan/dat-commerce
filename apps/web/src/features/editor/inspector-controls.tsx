"use client";

import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StylePropertyKey, ViewportMode } from "@/features/builder/types";
import { cn } from "@/lib/format";

const UNITS = ["px", "rem", "%", "vw", "vh", "em"] as const;

export function ControlField({
  label,
  overridden = false,
  viewport,
  onReset,
  children,
}: {
  label: string;
  overridden?: boolean;
  viewport?: ViewportMode;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="ed-ctrl-field">
      <div className="ed-ctrl-head">
        <span className="ed-ctrl-label">
          {label}
          {overridden && viewport && viewport !== "desktop" ? (
            <span className="ed-override-dot" title={`Overridden on ${viewport}`}>
              {viewport === "tablet" ? "T" : "M"}
            </span>
          ) : null}
        </span>
        {overridden && onReset ? (
          <button
            type="button"
            className="ed-reset-override"
            title="Reset viewport override"
            onClick={onReset}
          >
            <RotateCcw size={10} />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ColorControl({
  label,
  value,
  placeholder = "#111318",
  overridden,
  viewport,
  onReset,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  overridden?: boolean;
  viewport?: ViewportMode;
  onReset?: () => void;
  onChange: (next: string) => void;
}) {
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(value.trim()) ? value.trim() : "#5B46E8";
  return (
    <ControlField
      label={label}
      overridden={overridden}
      viewport={viewport}
      onReset={onReset}
    >
      <div className="ed-color-row">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={safeHex}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          aria-label={`${label} hex value`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </ControlField>
  );
}

function parseUnitValue(raw: string): { num: string; unit: string } {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "auto" || trimmed === "fit-content") {
    return { num: trimmed, unit: "px" };
  }
  const match = /^(-?\d+(?:\.\d+)?)\s*(px|rem|em|%|vw|vh)$/i.exec(trimmed);
  if (match) {
    return { num: match[1], unit: match[2].toLowerCase() };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return { num: trimmed, unit: "px" };
  }
  return { num: trimmed, unit: "px" };
}

export function UnitControl({
  label,
  value,
  placeholder = "auto",
  overridden,
  viewport,
  onReset,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  overridden?: boolean;
  viewport?: ViewportMode;
  onReset?: () => void;
  onChange: (next: string) => void;
}) {
  const parsed = parseUnitValue(value);
  const unitItems = UNITS.map((u) => ({ value: u, label: u }));
  const isKeyword =
    parsed.num === "auto" || parsed.num === "fit-content" || parsed.num === "100%";

  return (
    <ControlField
      label={label}
      overridden={overridden}
      viewport={viewport}
      onReset={onReset}
    >
      <div className="ed-unit-row">
        <input
          type="text"
          aria-label={label}
          value={isKeyword ? value : parsed.num}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              onChange("");
              return;
            }
            if (raw === "auto" || raw === "fit-content" || /^-?\d+(?:\.\d+)?(px|rem|em|%|vw|vh)$/i.test(raw)) {
              onChange(raw);
              return;
            }
            if (/^-?\d*(?:\.\d*)?$/.test(raw)) {
              onChange(raw ? `${raw}${parsed.unit}` : "");
            } else {
              onChange(raw);
            }
          }}
        />
        <Select
          items={unitItems}
          value={UNITS.includes(parsed.unit as (typeof UNITS)[number]) ? parsed.unit : "px"}
          onValueChange={(nextUnit) => {
            if (!nextUnit) return;
            const n = parseFloat(parsed.num);
            if (Number.isFinite(n)) {
              onChange(`${n}${nextUnit}`);
            }
          }}
        >
          <SelectTrigger aria-label={`${label} unit`} size="sm" className="ed-unit-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitItems.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ControlField>
  );
}

export function SpacingBoxControl({
  title,
  values,
  overriddenKeys,
  viewport,
  onChangeKey,
  onResetAll,
}: {
  title: string;
  values: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  keys: {
    top: StylePropertyKey;
    right: StylePropertyKey;
    bottom: StylePropertyKey;
    left: StylePropertyKey;
  };
  overriddenKeys: Set<StylePropertyKey>;
  viewport: ViewportMode;
  onChangeKey: (side: "top" | "right" | "bottom" | "left", next: string) => void;
  onResetAll?: () => void;
}) {
  const [linked, setLinked] = useState(false);

  const handleSide = (side: "top" | "right" | "bottom" | "left", next: string) => {
    if (linked) {
      onChangeKey("top", next);
      onChangeKey("right", next);
      onChangeKey("bottom", next);
      onChangeKey("left", next);
      return;
    }
    onChangeKey(side, next);
  };

  return (
    <div className="ed-spacing-box">
      <div className="ed-ctrl-head">
        <span className="ed-ctrl-label">{title}</span>
        <div className="ed-spacing-actions">
          <button
            type="button"
            className={cn("ed-mini-toggle", linked && "active")}
            onClick={() => setLinked((v) => !v)}
            title="Link all four sides"
          >
            {linked ? "Linked" : "Link"}
          </button>
          {onResetAll ? (
            <button
              type="button"
              className="ed-reset-override"
              title={`Reset ${title.toLowerCase()} overrides`}
              onClick={onResetAll}
            >
              <RotateCcw size={10} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="ed-spacing-grid">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <label key={side} className="ed-spacing-cell">
            <span>{side[0].toUpperCase()}</span>
            <input
              type="text"
              aria-label={`${title} ${side}`}
              placeholder="0px"
              value={values[side]}
              onChange={(e) => handleSide(side, e.target.value)}
            />
          </label>
        ))}
      </div>
      {viewport !== "desktop" && overriddenKeys.size > 0 ? (
        <small className="ed-hint">Editing {viewport} overrides</small>
      ) : null}
    </div>
  );
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  overridden,
  viewport,
  onReset,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  overridden?: boolean;
  viewport?: ViewportMode;
  onReset?: () => void;
  onChange: (next: string) => void;
}) {
  return (
    <ControlField
      label={`${label} (${value}${unit})`}
      overridden={overridden}
      viewport={viewport}
      onReset={onReset}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(`${e.target.value}${unit}`)}
      />
    </ControlField>
  );
}

export function SelectControl({
  label,
  value,
  options,
  overridden,
  viewport,
  onReset,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  overridden?: boolean;
  viewport?: ViewportMode;
  onReset?: () => void;
  onChange: (next: string) => void;
}) {
  const safeVal = options.some((o) => o.value === value) ? value : options[0]?.value || "";
  return (
    <ControlField
      label={label}
      overridden={overridden}
      viewport={viewport}
      onReset={onReset}
    >
      <Select
        items={options}
        value={safeVal}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger aria-label={label} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ControlField>
  );
}
