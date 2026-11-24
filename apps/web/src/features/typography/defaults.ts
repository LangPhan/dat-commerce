import { findCatalogFont } from "./font-catalog";
import type {
  GlobalTypographyTokens,
  NormalizedGlobalTypography,
  PresetCategory,
  TypographyFontConfig,
  TypographyFontRole,
  TypographyPreset,
} from "./types";

export const FONT_ROLE_METADATA: Record<
  TypographyFontRole,
  { label: string; description: string }
> = {
  primary: {
    label: "Primary Font",
    description: "Main brand interface family used across UI controls and general copy.",
  },
  secondary: {
    label: "Secondary Font",
    description: "Complementary accent family for editorial callouts and subtitles.",
  },
  heading: {
    label: "Heading Font",
    description: "Display family inherited by H1–H6 heading presets.",
  },
  body: {
    label: "Body Font",
    description: "Readable text family inherited by body paragraphs and descriptions.",
  },
  monospace: {
    label: "Monospace Font",
    description: "Fixed-width family for SKU codes, specifications, and technical badges.",
  },
};

export const PRESET_CATEGORY_LABELS: Record<PresetCategory, string> = {
  headings: "Headings",
  body: "Body Text",
  interactive: "Interactive Text",
  custom: "Custom Presets",
};

export const DEFAULT_FONT_CONFIGS: Record<TypographyFontRole, TypographyFontConfig> = {
  primary: {
    family: "Inter",
    source: "google",
    weights: [400, 500, 600, 700],
    style: "normal",
    fallback: "system-ui, -apple-system, sans-serif",
    variable: true,
  },
  secondary: {
    family: "Plus Jakarta Sans",
    source: "google",
    weights: [400, 500, 600, 700],
    style: "normal",
    fallback: "sans-serif",
    variable: true,
  },
  heading: {
    family: "Georgia",
    source: "system",
    weights: [400, 700],
    style: "normal",
    fallback: '"Times New Roman", serif',
  },
  body: {
    family: "Inter",
    source: "google",
    weights: [400, 500, 600, 700],
    style: "normal",
    fallback: "system-ui, -apple-system, sans-serif",
    variable: true,
  },
  monospace: {
    family: "JetBrains Mono",
    source: "google",
    weights: [400, 500, 600, 700],
    style: "normal",
    fallback: "ui-monospace, monospace",
    variable: true,
  },
};

