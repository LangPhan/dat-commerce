import type { CSSProperties } from "react";
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

export const ALLOWED_FONTS = [
  "Inter",
  "Georgia",
  "Plus Jakarta Sans",
  "DM Sans",
  "Merriweather",
  "JetBrains Mono",
] as const;

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
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
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
  typography: z.object({
    headingFont: z.enum(ALLOWED_FONTS),
    bodyFont: z.enum(ALLOWED_FONTS),
  }),
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
});

export function apiBlocksToEditorBlocks(content?: PageContentPayload | null): Block[] {
  const list = content?.blocks || [];
  return list
    .filter((b) => SLUG_TO_KIND[b.type])
    .map((b) => {
      const props = b.props || {};
      const colsRaw = Number(props.columns);
      const columns: 2 | 3 | 4 = colsRaw === 2 || colsRaw === 3 ? colsRaw : 4;
      return {
        id: b.id,
        type: SLUG_TO_KIND[b.type],
        label: b.label,
        visible: b.visible !== false,
        kicker: props.kicker ? String(props.kicker) : "",
        heading: props.heading ? String(props.heading) : "",
        copy: props.copy ? String(props.copy) : "",
        action: props.action ? String(props.action) : "",
        actionUrl: props.actionUrl ? String(props.actionUrl) : "/store/shop",
        image: props.image ? String(props.image) : "/media/terrain-fallback.jpg",
        tone: (["forest", "ink", "light"].includes(String(props.tone))
          ? String(props.tone)
          : "light") as BlockTone,
        layout: (["overlay", "split", "centered"].includes(String(props.layout))
          ? String(props.layout)
          : "overlay") as BlockLayout,
        scale: (String(props.scale) === "large" ? "large" : "regular") as BlockScale,
        spacing: (["compact", "comfortable", "spacious"].includes(
          String(props.spacing)
        )
          ? String(props.spacing)
          : "comfortable") as BlockSpacing,
        columns,
        items: Array.isArray(props.items)
          ? (props.items as BlockItem[])
          : undefined,
      };
    });
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
  if (!tokens) return {};
  return {
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
    "--store-font-heading": tokens.typography?.headingFont || "Georgia",
    "--store-font-body": tokens.typography?.bodyFont || "Inter",
    "--store-radius-card": tokens.radius?.card || "10px",
    "--store-radius-button": tokens.radius?.button || "8px",
    "--store-max-width": tokens.container?.maxWidth || "1280px",
    "--store-section-y": tokens.spacing?.sectionY || "64px",
    "--store-block-gap": tokens.spacing?.blockGap || "24px",
    "--store-shadow-card": tokens.shadows?.card || "0 1px 3px rgba(15, 23, 42, 0.08)",
    "--store-shadow-elevated": tokens.shadows?.elevated || "0 12px 32px rgba(15, 23, 42, 0.14)",
    ...Object.fromEntries(
      (tokens.customPalette || [])
        .filter((item) => /^[A-Za-z0-9_-]{1,40}$/.test(item.id))
        .map((item) => [`--store-palette-${item.id}`, item.hex])
    ),
  } as CSSProperties;
}
