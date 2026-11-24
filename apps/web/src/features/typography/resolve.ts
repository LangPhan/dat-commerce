import { resolveStylesForViewport } from "@/features/builder/style-compiler";
import type {
  ElementNode,
  StylePropertyKey,
  StyleValues,
  ViewportMode,
} from "@/features/builder/types";
import { normalizeGlobalTypography } from "./defaults";
import { findCatalogFont } from "./font-catalog";
import type {
  GlobalTypographyTokens,
  NormalizedGlobalTypography,
  ResolvedResponsiveMetric,
  ResponsiveValue,
  TypographyFontConfig,
  TypographyFontRole,
  TypographyPreset,
} from "./types";

export const ELEMENT_TYPOGRAPHY_STYLE_KEYS: StylePropertyKey[] = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontStretch",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textDecoration",
  "textAlign",
  "color",
  "textShadow",
  "textIndent",
  "textWrap",
  "textOverflow",
];

export function formatCssFontStack(family: string, fallback = "sans-serif"): string {
  const needsQuotes = /\s/.test(family) && !/^["'].*["']$/.test(family);
  const quoted = needsQuotes ? `"${family}"` : family;
  return fallback ? `${quoted}, ${fallback}` : quoted;
}

export function resolveFontRoleConfig(
  fontRef: string,
  fonts: Record<TypographyFontRole, TypographyFontConfig>
): { role: TypographyFontRole | null; config: TypographyFontConfig } {
  if (fontRef in fonts) {
    const role = fontRef as TypographyFontRole;
    return { role, config: fonts[role] };
  }
  const cat = findCatalogFont(fontRef);
  return {
    role: null,
    config: {
      family: fontRef,
      source: cat?.source || "google",
      weights: cat?.weights || [400, 500, 600, 700],
      style: "normal",
      fallback: cat?.fallback || "sans-serif",
      variable: cat?.variable,
    },
  };
}

export function resolveFontFamilyCss(
  fontRef: string,
  fonts: Record<TypographyFontRole, TypographyFontConfig>,
  useCssVar = true
): string {
  if (fontRef in fonts) {
    if (useCssVar) {
      return `var(--font-${fontRef})`;
    }
    const cfg = fonts[fontRef as TypographyFontRole];
    return formatCssFontStack(cfg.family, cfg.fallback);
  }
  const cat = findCatalogFont(fontRef);
  return formatCssFontStack(fontRef, cat?.fallback || "sans-serif");
}

export function resolveResponsiveMetric<T>(
  val: ResponsiveValue<T> | T,
  viewport: ViewportMode
): ResolvedResponsiveMetric<T> {
  if (val === null || val === undefined || typeof val !== "object") {
    return {
      value: val as T,
      inheritedFrom: viewport === "desktop" ? null : "desktop",
      isCustomized: false,
    };
  }
  const map = val as ResponsiveValue<T>;
  if (viewport === "desktop") {
    return { value: map.desktop, inheritedFrom: null, isCustomized: false };
  }
  if (viewport === "tablet") {
    if (map.tablet !== undefined) {
      return { value: map.tablet, inheritedFrom: null, isCustomized: true };
    }
    return { value: map.desktop, inheritedFrom: "desktop", isCustomized: false };
  }
  if (map.mobile !== undefined) {
    return { value: map.mobile, inheritedFrom: null, isCustomized: true };
  }
  if (map.tablet !== undefined) {
    return { value: map.tablet, inheritedFrom: "tablet", isCustomized: false };
  }
  return { value: map.desktop, inheritedFrom: "desktop", isCustomized: false };
}

export function updateResponsiveMetricValue<T>(
  current: ResponsiveValue<T> | T | undefined,
  viewport: ViewportMode,
  nextVal: T,
  fallbackDesktop: T
): ResponsiveValue<T> {
  const baseObj: ResponsiveValue<T> =
    current && typeof current === "object"
      ? { ...(current as ResponsiveValue<T>) }
      : { desktop: (current as T) ?? fallbackDesktop };
  if (viewport === "desktop") {
    baseObj.desktop = nextVal;
  } else if (viewport === "tablet") {
    baseObj.tablet = nextVal;
  } else {
    baseObj.mobile = nextVal;
  }
  return baseObj;
}

export function resetResponsiveMetricViewport<T>(
  current: ResponsiveValue<T> | T | undefined,
  viewport: ViewportMode,
  fallbackDesktop: T
): ResponsiveValue<T> {
  const baseObj: ResponsiveValue<T> =
    current && typeof current === "object"
      ? { ...(current as ResponsiveValue<T>) }
      : { desktop: (current as T) ?? fallbackDesktop };
  if (viewport === "tablet") {
    delete baseObj.tablet;
  } else if (viewport === "mobile") {
    delete baseObj.mobile;
  }
  return baseObj;
}

export function getDefaultPresetForNode(node: Pick<ElementNode, "type" | "props">): string | null {
  if (node.type === "heading") {
    const rawTag = String(node.props?.tag || "h2").toLowerCase();
    if (
      rawTag === "h1" ||
      rawTag === "h2" ||
      rawTag === "h3" ||
      rawTag === "h4" ||
      rawTag === "h5" ||
      rawTag === "h6"
    ) {
      return rawTag;
    }
    if (rawTag === "p") {
      return "body";
    }
    return "h2";
  }
  if (node.type === "text_editor") {
    return "body";
  }
  if (node.type === "button") {
    return "button";
  }
  return null;
}

export function getEffectivePresetId(
  node: Pick<ElementNode, "type" | "props">,
  presets?: Record<string, TypographyPreset>
): string | null {
  const rawCustom =
    typeof node.props?.typographyPreset === "string"
      ? node.props.typographyPreset.trim().toLowerCase()
      : "";
  if (rawCustom) {
    if (!presets || presets[rawCustom]) {
      return rawCustom;
    }
  }
  const fallback = getDefaultPresetForNode(node);
  if (fallback && (!presets || presets[fallback])) {
    return fallback;
  }
  return null;
}

export function resolvePresetValuesForViewport(
  preset: TypographyPreset,
  typography: NormalizedGlobalTypography,
  viewport: ViewportMode
) {
  const fontSize = resolveResponsiveMetric(preset.fontSize, viewport);
  const lineHeight = resolveResponsiveMetric(preset.lineHeight, viewport);
  const letterSpacing = resolveResponsiveMetric(
    preset.letterSpacing ?? "0px",
    viewport
  );
  const { config: fontConfig, role: fontRole } = resolveFontRoleConfig(
    preset.fontFamily,
    typography.fonts
  );
  const effectiveFontSize =
    preset.useFluid && preset.fluidSize ? preset.fluidSize : fontSize.value;

  return {
    fontRole,
    fontFamilyName: fontConfig.family,
    fontStack: formatCssFontStack(fontConfig.family, fontConfig.fallback),
    fontSize: effectiveFontSize,
    fontSizeMeta: fontSize,
    lineHeight: String(lineHeight.value),
    lineHeightMeta: lineHeight,
    letterSpacing: String(letterSpacing.value),
    letterSpacingMeta: letterSpacing,
    fontWeight: String(preset.fontWeight ?? 400),
    fontStyle: preset.fontStyle || "normal",
    fontStretch: preset.fontStretch || "normal",
    color: preset.color || "",
    textTransform: preset.textTransform || "none",
    textDecoration: preset.textDecoration || "none",
    textAlign: preset.textAlign || "left",
    wordSpacing: preset.wordSpacing || "",
    textShadow: preset.textShadow || "",
    textIndent: preset.textIndent || "",
    textWrap: preset.textWrap || "wrap",
    textOverflow: preset.textOverflow || "clip",
  };
}

export function resolveElementTypographyState(
  node: ElementNode,
  rawTypography: GlobalTypographyTokens | NormalizedGlobalTypography | null | undefined,
  viewport: ViewportMode
) {
  const typography = normalizeGlobalTypography(rawTypography);
  const defaultPresetId = getDefaultPresetForNode(node);
  const presetId = getEffectivePresetId(node, typography.presets);
  const preset = presetId ? typography.presets[presetId] || null : null;
  const { resolved: nodeStyles } = resolveStylesForViewport(node.styles, viewport);

  const presetResolved = preset
    ? resolvePresetValuesForViewport(preset, typography, viewport)
    : null;

  const localOverriddenKeys = ELEMENT_TYPOGRAPHY_STYLE_KEYS.filter(
    (k) => nodeStyles[k] !== undefined && nodeStyles[k] !== ""
  );

  const effective: Partial<Record<StylePropertyKey, string>> = {
    fontFamily:
      nodeStyles.fontFamily ||
      presetResolved?.fontFamilyName ||
      typography.bodyFont,
    fontSize: nodeStyles.fontSize || presetResolved?.fontSize || "16px",
    fontWeight: nodeStyles.fontWeight || presetResolved?.fontWeight || "400",
    fontStyle: nodeStyles.fontStyle || presetResolved?.fontStyle || "normal",
    fontStretch: nodeStyles.fontStretch || presetResolved?.fontStretch || "normal",
    lineHeight: nodeStyles.lineHeight || presetResolved?.lineHeight || "1.6",
    letterSpacing:
      nodeStyles.letterSpacing || presetResolved?.letterSpacing || "0px",
    wordSpacing: nodeStyles.wordSpacing || presetResolved?.wordSpacing || "",
    textTransform:
      nodeStyles.textTransform || presetResolved?.textTransform || "none",
    textDecoration:
      nodeStyles.textDecoration || presetResolved?.textDecoration || "none",
    textAlign: nodeStyles.textAlign || presetResolved?.textAlign || "left",
    color: nodeStyles.color || presetResolved?.color || "",
    textShadow: nodeStyles.textShadow || presetResolved?.textShadow || "",
    textIndent: nodeStyles.textIndent || presetResolved?.textIndent || "",
    textWrap: nodeStyles.textWrap || presetResolved?.textWrap || "",
    textOverflow: nodeStyles.textOverflow || presetResolved?.textOverflow || "",
  };

  const hasAnyBreakpointLocalTypography = (
    ["base", "tablet", "mobile", "hover"] as const
  ).some((bp) => {
    const bpMap = node.styles?.[bp] as StyleValues | undefined;
    if (!bpMap) return false;
    return ELEMENT_TYPOGRAPHY_STYLE_KEYS.some(
      (k) => bpMap[k] !== undefined && bpMap[k] !== ""
    );
  });

  return {
    presetId,
    defaultPresetId,
    preset,
    isExplicitPreset:
      typeof node.props?.typographyPreset === "string" &&
      node.props.typographyPreset.trim() !== "",
    presetResolved,
    localOverriddenKeys,
    localOverrideSet: new Set(localOverriddenKeys),
    hasAnyBreakpointLocalTypography,
    effective,
  };
}
