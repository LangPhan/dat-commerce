import { z } from "zod";
import type {
  EffectLayerType,
  ExperienceLayer,
  ExperienceMotionConfig,
  ExperienceZone,
  SeasonalExperienceConfig,
  ThemeOverrideConfig,
} from "./types";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const DANGEROUS_RE =
  /(<\s*(script|iframe|object|embed|style|link|meta|base)\b|\bon[a-z]{2,}\s*=|(javascript|vbscript):|data\s*:\s*text\/html)/i;

export const experienceZoneSchema = z.enum([
  "viewport_overlay",
  "top_announcement",
  "header_frame",
  "hero_stage",
  "floating_corner",
  "footer_stage",
]);

export const effectLayerTypeSchema = z.enum([
  "snowfall",
  "blossom_petals",
  "floating_hearts",
  "golden_particles",
  "fireworks",
  "confetti_burst",
  "santa_sleigh",
  "string_lights",
  "festive_lanterns",
  "corner_floral_frame",
  "promo_banner",
  "countdown_bar",
  "ambient_glow",
  "floating_sticker",
]);

export const themeOverrideSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["accent_tint", "full_palette", "dark_luxe"]).default("accent_tint"),
  colors: z
    .object({
      primary: z.string().regex(HEX_RE).optional(),
      secondary: z.string().regex(HEX_RE).optional(),
      accent: z.string().regex(HEX_RE).optional(),
      background: z.string().regex(HEX_RE).optional(),
      surface: z.string().regex(HEX_RE).optional(),
      text: z.string().regex(HEX_RE).optional(),
      muted: z.string().regex(HEX_RE).optional(),
      border: z.string().regex(HEX_RE).optional(),
    })
    .optional(),
  surfaceTint: z.string().regex(HEX_RE).optional(),
  backdrop: z
    .object({
      kind: z.enum(["none", "radial_glow", "top_aurora", "vignette"]).default("none"),
      primaryColor: z.string().regex(HEX_RE).optional(),
      secondaryColor: z.string().regex(HEX_RE).optional(),
      opacity: z.number().min(0).max(0.85).optional(),
    })
    .optional(),
  headerOverride: z
    .object({
      bgColor: z.string().regex(HEX_RE).optional(),
      textColor: z.string().regex(HEX_RE).optional(),
      borderColor: z.string().regex(HEX_RE).optional(),
      announcementBg: z.string().regex(HEX_RE).optional(),
      announcementTextColor: z.string().regex(HEX_RE).optional(),
      announcementText: z.string().max(180).optional(),
    })
    .optional(),
  ctaHighlight: z
    .object({
      enabled: z.boolean().default(false),
      badgeText: z.string().max(24).optional(),
      glowColor: z.string().regex(HEX_RE).optional(),
      shimmer: z.boolean().optional(),
    })
    .optional(),
});

export const experienceLayerSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  type: effectLayerTypeSchema,
  label: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  locked: z.boolean().default(false),
  zone: experienceZoneSchema.default("viewport_overlay"),
  zIndex: z.number().int().min(1).max(60).default(24),
  opacity: z.number().min(0.05).max(1).default(0.92),
  blendMode: z.enum(["normal", "screen", "lighter"]).default("normal"),
  visibility: z
    .object({
      desktop: z.boolean().default(true),
      tablet: z.boolean().default(true),
      mobile: z.boolean().default(true),
    })
    .default({ desktop: true, tablet: true, mobile: true }),
  trigger: z.enum(["immediate", "on_scroll", "timed_burst"]).default("immediate"),
  props: z
    .record(z.unknown())
    .refine((p) => !DANGEROUS_RE.test(JSON.stringify(p)), "Unsafe script/HTML rejected"),
});