export const DEFAULT_TYPOGRAPHY_PRESETS: Record<string, TypographyPreset> = {
  h1: {
    id: "h1",
    name: "Heading 1",
    category: "headings",
    builtIn: true,
    fontFamily: "heading",
    fontSize: { desktop: "48px", tablet: "38px", mobile: "30px" },
    fluidSize: "clamp(1.875rem, 1.45rem + 1.8vw, 3rem)",
    useFluid: false,
    fontWeight: 700,
    fontStyle: "normal",
    lineHeight: { desktop: 1.2, tablet: 1.25, mobile: 1.3 },
    letterSpacing: { desktop: "-1px", tablet: "-0.5px", mobile: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  h2: {
    id: "h2",
    name: "Heading 2",
    category: "headings",
    builtIn: true,
    fontFamily: "heading",
    fontSize: { desktop: "36px", tablet: "30px", mobile: "26px" },
    fluidSize: "clamp(1.625rem, 1.35rem + 1.2vw, 2.25rem)",
    useFluid: false,
    fontWeight: 700,
    fontStyle: "normal",
    lineHeight: { desktop: 1.25, tablet: 1.28, mobile: 1.32 },
    letterSpacing: { desktop: "-0.5px", tablet: "-0.25px", mobile: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  h3: {
    id: "h3",
    name: "Heading 3",
    category: "headings",
    builtIn: true,
    fontFamily: "heading",
    fontSize: { desktop: "28px", tablet: "24px", mobile: "22px" },
    fluidSize: "clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem)",
    useFluid: false,
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: { desktop: 1.3 },
    letterSpacing: { desktop: "-0.25px", mobile: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  h4: {
    id: "h4",
    name: "Heading 4",
    category: "headings",
    builtIn: true,
    fontFamily: "heading",
    fontSize: { desktop: "22px", tablet: "20px", mobile: "18px" },
    useFluid: false,
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: { desktop: 1.35 },
    letterSpacing: { desktop: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  h5: {
    id: "h5",
    name: "Heading 5",
    category: "headings",
    builtIn: true,
    fontFamily: "heading",
    fontSize: { desktop: "18px", tablet: "17px", mobile: "16px" },
    useFluid: false,
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: { desktop: 1.4 },
    letterSpacing: { desktop: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  h6: {
    id: "h6",
    name: "Heading 6",
    category: "headings",
    builtIn: true,
    fontFamily: "heading",
    fontSize: { desktop: "15px", tablet: "15px", mobile: "14px" },
    useFluid: false,
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: { desktop: 1.45 },
    letterSpacing: { desktop: "0.02em" },
    textTransform: "none",
    textDecoration: "none",
  },
  body_large: {
    id: "body_large",
    name: "Body Large",
    category: "body",
    builtIn: true,
    fontFamily: "body",
    fontSize: { desktop: "18px", tablet: "17px", mobile: "16px" },
    useFluid: false,
    fontWeight: 400,
    fontStyle: "normal",
    lineHeight: { desktop: 1.65 },
    letterSpacing: { desktop: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  body: {
    id: "body",
    name: "Body",
    category: "body",
    builtIn: true,
    fontFamily: "body",
    fontSize: { desktop: "16px", tablet: "16px", mobile: "15px" },
    useFluid: false,
    fontWeight: 400,
    fontStyle: "normal",
    lineHeight: { desktop: 1.6 },
    letterSpacing: { desktop: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  body_small: {
    id: "body_small",
    name: "Body Small",
    category: "body",
    builtIn: true,
    fontFamily: "body",
    fontSize: { desktop: "14px", tablet: "14px", mobile: "13px" },
    useFluid: false,
    fontWeight: 400,
    fontStyle: "normal",
    lineHeight: { desktop: 1.55 },
    letterSpacing: { desktop: "0px" },
    textTransform: "none",
    textDecoration: "none",
  },
  caption: {
    id: "caption",
    name: "Caption",
    category: "body",
    builtIn: true,
    fontFamily: "body",
    fontSize: { desktop: "12px", tablet: "12px", mobile: "12px" },
    useFluid: false,
    fontWeight: 500,
    fontStyle: "normal",
    lineHeight: { desktop: 1.4 },
    letterSpacing: { desktop: "0.01em" },
    textTransform: "none",
    textDecoration: "none",
  },
  overline: {
    id: "overline",
    name: "Overline",
    category: "body",
    builtIn: true,
    fontFamily: "primary",
    fontSize: { desktop: "11px", tablet: "11px", mobile: "11px" },
    useFluid: false,
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: { desktop: 1.4 },
    letterSpacing: { desktop: "0.12em" },
    textTransform: "uppercase",
    textDecoration: "none",
  },
  link: {
    id: "link",
    name: "Link",
    category: "interactive",
    builtIn: true,
    fontFamily: "primary",
    fontSize: { desktop: "15px", tablet: "15px", mobile: "15px" },
    useFluid: false,
    fontWeight: 500,
    fontStyle: "normal",
    lineHeight: { desktop: 1.5 },
    letterSpacing: { desktop: "0px" },
    textTransform: "none",
    textDecoration: "underline",
  },
  button: {
    id: "button",
    name: "Button",
    category: "interactive",
    builtIn: true,
    fontFamily: "primary",
    fontSize: { desktop: "14px", tablet: "14px", mobile: "14px" },
    useFluid: false,
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: { desktop: 1.2 },
    letterSpacing: { desktop: "0.01em" },
    textTransform: "none",
    textDecoration: "none",
  },
  label: {
    id: "label",
    name: "Label",
    category: "interactive",
    builtIn: true,
    fontFamily: "primary",
    fontSize: { desktop: "13px", tablet: "13px", mobile: "13px" },
    useFluid: false,
    fontWeight: 500,
    fontStyle: "normal",
    lineHeight: { desktop: 1.4 },
    letterSpacing: { desktop: "0.01em" },
    textTransform: "none",
    textDecoration: "none",
  },
};

export const BUILTIN_PRESET_ORDER: string[] = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "body_large",
  "body",
  "body_small",
  "caption",
  "overline",
  "link",
  "button",
  "label",
];

export const DEFAULT_PREVIEW_SAMPLES: Record<string, string> = {
  h1: "Discover Your Style",
  h2: "Explore Our Collections",
  h3: "Featured Products",
  h4: "New Arrivals",
  h5: "Popular Categories",
  h6: "Product Specifications",
  body_large: "Designed for everyday durability, tactile comfort, and clean silhouettes.",
  body: "Discover a collection designed for everyday life.",
  body_small: "Additional information about this product.",
  caption: "Limited time offer.",
  overline: "Autumn / Studio & Field",
  link: "Explore full sizing guide",
  button: "Shop the collection",
  label: "Express Carbon-Neutral Delivery",
};

function makeFontFromFamily(
  family: string,
  fallbackConfig: TypographyFontConfig
): TypographyFontConfig {
  const cat = findCatalogFont(family);
  if (!cat) {
    return { ...fallbackConfig, family };
  }
  return {
    family: cat.family,
    source: cat.source,
    weights: cat.weights,
    style: "normal",
    fallback: cat.fallback,
    variable: cat.variable,
  };
}

export function cloneTypography(t: NormalizedGlobalTypography): NormalizedGlobalTypography {
  return JSON.parse(JSON.stringify(t)) as NormalizedGlobalTypography;
}

export function normalizeGlobalTypography(
  raw?: Partial<GlobalTypographyTokens> | null
): NormalizedGlobalTypography {
  const headingFamily = raw?.fonts?.heading?.family || raw?.headingFont || DEFAULT_FONT_CONFIGS.heading.family;
  const bodyFamily = raw?.fonts?.body?.family || raw?.bodyFont || DEFAULT_FONT_CONFIGS.body.family;

  const fonts: Record<TypographyFontRole, TypographyFontConfig> = {
    primary: raw?.fonts?.primary
      ? { ...DEFAULT_FONT_CONFIGS.primary, ...raw.fonts.primary }
      : makeFontFromFamily(bodyFamily, DEFAULT_FONT_CONFIGS.primary),
    secondary: raw?.fonts?.secondary
      ? { ...DEFAULT_FONT_CONFIGS.secondary, ...raw.fonts.secondary }
      : { ...DEFAULT_FONT_CONFIGS.secondary },
    heading: raw?.fonts?.heading
      ? { ...DEFAULT_FONT_CONFIGS.heading, ...raw.fonts.heading }
      : makeFontFromFamily(headingFamily, DEFAULT_FONT_CONFIGS.heading),
    body: raw?.fonts?.body
      ? { ...DEFAULT_FONT_CONFIGS.body, ...raw.fonts.body }
      : makeFontFromFamily(bodyFamily, DEFAULT_FONT_CONFIGS.body),
    monospace: raw?.fonts?.monospace
      ? { ...DEFAULT_FONT_CONFIGS.monospace, ...raw.fonts.monospace }
      : { ...DEFAULT_FONT_CONFIGS.monospace },
  };

  const presets: Record<string, TypographyPreset> = {};
  for (const id of BUILTIN_PRESET_ORDER) {
    const def = DEFAULT_TYPOGRAPHY_PRESETS[id];
    const override = raw?.presets?.[id];
    presets[id] = override
      ? {
          ...def,
          ...override,
          id,
          builtIn: true,
        }
      : { ...def };
  }

  if (raw?.presets) {
    for (const [id, preset] of Object.entries(raw.presets)) {
      if (!presets[id] && preset) {
        presets[id] = {
          ...preset,
          id,
          builtIn: false,
          category: preset.category || "custom",
        };
      }
    }
  }

  return {
    schemaVersion: raw?.schemaVersion ?? 1,
    headingFont: fonts.heading.family,
    bodyFont: fonts.body.family,
    fonts,
    presets,
  };
}

export function getOrderedPresetList(
  presets: Record<string, TypographyPreset>
): TypographyPreset[] {
  const seen = new Set<string>();
  const ordered: TypographyPreset[] = [];
  for (const id of BUILTIN_PRESET_ORDER) {
    if (presets[id]) {
      ordered.push(presets[id]);
      seen.add(id);
    }
  }
  const custom = Object.values(presets)
    .filter((p) => !seen.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...ordered, ...custom];
}

export function slugifyPresetId(name: string, existing: Record<string, TypographyPreset>): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || "custom_style";
  if (!existing[base]) return base;
  let suffix = 2;
  while (existing[`${base}_${suffix}`]) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export function createCustomPreset(
  name: string,
  basePreset: TypographyPreset,
  existing: Record<string, TypographyPreset>
): TypographyPreset {
  const trimmed = name.trim() || "Custom Style";
  const id = slugifyPresetId(trimmed, existing);
  return {
    ...JSON.parse(JSON.stringify(basePreset)),
    id,
    name: trimmed,
    category: "custom",
    builtIn: false,
  };
}

export function resetSinglePreset(
  typography: NormalizedGlobalTypography,
  presetId: string
): NormalizedGlobalTypography {
  const def = DEFAULT_TYPOGRAPHY_PRESETS[presetId];
  if (!def) return typography;
  return {
    ...typography,
    presets: {
      ...typography.presets,
      [presetId]: JSON.parse(JSON.stringify(def)) as TypographyPreset,
    },
  };
}

export function resetAllTypography(): NormalizedGlobalTypography {
  return normalizeGlobalTypography(null);
}
