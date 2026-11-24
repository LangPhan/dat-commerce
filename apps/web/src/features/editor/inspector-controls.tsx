"use client";

import { FolderOpen, Image as ImageIcon, Plus, RotateCcw, Upload, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildBackgroundImageCss,
  parseBackgroundImage,
} from "@/features/builder/background-image";
import type {
  StylePropertyKey,
  StyleValues,
  ViewportMode,
} from "@/features/builder/types";
import { cn } from "@/lib/format";
import {
  isValidHex6,
  normalizeHexColor,
  type BrandPaletteOption,
} from "./brand-palette";

const UNITS = ["px", "rem", "%", "vw", "vh", "em"] as const;

const BG_POSITION_GRID: { value: string; label: string }[] = [
  { value: "left top", label: "Top Left" },
  { value: "center top", label: "Top Center" },
  { value: "right top", label: "Top Right" },
  { value: "left center", label: "Center Left" },
  { value: "center", label: "Center" },
  { value: "right center", label: "Center Right" },
  { value: "left bottom", label: "Bottom Left" },
  { value: "center bottom", label: "Bottom Center" },
  { value: "right bottom", label: "Bottom Right" },
];

const BG_SIZE_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "auto", label: "Auto" },
  { value: "100% auto", label: "Fit Width (100%)" },
  { value: "auto 100%", label: "Fit Height (100%)" },
];

const BG_REPEAT_OPTIONS = [
  { value: "no-repeat", label: "No Repeat" },
  { value: "repeat", label: "Tile (Repeat)" },
  { value: "repeat-x", label: "Repeat X" },
  { value: "repeat-y", label: "Repeat Y" },
];

const BG_ATTACHMENT_OPTIONS = [
  { value: "scroll", label: "Scroll" },
  { value: "fixed", label: "Fixed (Parallax)" },
];

function normalizeBackgroundPosition(raw?: string): string {
  const clean = (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!clean || clean === "center center" || clean === "50% 50%") return "center";
  if (clean === "top") return "center top";
  if (clean === "bottom") return "center bottom";
  if (clean === "left") return "left center";
  if (clean === "right") return "right center";
  return clean;
}

export function ControlField({
  label,
  hint,
  overridden = false,
  viewport,
  onReset,
  children,
}: {
  label: string;
  hint?: string;
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
        <div className="ed-ctrl-head-right">
          {hint ? <span className="ed-ctrl-value-tag">{hint}</span> : null}
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
      </div>
      {children}
    </div>
  );
}

