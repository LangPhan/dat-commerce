import type { ViewportMode } from "@/features/builder/types";
import { getOrderedPresetList, normalizeGlobalTypography } from "./defaults";
import {
  formatCssFontStack,
  resolveFontFamilyCss,
  resolveResponsiveMetric,
} from "./resolve";
import type {
  GlobalTypographyTokens,
  NormalizedGlobalTypography,
  TypographyFontRole,
  TypographyPreset,
} from "./types";

function escapeCssUrl(url: string): string {
  return url.replace(/["\\\n\r()]/g, "");
}

function escapeCssIdentString(value: string): string {
  return value.replace(/["\\\n\r]/g, "");
}

function compileCustomFontFaces(typography: NormalizedGlobalTypography): string[] {
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const role of Object.keys(typography.fonts) as TypographyFontRole[]) {
    const cfg = typography.fonts[role];
    if (cfg.source !== "custom" || !cfg.url) continue;
    const key = `${cfg.family}|${cfg.url}|${cfg.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fmt = cfg.format || (cfg.url.endsWith(".woff") ? "woff" : cfg.url.endsWith(".ttf") ? "truetype" : "woff2");
    blocks.push(
      `@font-face {\n  font-family: "${escapeCssIdentString(cfg.family)}";\n  src: url("${escapeCssUrl(cfg.url)}") format("${fmt}");\n  font-weight: 100 900;\n  font-style: ${cfg.style || "normal"};\n  font-display: swap;\n}`
    );
  }
  return blocks;
}

function buildPresetVarsForViewport(
  preset: TypographyPreset,
  typography: NormalizedGlobalTypography,
  viewport: ViewportMode
): string[] {
  const id = preset.id;
  const vars: string[] = [];
  const familyCss = resolveFontFamilyCss(preset.fontFamily, typography.fonts, true);
  const sizeRes = resolveResponsiveMetric(preset.fontSize, viewport);
  const effectiveSize =
    preset.useFluid && preset.fluidSize ? preset.fluidSize : sizeRes.value;
  const lhRes = resolveResponsiveMetric(preset.lineHeight, viewport);
  const lsRes = resolveResponsiveMetric(preset.letterSpacing ?? "0px", viewport);

  vars.push(`  --text-${id}-family: ${familyCss};`);
  vars.push(`  --text-${id}-size: ${effectiveSize};`);
  vars.push(`  --text-${id}-weight: ${preset.fontWeight ?? 400};`);
  vars.push(`  --text-${id}-style: ${preset.fontStyle || "normal"};`);
  if (preset.fontStretch && preset.fontStretch !== "normal") {
    vars.push(`  --text-${id}-stretch: ${preset.fontStretch};`);
  }
  vars.push(`  --text-${id}-line-height: ${lhRes.value};`);
  vars.push(`  --text-${id}-letter-spacing: ${lsRes.value};`);
  vars.push(`  --text-${id}-transform: ${preset.textTransform || "none"};`);
  vars.push(`  --text-${id}-decoration: ${preset.textDecoration || "none"};`);
  if (preset.textAlign) {
    vars.push(`  --text-${id}-align: ${preset.textAlign};`);
  }
  if (preset.color) {
    vars.push(`  --text-${id}-color: ${preset.color};`);
  }
  if (preset.wordSpacing) {
    vars.push(`  --text-${id}-word-spacing: ${preset.wordSpacing};`);
  }
  if (preset.textShadow && preset.textShadow !== "none") {
    vars.push(`  --text-${id}-shadow: ${preset.textShadow};`);
  }
  if (preset.textIndent) {
    vars.push(`  --text-${id}-indent: ${preset.textIndent};`);
  }
  if (preset.textWrap) {
    vars.push(`  --text-${id}-wrap: ${preset.textWrap};`);
  }
  if (preset.textOverflow) {
    vars.push(`  --text-${id}-overflow: ${preset.textOverflow};`);
  }
  return vars;
}

function buildMediaOverrideVars(
  presets: TypographyPreset[],
  viewport: "tablet" | "mobile"
): string[] {
  const vars: string[] = [];
  for (const preset of presets) {
    const id = preset.id;
    if (!(preset.useFluid && preset.fluidSize) && typeof preset.fontSize === "object") {
      const val = preset.fontSize[viewport];
      if (val !== undefined) {
        vars.push(`  --text-${id}-size: ${val};`);
      }
    }
    if (typeof preset.lineHeight === "object") {
      const val = preset.lineHeight[viewport];
      if (val !== undefined) {
        vars.push(`  --text-${id}-line-height: ${val};`);
      }
    }
    if (preset.letterSpacing && typeof preset.letterSpacing === "object") {
      const val = preset.letterSpacing[viewport];
      if (val !== undefined) {
        vars.push(`  --text-${id}-letter-spacing: ${val};`);
      }
    }
  }
  return vars;
}

function buildPresetClassRule(
  scopeSelector: string,
  preset: TypographyPreset
): string {
  const id = preset.id;
  const props: string[] = [
    `  font-family: var(--text-${id}-family);`,
    `  font-size: var(--text-${id}-size);`,
    `  font-weight: var(--text-${id}-weight);`,
    `  font-style: var(--text-${id}-style);`,
    `  line-height: var(--text-${id}-line-height);`,
    `  letter-spacing: var(--text-${id}-letter-spacing);`,
    `  text-transform: var(--text-${id}-transform);`,
    `  text-decoration: var(--text-${id}-decoration);`,
  ];
  if (preset.fontStretch && preset.fontStretch !== "normal") {
    props.push(`  font-stretch: var(--text-${id}-stretch);`);
  }
  if (preset.textAlign) {
    props.push(`  text-align: var(--text-${id}-align);`);
  }
  if (preset.color) {
    props.push(`  color: var(--text-${id}-color);`);
  }
  if (preset.wordSpacing) {
    props.push(`  word-spacing: var(--text-${id}-word-spacing);`);
  }
  if (preset.textShadow && preset.textShadow !== "none") {
    props.push(`  text-shadow: var(--text-${id}-shadow);`);
  }
  if (preset.textIndent) {
    props.push(`  text-indent: var(--text-${id}-indent);`);
  }
  if (preset.textWrap) {
    props.push(`  text-wrap: var(--text-${id}-wrap);`);
  }
  if (preset.textOverflow) {
    props.push(`  text-overflow: var(--text-${id}-overflow);`);
  }
  return `:where(${scopeSelector}) [data-typography-preset="${id}"] {\n${props.join("\n")}\n}`;
}

export function compileGlobalTypographyCss(
  rawTypography: GlobalTypographyTokens | NormalizedGlobalTypography | null | undefined,
  opts?: {
    scopeSelector?: string;
    forceViewport?: ViewportMode;
  }
): string {
  const typography = normalizeGlobalTypography(rawTypography);
  const scopeSelector = opts?.scopeSelector || ":root, .store.public-store";
  const activeViewport: ViewportMode = opts?.forceViewport || "desktop";
  const orderedPresets = getOrderedPresetList(typography.presets);

  const chunks: string[] = [];

  // 1. Custom uploaded @font-face declarations
  chunks.push(...compileCustomFontFaces(typography));

  // 2. Root / scoped CSS Custom Properties (--font-* + --text-*-*)
  const rootVars: string[] = [];
  for (const role of [
    "primary",
    "secondary",
    "heading",
    "body",
    "monospace",
  ] as TypographyFontRole[]) {
    const cfg = typography.fonts[role];
    rootVars.push(`  --font-${role}: ${formatCssFontStack(cfg.family, cfg.fallback)};`);
  }
  rootVars.push(`  --store-font-heading: var(--font-heading);`);
  rootVars.push(`  --store-font-body: var(--font-body);`);

  for (const preset of orderedPresets) {
    rootVars.push(...buildPresetVarsForViewport(preset, typography, activeViewport));
  }

  chunks.push(`${scopeSelector} {\n${rootVars.join("\n")}\n}`);

  // 3. Responsive media queries for live storefront (when viewport is not forced)
  if (!opts?.forceViewport) {
    const tabletVars = buildMediaOverrideVars(orderedPresets, "tablet");
    if (tabletVars.length) {
      chunks.push(
        `@media (max-width: 1024px) {\n  ${scopeSelector} {\n${tabletVars
          .map((l) => `  ${l}`)
          .join("\n")}\n  }\n}`
      );
    }
    const mobileVars = buildMediaOverrideVars(orderedPresets, "mobile");
    if (mobileVars.length) {
      chunks.push(
        `@media (max-width: 767px) {\n  ${scopeSelector} {\n${mobileVars
          .map((l) => `  ${l}`)
          .join("\n")}\n  }\n}`
      );
    }
  }

  // 4. Reusable preset selector rules (low specificity :where() so element overrides win cleanly)
  for (const preset of orderedPresets) {
    chunks.push(buildPresetClassRule(scopeSelector, preset));
  }

  return chunks.join("\n\n");
}
