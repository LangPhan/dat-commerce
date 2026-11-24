import type { ViewportMode } from "@/features/builder/types";
import { normalizeGlobalTypography } from "./defaults";
import { resolvePresetValuesForViewport } from "./resolve";
import type {
  AccessibilityWarning,
  GlobalTypographyTokens,
  NormalizedGlobalTypography,
  TypographyPreset,
} from "./types";

export function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  return [r, g, b];
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  return (
    0.2126 * toLinear(rgb[0]) +
    0.7152 * toLinear(rgb[1]) +
    0.0722 * toLinear(rgb[2])
  );
}

export function getContrastRatio(fgHex: string, bgHex: string): number | null {
  const l1 = getRelativeLuminance(fgHex);
  const l2 = getRelativeLuminance(bgHex);
  if (l1 === null || l2 === null) return null;
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return Number(((bright + 0.05) / (dark + 0.05)).toFixed(2));
}

function parsePxEquivalent(sizeVal: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(px|rem|em)$/.exec(sizeVal.trim());
  if (!match) return null;
  const num = Number(match[1]);
  const unit = match[2];
  return unit === "px" ? num : num * 16;
}

export function evaluatePresetAccessibility(
  preset: TypographyPreset,
  typography: NormalizedGlobalTypography,
  colors: { background?: string; text?: string },
  viewport: ViewportMode = "desktop"
): AccessibilityWarning[] {
  const warnings: AccessibilityWarning[] = [];
  const resolved = resolvePresetValuesForViewport(preset, typography, viewport);
  const pxSize = parsePxEquivalent(resolved.fontSize);

  if (pxSize !== null) {
    if ((preset.id === "body" || preset.id === "body_large") && pxSize < 14) {
      warnings.push({
        id: `${preset.id}-small-body`,
        severity: "warning",
        presetId: preset.id,
        field: "fontSize",
        message: `${preset.name} (${resolved.fontSize}) is smaller than 14px, which may reduce readability for longer passages.`,
      });
    } else if (pxSize < 11) {
      warnings.push({
        id: `${preset.id}-tiny-text`,
        severity: "warning",
        presetId: preset.id,
        field: "fontSize",
        message: `${preset.name} is below 11px (${resolved.fontSize}), which may be difficult to read on mobile displays.`,
      });
    }
  }

  const lhNum = Number(resolved.lineHeight);
  if (Number.isFinite(lhNum)) {
    if (preset.category === "headings" && lhNum < 1.05) {
      warnings.push({
        id: `${preset.id}-tight-heading-lh`,
        severity: "warning",
        presetId: preset.id,
        field: "lineHeight",
        message: `${preset.name} line-height (${lhNum}) is very tight (< 1.05) and may clip wrapped lines.`,
      });
    } else if (preset.category === "body" && lhNum < 1.35) {
      warnings.push({
        id: `${preset.id}-tight-body-lh`,
        severity: "warning",
        presetId: preset.id,
        field: "lineHeight",
        message: `${preset.name} line-height (${lhNum}) should usually be at least 1.4 for comfortable scanning.`,
      });
    }
  }

  const fgHex = preset.color && /^#[0-9A-Fa-f]{6}$/.test(preset.color)
    ? preset.color
    : colors.text || "#111318";
  const bgHex = colors.background || "#FFFFFF";
  const ratio = getContrastRatio(fgHex, bgHex);
  if (ratio !== null) {
    const isLarge =
      pxSize !== null &&
      (pxSize >= 24 || (pxSize >= 18.67 && preset.fontWeight >= 700));
    const minRatio = isLarge ? 3.0 : 4.5;
    if (ratio < minRatio) {
      warnings.push({
        id: `${preset.id}-contrast`,
        severity: "warning",
        presetId: preset.id,
        field: "color",
        message: `${preset.name} contrast ratio against store background (${ratio}:1) is below WCAG AA (${minRatio}:1).`,
      });
    }
  }

  return warnings;
}

export function evaluateTypographyAccessibility(
  rawTypography: GlobalTypographyTokens | NormalizedGlobalTypography | null | undefined,
  colors: { background?: string; text?: string } = {},
  viewport: ViewportMode = "desktop"
): AccessibilityWarning[] {
  const typo = normalizeGlobalTypography(rawTypography);
  const out: AccessibilityWarning[] = [];

  for (const [role, cfg] of Object.entries(typo.fonts)) {
    if (!cfg.fallback?.trim()) {
      out.push({
        id: `font-${role}-fallback`,
        severity: "info",
        fontRole: role as AccessibilityWarning["fontRole"],
        field: "fallback",
        message: `Font role "${role}" does not specify a fallback font stack.`,
      });
    }
  }

  for (const preset of Object.values(typo.presets)) {
    out.push(...evaluatePresetAccessibility(preset, typo, colors, viewport));
  }

  return out;
}
