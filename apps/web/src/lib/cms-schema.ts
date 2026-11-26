import type { CSSProperties } from "react";
import { BUILTIN_FONT_NAMES } from "@/features/typography/font-catalog";
import { normalizeGlobalMotion } from "@/features/motion/defaults";
import { globalMotionSchema } from "@/features/motion/schema";
import { normalizeGlobalTypography } from "@/features/typography/defaults";
import { formatCssFontStack } from "@/features/typography/resolve";
import { globalTypographySchema } from "@/features/typography/schema";
import { z } from "zod";
import type {
  ApiPageBlock,
  BlockTypeSlug,
  PageContentPayload,
  ThemeTokens,
} from "@/types/api-cms-ai";
import type {
  Block,
  BlockItem,
  BlockKind,
  BlockLayout,
  BlockScale,
  BlockSpacing,
  BlockTone,
} from "@/types/editor";

const DANGEROUS_PATTERN =
  /(<\s*(script|iframe|object|embed|style)\b|\bon[a-z]{2,}\s*=|(javascript|vbscript):|data\s*:\s*text\/html)/i;
const PALETTE_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const ALLOWED_TONES = new Set(["forest", "ink", "light"]);
const ALLOWED_LAYOUTS = new Set(["overlay", "split", "centered"]);
const ALLOWED_SPACINGS = new Set(["compact", "comfortable", "spacious"]);

const EMPTY_CSS_VARS: CSSProperties = {};
const themeCssVarsCache = new WeakMap<ThemeTokens, CSSProperties>();

const KIND_TO_SLUG: Record<BlockKind, BlockTypeSlug> = {
  Hero: "hero",
  "Image with Text": "image_with_text",
  "Product Grid": "product_grid",
  "Featured Categories": "featured_categories",
  "Best Sellers": "best_sellers",
  "Collection Banner": "collection_banner",
  "Promotional Banner": "promotional_banner",
  Testimonials: "testimonials",
  Newsletter: "newsletter",
  "Rich Text": "rich_text",
  "Image Gallery": "image_gallery",
  FAQ: "faq",
  "Logo Cloud": "logo_cloud",
  "Video Section": "video_section",
};

const SLUG_TO_KIND: Record<string, BlockKind> = Object.fromEntries(
  Object.entries(KIND_TO_SLUG).map(([k, v]) => [v, k as BlockKind])
);

export const ALLOWED_FONTS = BUILTIN_FONT_NAMES;

export const safeUrlSchema = z
  .string()
  .refine(
    (val) =>
      val === "" ||
      (!val.startsWith("//") && (val.startsWith("/") || val.startsWith("https://"))),
    "Must be a relative / path or https:// URL"
  )
  .refine((val) => !DANGEROUS_PATTERN.test(val), "Unsafe URL rejected");

export const apiBlockSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum([
    "hero",
    "image_with_text",
    "product_grid",
    "featured_categories",
    "best_sellers",
    "collection_banner",
    "promotional_banner",
    "testimonials",
    "newsletter",
    "rich_text",
    "image_gallery",
    "faq",
    "logo_cloud",
    "video_section",
  ]),
  version: z.literal(1).default(1),
  label: z.string().min(1).max(80),
  visible: z.boolean().default(true),
  props: z
    .record(z.unknown())
    .refine(
      (props) => !DANGEROUS_PATTERN.test(JSON.stringify(props)),
      "Unsafe HTML/script content rejected"
    ),
});

export const brandPaletteColorSchema = z.object({
  id: z.string().regex(PALETTE_ID_RE),
  name: z.string().trim().min(1).max(32),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const themeTokensSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]).default(1),
  colors: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    surface: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    text: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    muted: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    border: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }),
  customPalette: z.array(brandPaletteColorSchema).max(24).optional(),
  typography: globalTypographySchema,
  radius: z.object({
    card: z.string().regex(/^(?:[0-9]|1[0-9]|2[0-4])px$/),
    button: z.string().regex(/^\d{1,3}px$/),
  }),
  container: z.object({
    maxWidth: z.string().regex(/^(102[4-9]|10[3-9]\d|1[1-4]\d\d|15[0-2]\d|153[0-6])px$/),
  }),
  spacing: z
    .object({
      sectionY: z.string().optional(),
      blockGap: z.string().optional(),
    })
    .optional(),
  shadows: z
    .object({
      card: z.string().optional(),
      elevated: z.string().optional(),
    })
    .optional(),
  motion: globalMotionSchema.optional(),
});

export function apiBlocksToEditorBlocks(content?: PageContentPayload | null): Block[] {
  const list = content?.blocks || [];
  const result: Block[] = [];
  for (const b of list) {
    const kind = SLUG_TO_KIND[b.type];
    if (!kind) continue;
    const props = b.props || {};
    const colsRaw = Number(props.columns);
    const columns: 2 | 3 | 4 = colsRaw === 2 || colsRaw === 3 ? colsRaw : 4;
    const rawTone = String(props.tone);
    const rawLayout = String(props.layout);
    const rawSpacing = String(props.spacing);
    result.push({
      id: b.id,
      type: kind,
      label: b.label,
      visible: b.visible !== false,
      kicker: props.kicker ? String(props.kicker) : "",
      heading: props.heading ? String(props.heading) : "",
      copy: props.copy ? String(props.copy) : "",
      action: props.action ? String(props.action) : "",
      actionUrl: props.actionUrl ? String(props.actionUrl) : "/store/shop",
      image: props.image ? String(props.image) : "/media/terrain-fallback.jpg",
      tone: (ALLOWED_TONES.has(rawTone) ? rawTone : "light") as BlockTone,
      layout: (ALLOWED_LAYOUTS.has(rawLayout) ? rawLayout : "overlay") as BlockLayout,
      scale: (String(props.scale) === "large" ? "large" : "regular") as BlockScale,
      spacing: (ALLOWED_SPACINGS.has(rawSpacing) ? rawSpacing : "comfortable") as BlockSpacing,
      columns,
      items: Array.isArray(props.items)
        ? (props.items as BlockItem[])
        : undefined,
    });
  }
  return result;
}