export const seasonalExperienceConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  themeOverride: themeOverrideSchema.default({ enabled: false, mode: "accent_tint" }),
  motion: z
    .object({
      respectReducedMotion: z.boolean().default(true),
      mobileDensityRatio: z.number().min(0).max(1).default(0.5),
      pauseOnHiddenTab: z.boolean().default(true),
    })
    .default({
      respectReducedMotion: true,
      mobileDensityRatio: 0.5,
      pauseOnHiddenTab: true,
    }),
  layers: z.array(experienceLayerSchema).max(20).default([]),
});

export function createEmptyExperienceConfig(): SeasonalExperienceConfig {
  return {
    schemaVersion: 1,
    themeOverride: {
      enabled: false,
      mode: "accent_tint",
      colors: {},
      backdrop: { kind: "none", opacity: 0.25 },
      ctaHighlight: { enabled: false, badgeText: "", shimmer: false },
    },
    motion: {
      respectReducedMotion: true,
      mobileDensityRatio: 0.5,
      pauseOnHiddenTab: true,
    },
    layers: [],
  };
}

export function normalizeExperienceConfig(
  raw?: Partial<SeasonalExperienceConfig> | null
): SeasonalExperienceConfig {
  const base = createEmptyExperienceConfig();
  if (!raw) return base;
  const theme: ThemeOverrideConfig = {
    enabled: Boolean(raw.themeOverride?.enabled),
    mode: raw.themeOverride?.mode || "accent_tint",
    colors: raw.themeOverride?.colors ? { ...raw.themeOverride.colors } : {},
    surfaceTint: raw.themeOverride?.surfaceTint,
    backdrop: raw.themeOverride?.backdrop
      ? { ...raw.themeOverride.backdrop }
      : { kind: "none", opacity: 0.25 },
    headerOverride: raw.themeOverride?.headerOverride
      ? { ...raw.themeOverride.headerOverride }
      : {},
    ctaHighlight: raw.themeOverride?.ctaHighlight
      ? { ...raw.themeOverride.ctaHighlight }
      : { enabled: false, badgeText: "", shimmer: false },
  };
  const motion: ExperienceMotionConfig = {
    respectReducedMotion: raw.motion?.respectReducedMotion ?? true,
    mobileDensityRatio:
      typeof raw.motion?.mobileDensityRatio === "number" ? raw.motion.mobileDensityRatio : 0.5,
    pauseOnHiddenTab: raw.motion?.pauseOnHiddenTab ?? true,
  };
  const layers: ExperienceLayer[] = Array.isArray(raw.layers)
    ? raw.layers.map((l, idx) => ({
        id: l.id || `layer-${idx + 1}`,
        type: l.type,
        label: l.label || l.type,
        enabled: l.enabled !== false,
        locked: Boolean(l.locked),
        zone: l.zone || defaultZoneForLayerType(l.type),
        zIndex: typeof l.zIndex === "number" ? l.zIndex : 22 + idx,
        opacity: typeof l.opacity === "number" ? l.opacity : 0.92,
        blendMode: l.blendMode || "normal",
        visibility: {
          desktop: l.visibility?.desktop !== false,
          tablet: l.visibility?.tablet !== false,
          mobile: l.visibility?.mobile !== false,
        },
        trigger: l.trigger || "immediate",
        props: l.props ? { ...l.props } : {},
      }))
    : [];
  return {
    schemaVersion: 1,
    themeOverride: theme,
    motion,
    layers,
  };
}

export function defaultZoneForLayerType(type: EffectLayerType): ExperienceZone {
  switch (type) {
    case "promo_banner":
    case "countdown_bar":
      return "top_announcement";
    case "string_lights":
    case "festive_lanterns":
      return "header_frame";
    case "santa_sleigh":
      return "hero_stage";
    case "floating_sticker":
      return "floating_corner";
    default:
      return "viewport_overlay";
  }
}

export function isParticleLayerType(type: EffectLayerType): boolean {
  return (
    type === "snowfall" ||
    type === "blossom_petals" ||
    type === "floating_hearts" ||
    type === "golden_particles" ||
    type === "confetti_burst"
  );
}