export function ColorControl({
  label,
  value,
  placeholder = "#111318",
  palette,
  onAddPaletteColor,
  overridden,
  viewport,
  onReset,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  palette?: BrandPaletteOption[];
  onAddPaletteColor?: (name: string, hex: string) => void;
  overridden?: boolean;
  viewport?: ViewportMode;
  onReset?: () => void;
  onChange: (next: string) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [addingOpen, setAddingOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#5B46E8");
  const [addError, setAddError] = useState("");

  const trimmed = value.trim();
  const normalizedVal = trimmed.toUpperCase();
  const safeHex = isValidHex6(trimmed) ? normalizedVal : "#5B46E8";

  const hasPalette = Boolean(palette && palette.length > 0);
  const matchedPalette = hasPalette
    ? palette!.find((item) => item.hex.toUpperCase() === normalizedVal)
    : undefined;
  const isCustomValue = Boolean(hasPalette && trimmed && !matchedPalette);
  const showCustomRow = !hasPalette || customOpen || isCustomValue;

  const commitNewPaletteColor = () => {
    const cleanName = newName.trim();
    if (!cleanName) {
      setAddError("Enter a color name.");
      return;
    }
    if (!isValidHex6(newHex)) {
      setAddError("Enter a 6-digit hex (e.g. #C85A32).");
      return;
    }
    const cleanHex = normalizeHexColor(newHex);
    onAddPaletteColor?.(cleanName, cleanHex);
    onChange(cleanHex);
    setNewName("");
    setAddError("");
    setAddingOpen(false);
    setCustomOpen(false);
  };

  const hintText = hasPalette
    ? matchedPalette
      ? matchedPalette.name
      : isCustomValue
        ? "Custom"
        : undefined
    : undefined;

  return (
    <ControlField
      label={label}
      hint={hintText}
      overridden={overridden}
      viewport={viewport}
      onReset={onReset}
    >
      {hasPalette ? (
        <div className="ed-palette-control">
          <div className="ed-palette-swatches" role="group" aria-label={`${label} Brand Palette`}>
            {palette!.map((item) => {
              const active = normalizedVal === item.hex.toUpperCase();
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "ed-palette-swatch",
                    active && "active",
                    item.isCustom && "is-custom-brand"
                  )}
                  style={{ backgroundColor: item.hex }}
                  title={`${item.name} (${item.hex})`}
                  aria-label={`Select ${item.name} (${item.hex})`}
                  aria-pressed={active}
                  onClick={() => {
                    setCustomOpen(false);
                    setAddingOpen(false);
                    onChange(item.hex);
                  }}
                />
              );
            })}

            {onAddPaletteColor ? (
              <button
                type="button"
                className={cn("ed-palette-add-btn", addingOpen && "active")}
                title="Add color to Brand Palette"
                aria-label="Add color to Brand Palette"
                aria-expanded={addingOpen}
                onClick={() => {
                  setNewHex(isValidHex6(trimmed) ? normalizedVal : "#5B46E8");
                  setAddError("");
                  setAddingOpen((open) => !open);
                }}
              >
                <Plus size={12} />
              </button>
            ) : null}

            <button
              type="button"
              className={cn(
                "ed-palette-custom-btn",
                (customOpen || isCustomValue) && "active"
              )}
              aria-label={`${label} custom color`}
              aria-pressed={showCustomRow}
              onClick={() => {
                setAddingOpen(false);
                setCustomOpen((open) => !open);
              }}
            >
              <span>Custom</span>
            </button>
          </div>

          {addingOpen && onAddPaletteColor ? (
            <div className="ed-palette-add-form">
              <div className="ed-palette-add-inputs">
                <input
                  type="text"
                  aria-label="Brand color name"
                  placeholder="Name (e.g. Terracotta)"
                  maxLength={32}
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (addError) setAddError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNewPaletteColor();
                    }
                  }}
                />
                <input
                  type="color"
                  aria-label="New brand color picker"
                  value={isValidHex6(newHex) ? normalizeHexColor(newHex) : "#5B46E8"}
                  onChange={(e) => {
                    setNewHex(e.target.value.toUpperCase());
                    if (addError) setAddError("");
                  }}
                />
                <input
                  type="text"
                  aria-label="New brand color hex"
                  placeholder="#5B46E8"
                  value={newHex}
                  onChange={(e) => {
                    setNewHex(e.target.value);
                    if (addError) setAddError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNewPaletteColor();
                    }
                  }}
                />
              </div>
              {addError ? <small className="ed-palette-error">{addError}</small> : null}
              <div className="ed-palette-add-actions">
                <Button size="sm" variant="primary" onClick={commitNewPaletteColor}>
                  Save to Palette
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setAddingOpen(false);
                    setAddError("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showCustomRow ? (
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
          {hasPalette && trimmed ? (
            <button
              type="button"
              className="ed-color-clear"
              title={`Clear ${label}`}
              aria-label={`Clear ${label}`}
              onClick={() => {
                setCustomOpen(false);
                onChange("");
              }}
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      ) : null}
    </ControlField>
  );
}