export function editorBlocksToApiBlocks(blocks: Block[]): { version: 1; blocks: ApiPageBlock[] } {
  const mapped: ApiPageBlock[] = blocks.map((b) => ({
    id: b.id,
    type: KIND_TO_SLUG[b.type] || "rich_text",
    version: 1,
    label: b.label.slice(0, 80),
    visible: b.visible,
    props: {
      kicker: b.kicker || "",
      heading: b.heading || "",
      copy: b.copy || "",
      action: b.action || "",
      actionUrl: b.actionUrl || "/store/shop",
      image: b.image || "/media/terrain-fallback.jpg",
      tone: b.tone || "light",
      layout: b.layout || "overlay",
      scale: b.scale || "regular",
      spacing: b.spacing || "comfortable",
      columns: b.columns || 4,
      ...(b.items ? { items: b.items } : {}),
    },
  }));
  return { version: 1, blocks: mapped };
}

export function themeTokensToCssVars(tokens?: ThemeTokens | null): CSSProperties {
  if (!tokens) return EMPTY_CSS_VARS;
  const cached = themeCssVarsCache.get(tokens);
  if (cached) return cached;

  const typography = normalizeGlobalTypography(tokens.typography);
  const motion = normalizeGlobalMotion(tokens.motion);
  const vars: Record<string, string> = {
    "--accent": tokens.colors.primary,
    "--accent-hover": `color-mix(in srgb, ${tokens.colors.primary} 84%, #000000)`,
    "--accent-soft": `color-mix(in srgb, ${tokens.colors.primary} 12%, #ffffff)`,
    "--accent-text": tokens.colors.primary,
    "--brand": tokens.colors.primary,
    "--bg": tokens.colors.background,
    "--surface": tokens.colors.surface || "#F8FAFC",
    "--text": tokens.colors.text,
    "--muted": tokens.colors.muted || "#5C6270",
    "--store-bg": tokens.colors.background,
    "--store-surface": tokens.colors.surface || "#F8FAFC",
    "--store-text": tokens.colors.text,
    "--store-muted": tokens.colors.muted || "#5C6270",
    "--store-secondary": tokens.colors.secondary || "#1F2937",
    "--store-accent": tokens.colors.accent || "#18794E",
    "--store-border": tokens.colors.border || "#E5E7EB",
    "--font-primary": formatCssFontStack(
      typography.fonts.primary.family,
      typography.fonts.primary.fallback
    ),
    "--font-secondary": formatCssFontStack(
      typography.fonts.secondary.family,
      typography.fonts.secondary.fallback
    ),
    "--font-heading": formatCssFontStack(
      typography.fonts.heading.family,
      typography.fonts.heading.fallback
    ),
    "--font-body": formatCssFontStack(
      typography.fonts.body.family,
      typography.fonts.body.fallback
    ),
    "--font-monospace": formatCssFontStack(
      typography.fonts.monospace.family,
      typography.fonts.monospace.fallback
    ),
    "--store-font-heading": tokens.typography?.headingFont || "Georgia",
    "--store-font-body": tokens.typography?.bodyFont || "Inter",
    "--store-radius-card": tokens.radius?.card || "10px",
    "--store-radius-button": tokens.radius?.button || "8px",
    "--motion-fast": `${motion.timingTokens.fast}ms`,
    "--motion-normal": `${motion.timingTokens.normal}ms`,
    "--motion-slow": `${motion.timingTokens.slow}ms`,
    "--motion-duration": `${motion.defaultDuration}ms`,
    "--motion-hover-duration": `${motion.defaultHoverDuration}ms`,
    "--motion-ease-linear": motion.easingTokens.linear,
    "--motion-ease": motion.easingTokens.ease,
    "--motion-ease-in": motion.easingTokens.easeIn,
    "--motion-ease-out": motion.easingTokens.easeOut,
    "--motion-ease-in-out": motion.easingTokens.easeInOut,
    "--motion-ease-custom": motion.easingTokens.custom,
    "--store-max-width": tokens.container?.maxWidth || "1280px",
    "--store-section-y": tokens.spacing?.sectionY || "64px",
    "--store-block-gap": tokens.spacing?.blockGap || "24px",
    "--store-shadow-card": tokens.shadows?.card || "0 1px 3px rgba(15, 23, 42, 0.08)",
    "--store-shadow-elevated": tokens.shadows?.elevated || "0 12px 32px rgba(15, 23, 42, 0.14)",
  };

  if (tokens.customPalette) {
    for (const item of tokens.customPalette) {
      if (PALETTE_ID_RE.test(item.id)) {
        vars[`--store-palette-${item.id}`] = item.hex;
      }
    }
  }

  const result = vars as CSSProperties;
  themeCssVarsCache.set(tokens, result);
  return result;
}
