import type { ViewportMode } from "@/features/builder/types";

export type TypographyFontRole =
  | "primary"
  | "secondary"
  | "heading"
  | "body"
  | "monospace";

export type FontSource = "google" | "system" | "custom";

export type FontLoadingStatus = "loaded" | "loading" | "idle" | "error";

export type TypographyFontConfig = {
  family: string;
  source: FontSource;
  weights: number[];
  style: "normal" | "italic";
  fallback: string;
  url?: string;
  format?: "woff2" | "woff" | "truetype";
  variable?: boolean;
};

export type ResponsiveValue<T> = {
  desktop: T;
  tablet?: T;
  mobile?: T;
};

export type PresetCategory = "headings" | "body" | "interactive" | "custom";

export type TypographyPreset = {
  id: string;
  name: string;
  category: PresetCategory;
  builtIn: boolean;
  fontFamily: string;
  fontSize: ResponsiveValue<string> | string;
  fluidSize?: string;
  useFluid?: boolean;
  fontWeight: number;
  fontStyle?: "normal" | "italic" | "oblique";
  fontStretch?: "condensed" | "semi-condensed" | "normal" | "semi-expanded" | "expanded";
  color?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "line-through";
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight: ResponsiveValue<number | string> | number | string;
  letterSpacing?: ResponsiveValue<string> | string;
  wordSpacing?: string;
  textShadow?: string;
  textIndent?: string;
  textWrap?: "wrap" | "nowrap" | "balance" | "pretty";
  textOverflow?: "clip" | "ellipsis";
};

export type GlobalTypographyTokens = {
  schemaVersion?: number;
  headingFont: string;
  bodyFont: string;
  fonts?: Partial<Record<TypographyFontRole, TypographyFontConfig>>;
  presets?: Record<string, TypographyPreset>;
};

export type NormalizedGlobalTypography = {
  schemaVersion: number;
  headingFont: string;
  bodyFont: string;
  fonts: Record<TypographyFontRole, TypographyFontConfig>;
  presets: Record<string, TypographyPreset>;
};

export type TypographyHistoryMeta = {
  presetId?: string;
  fontRole?: TypographyFontRole;
  breakpoint?: ViewportMode | "all";
  previousValue?: unknown;
  newValue?: unknown;
  source: "manual" | "ai";
  timestamp: string;
};

export type AccessibilityWarning = {
  id: string;
  severity: "warning" | "info";
  presetId?: string;
  fontRole?: TypographyFontRole;
  field: string;
  message: string;
};

export type ResolvedResponsiveMetric<T> = {
  value: T;
  inheritedFrom: "desktop" | "tablet" | null;
  isCustomized: boolean;
};

export type TypographyAiOperation =
  | {
      type: "update_typography_font";
      role: TypographyFontRole;
      family: string;
      source?: FontSource;
      fallback?: string;
      weights?: number[];
      style?: "normal" | "italic";
    }
  | {
      type: "update_typography_preset";
      target: string;
      property?: keyof TypographyPreset;
      value?: unknown;
      responsiveValues?: Partial<ResponsiveValue<unknown>>;
      patch?: Partial<TypographyPreset>;
    }
  | {
      type: "reset_typography_preset";
      target: string;
    };