export function BackgroundImageControl({
  backgroundImage,
  backgroundColor,
  backgroundPosition,
  backgroundSize,
  backgroundRepeat,
  backgroundAttachment,
  palette,
  onAddPaletteColor,
  canUploadMedia = false,
  uploading = false,
  disabled = false,
  onOpenLibrary,
  onQuickUpload,
  onChangeStyles,
}: {
  backgroundImage?: string;
  backgroundColor?: string;
  backgroundPosition?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundAttachment?: string;
  palette?: BrandPaletteOption[];
  onAddPaletteColor?: (name: string, hex: string) => void;
  canUploadMedia?: boolean;
  uploading?: boolean;
  disabled?: boolean;
  onOpenLibrary: () => void;
  onQuickUpload?: (file: File) => void;
  onChangeStyles: (patch: StyleValues) => void;
}) {
  const parsed = parseBackgroundImage(backgroundImage, backgroundColor || "#111318");
  const opacityPct = Math.round(parsed.imageOpacity * 100);
  const normPos = normalizeBackgroundPosition(backgroundPosition);

  const applyImageState = (next: {
    imageUrl: string;
    imageOpacity?: number;
    overlayColor?: string;
  }) => {
    const cleanUrl = next.imageUrl.trim();
    if (!cleanUrl) {
      onChangeStyles({
        backgroundImage: "",
        backgroundPosition: "",
        backgroundSize: "",
        backgroundRepeat: "",
        backgroundAttachment: "",
      });
      return;
    }

    const css = buildBackgroundImageCss({
      imageUrl: cleanUrl,
      imageOpacity: next.imageOpacity ?? parsed.imageOpacity,
      overlayColor: next.overlayColor ?? parsed.overlayColor,
    });
    if (!css) return;

    const patch: StyleValues = {
      backgroundImage: css,
    };
    if (!backgroundSize) patch.backgroundSize = "cover";
    if (!backgroundPosition) patch.backgroundPosition = "center";
    if (!backgroundRepeat) patch.backgroundRepeat = "no-repeat";
    onChangeStyles(patch);
  };

  return (
    <div className="ed-bg-img-card">
      <div className="ed-ctrl-head">
        <span className="ed-ctrl-label">Background Image</span>
        {parsed.imageUrl ? (
          <button
            type="button"
            className="ed-link-btn"
            disabled={disabled}
            onClick={() => applyImageState({ imageUrl: "" })}
          >
            Clear
          </button>
        ) : null}
      </div>

      {parsed.imageUrl ? (
        <div
          className="ed-bg-img-preview"
          style={{
            backgroundImage: buildBackgroundImageCss({
              imageUrl: parsed.imageUrl,
              imageOpacity: parsed.imageOpacity,
              overlayColor: parsed.overlayColor,
            }),
            backgroundPosition: backgroundPosition || "center",
            backgroundSize: backgroundSize || "cover",
            backgroundRepeat: backgroundRepeat || "no-repeat",
          }}
        >
          <span className="ed-bg-img-url-pill" title={parsed.imageUrl}>
            {parsed.imageUrl}
          </span>
        </div>
      ) : (
        <div className="ed-bg-img-empty">
          <ImageIcon size={16} />
          <span>No background image set</span>
        </div>
      )}

      <div className="ed-bg-img-actions">
        <Button
          size="sm"
          disabled={disabled}
          onClick={onOpenLibrary}
        >
          <FolderOpen size={12} />
          <span>Library</span>
        </Button>

        {canUploadMedia && onQuickUpload ? (
          <label
            className={cn(
              "ed-bg-upload-btn",
              (disabled || uploading) && "is-disabled"
            )}
          >
            <Upload size={12} />
            <span>{uploading ? "Uploading..." : "Upload"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label="Upload background image"
              disabled={disabled || uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onQuickUpload(file);
              }}
            />
          </label>
        ) : null}
      </div>

      <input
        type="text"
        aria-label="Background image URL"
        placeholder="/media/terrain-hero.jpg or /storage/..."
        disabled={disabled}
        value={parsed.imageUrl}
        onChange={(e) => {
          const val = e.target.value;
          if (!val.trim()) {
            applyImageState({ imageUrl: "" });
          } else {
            applyImageState({ imageUrl: val });
          }
        }}
      />

      {parsed.imageUrl ? (
        <div className="ed-bg-img-settings">
          <SliderControl
            label="Image Opacity"
            value={opacityPct}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(nextVal) => {
              const pct = parseFloat(nextVal);
              const nextOpacity = Number.isFinite(pct)
                ? Math.max(0, Math.min(1, pct / 100))
                : 1;
              applyImageState({
                imageUrl: parsed.imageUrl,
                imageOpacity: nextOpacity,
                overlayColor: parsed.overlayColor,
              });
            }}
          />

          <ColorControl
            label="Overlay Tint"
            value={parsed.overlayColor}
            placeholder="#111318"
            palette={palette}
            onAddPaletteColor={onAddPaletteColor}
            onChange={(nextTint) => {
              const targetHex = normalizeHexColor(nextTint, "#111318");
              const nextOpacity =
                parsed.imageOpacity >= 0.995 ? 0.65 : parsed.imageOpacity;
              applyImageState({
                imageUrl: parsed.imageUrl,
                imageOpacity: nextOpacity,
                overlayColor: targetHex,
              });
            }}
          />

          <div className="ed-ctrl-field">
            <div className="ed-ctrl-head">
              <span className="ed-ctrl-label">Position</span>
              <span className="ed-ctrl-value-tag">{normPos}</span>
            </div>
            <div className="ed-bg-pos-layout">
              <div className="ed-bg-pos-grid" role="group" aria-label="Background image position grid">
                {BG_POSITION_GRID.map((cell) => {
                  const active = normPos === cell.value;
                  return (
                    <button
                      key={cell.value}
                      type="button"
                      className={cn("ed-bg-pos-cell", active && "active")}
                      title={cell.label}
                      aria-label={`Position ${cell.label}`}
                      aria-pressed={active}
                      disabled={disabled}
                      onClick={() =>
                        onChangeStyles({ backgroundPosition: cell.value })
                      }
                    />
                  );
                })}
              </div>
              <div className="ed-bg-pos-selects">
                <SelectControl
                  label="Size"
                  value={backgroundSize || "cover"}
                  options={BG_SIZE_OPTIONS}
                  onChange={(v) => onChangeStyles({ backgroundSize: v })}
                />
                <SelectControl
                  label="Repeat"
                  value={backgroundRepeat || "no-repeat"}
                  options={BG_REPEAT_OPTIONS}
                  onChange={(v) => onChangeStyles({ backgroundRepeat: v })}
                />
              </div>
            </div>
          </div>

          <SelectControl
            label="Attachment"
            value={backgroundAttachment || "scroll"}
            options={BG_ATTACHMENT_OPTIONS}
            onChange={(v) => onChangeStyles({ backgroundAttachment: v })}
          />
        </div>
      ) : null}
    </div>
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
        aria-label={label}
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
