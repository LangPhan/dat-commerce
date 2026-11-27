import type {
  EffectLayerType,
  ExclusiveGroup,
  ExperienceBlendMode,
  ExperienceLayer,
  ExperienceZone,
  LayerBlendMode,
} from "./types";

export type EffectPaletteCategory =
  | "weather"
  | "scenes"
  | "banners"
  | "decorations"
  | "atmosphere";

export type EffectCatalogItem = {
  type: EffectLayerType;
  name: string;
  category: EffectPaletteCategory;
  description: string;
  defaultZone: ExperienceZone;
  allowedZones: ExperienceZone[];
  defaultZIndex: number;
  defaultOpacity: number;
  defaultBlendMode: LayerBlendMode;
  accentColor: string;
  defaultProps: Record<string, unknown>;
};

export const EFFECT_CATALOG: EffectCatalogItem[] = [
  {
    type: "snowfall",
    name: "Falling Snow",
    category: "weather",
    description: "Soft bokeh and crystal snowflakes drifting with wind sway.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 26,
    defaultOpacity: 0.9,
    defaultBlendMode: "normal",
    accentColor: "#38BDF8",
    defaultProps: {
      density: 75,
      speed: 1.0,
      wind: 0.35,
      sizeMin: 2.0,
      sizeMax: 7.5,
      color: "#FFFFFF",
      variant: "mixed",
    },
  },
  {
    type: "blossom_petals",
    name: "Blossom Petals",
    category: "weather",
    description: "3D tumbling cherry, apricot, peach blossoms, or autumn leaves.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 27,
    defaultOpacity: 0.92,
    defaultBlendMode: "normal",
    accentColor: "#F472B6",
    defaultProps: {
      species: "cherry_blossom",
      density: 45,
      speed: 0.85,
      swayAmplitude: 1.25,
      tumble3d: true,
      colors: ["#FBCFE8", "#F9A8D4", "#FDF2F8"],
    },
  },
  {
    type: "floating_hearts",
    name: "Floating Hearts",
    category: "weather",
    description: "Romantic glass-glow hearts rising gently across the storefront.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 27,
    defaultOpacity: 0.9,
    defaultBlendMode: "normal",
    accentColor: "#FB7185",
    defaultProps: {
      density: 32,
      speed: 0.85,
      direction: "rise",
      glow: true,
      colors: ["#FB7185", "#F43F5E", "#FDA4AF"],
    },
  },
  {
    type: "golden_particles",
    name: "Golden Particles",
    category: "weather",
    description: "Twinkling champagne gold stars and luminous luxury embers.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 25,
    defaultOpacity: 0.9,
    defaultBlendMode: "screen",
    accentColor: "#EAB308",
    defaultProps: {
      density: 65,
      speed: 0.7,
      shape: "sparkle_star",
      twinkle: true,
      colors: ["#FACC15", "#FDE047", "#D97706"],
    },
  },
  {
    type: "fireworks",
    name: "Fireworks Show",
    category: "weather",
    description: "Launching rockets & sparkling radial bursts for New Year or launches.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 29,
    defaultOpacity: 0.94,
    defaultBlendMode: "screen",
    accentColor: "#EF4444",
    defaultProps: {
      burstRate: 0.85,
      particleCount: 56,
      gravity: 0.45,
      launchZone: "top_sky",
      trails: true,
      colors: ["#EF4444", "#FACC15", "#FB923C", "#F472B6"],
    },
  },
  {
    type: "confetti_burst",
    name: "Confetti Sparks",
    category: "weather",
    description: "Tumbling celebratory ribbons, stars, and colorful sparks.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 28,
    defaultOpacity: 0.82,
    defaultBlendMode: "normal",
    accentColor: "#F97316",
    defaultProps: {
      density: 50,
      speed: 1.0,
      shapes: ["ribbon", "circle", "star"],
      colors: ["#F43F5E", "#FACC15", "#3B82F6", "#10B981"],
    },
  },
  {
    type: "santa_sleigh",
    name: "Santa & Reindeer Sleigh",
    category: "scenes",
    description: "Animated Santa Claus and reindeer team gliding across the sky.",
    defaultZone: "hero_stage",
    allowedZones: ["hero_stage", "viewport_overlay", "header_frame"],
    defaultZIndex: 38,
    defaultOpacity: 0.98,
    defaultBlendMode: "normal",
    accentColor: "#DC2626",
    defaultProps: {
      flightIntervalSeconds: 14,
      flightDurationSeconds: 9,
      altitudePct: 12,
      direction: "ltr",
      scale: 1.0,
      trailSparkles: true,
      sleighColor: "#B91C1C",
      glowColor: "#FDE047",
    },
  },
  {
    type: "string_lights",
    name: "Holiday String Lights",
    category: "decorations",
    description: "Twinkling draped bulbs along the top storefront header.",
    defaultZone: "header_frame",
    allowedZones: ["header_frame", "top_announcement", "footer_stage"],
    defaultZIndex: 42,
    defaultOpacity: 0.98,
    defaultBlendMode: "normal",
    accentColor: "#22C55E",
    defaultProps: {
      style: "christmas_bulbs",
      bulbCount: 22,
      twinkleSpeed: 1.1,
      glowIntensity: 0.8,
      wireColor: "#1E293B",
      colors: ["#EF4444", "#22C55E", "#FACC15", "#3B82F6"],
    },
  },
  {
    type: "festive_lanterns",
    name: "Festive Silk Lanterns",
    category: "decorations",
    description: "Swaying red & gold Lunar New Year lanterns with auspicious emblems.",
    defaultZone: "header_frame",
    allowedZones: ["header_frame", "hero_stage", "footer_stage"],
    defaultZIndex: 42,
    defaultOpacity: 0.98,
    defaultBlendMode: "normal",
    accentColor: "#DC2626",
    defaultProps: {
      style: "lunar_silk",
      count: 6,
      swayIntensity: 1.0,
      primaryColor: "#DC2626",
      trimColor: "#FACC15",
      emblemText: "福",
    },
  },
  {
    type: "corner_floral_frame",
    name: "Corner Frame Motif",
    category: "decorations",
    description: "Ornamental peach/cherry branches, pine holly, or Art-Deco gold corners.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 34,
    defaultOpacity: 0.95,
    defaultBlendMode: "normal",
    accentColor: "#EC4899",
    defaultProps: {
      motif: "peach_branch",
      corners: ["top-left", "top-right"],
      scale: 1.0,
      sway: true,
      primaryColor: "#F472B6",
      accentColor: "#FACC15",
    },
  },
  {
    type: "promo_banner",
    name: "Animated Promo Banner",
    category: "banners",
    description: "Shimmering event announcement bar with copyable promo code & CTA.",
    defaultZone: "top_announcement",
    allowedZones: ["top_announcement", "hero_stage", "footer_stage"],
    defaultZIndex: 45,
    defaultOpacity: 1.0,
    defaultBlendMode: "normal",
    accentColor: "#8B5CF6",
    defaultProps: {
      badgeText: "LIMITED EVENT",
      headline: "Seasonal Event Is Live — Unlock Special Savings",
      subtext: "Applied at checkout",
      promoCode: "WELCOME15",
      ctaLabel: "Shop Now",
      ctaUrl: "/store/shop",
      bgColor: "#18181B",
      textColor: "#FFFFFF",
      accentColor: "#FACC15",
      animationStyle: "shimmer",
      dismissible: true,
    },
  },
  {
    type: "countdown_bar",
    name: "Flash Countdown Timer",
    category: "banners",
    description: "Live ticking DD:HH:MM:SS countdown synced with event end time.",
    defaultZone: "top_announcement",
    allowedZones: ["top_announcement", "hero_stage", "floating_corner"],
    defaultZIndex: 48,
    defaultOpacity: 1.0,
    defaultBlendMode: "normal",
    accentColor: "#EA580C",
    defaultProps: {
      title: "Flash Sale Ends In",
      syncWithExperienceEnd: true,
      targetIso: "",
      variant: "full_bar",
      bgColor: "#991B1B",
      textColor: "#FFFFFF",
      digitBgColor: "#111827",
      urgentColor: "#FACC15",
      ctaLabel: "Grab Deal",
      ctaUrl: "/store/shop",
    },
  },
  {
    type: "ambient_glow",
    name: "Atmospheric Glow",
    category: "atmosphere",
    description: "Frost vignette, rose aura, aurora ribbon, or golden spotlight wash.",
    defaultZone: "viewport_overlay",
    allowedZones: ["viewport_overlay", "hero_stage"],
    defaultZIndex: 10,
    defaultOpacity: 0.5,
    defaultBlendMode: "screen",
    accentColor: "#6366F1",
    defaultProps: {
      style: "gold_spotlight",
      primaryColor: "#FACC15",
      secondaryColor: "#F43F5E",
      intensity: 0.35,
    },
  },
  {
    type: "floating_sticker",
    name: "Floating Event Sticker",
    category: "atmosphere",
    description: "Corner-pinned animated campaign badge or festive callout pill.",
    defaultZone: "floating_corner",
    allowedZones: ["floating_corner", "viewport_overlay"],
    defaultZIndex: 44,
    defaultOpacity: 1.0,
    defaultBlendMode: "normal",
    accentColor: "#DC2626",
    defaultProps: {
      text: "FLASH DROP",
      subtext: "Limited time",
      icon: "sparkles",
      anchor: "bottom-left",
      offsetX: 2,
      offsetY: 10,
      bgColor: "#DC2626",
      textColor: "#FFFFFF",
      motion: "float",
      linkUrl: "/store/shop",
    },
  },
];

export const EFFECT_BY_TYPE: Record<EffectLayerType, EffectCatalogItem> = Object.fromEntries(
  EFFECT_CATALOG.map((item) => [item.type, item])
) as Record<EffectLayerType, EffectCatalogItem>;

export const PALETTE_CATEGORIES: { key: EffectPaletteCategory | "all"; label: string }[] = [
  { key: "all", label: "All Effects" },
  { key: "weather", label: "Particles & Weather" },
  { key: "scenes", label: "Animated Scenes" },
  { key: "banners", label: "Banners & Timers" },
  { key: "decorations", label: "Frames & Lights" },
  { key: "atmosphere", label: "Glow & Stickers" },
];

export const ZONE_LABELS: Record<ExperienceZone, string> = {
  top_announcement: "Top Announcement Bar",
  header_frame: "Header Frame",
  hero_stage: "Hero Stage",
  viewport_overlay: "Full Viewport Overlay",
  floating_corner: "Floating Corner",
  footer_stage: "Footer Stage",
};

export const EXCLUSIVE_GROUP_OPTIONS: { value: ExclusiveGroup; label: string; hint: string }[] = [
  { value: "weather_particles", label: "Weather & Particles", hint: "Snow, petals, hearts, fireworks" },
  { value: "theme_palette", label: "Theme Palette", hint: "Colors & dark-mode surfaces" },
  { value: "top_banner", label: "Top Banner / Countdown", hint: "Announcement & timer bars" },
  { value: "header_decor", label: "Header Decor", hint: "String lights & hanging lanterns" },
  { value: "corner_decor", label: "Corner Frames", hint: "Botanical & Art-Deco corners" },
  { value: "promo_highlight", label: "CTA Highlights", hint: "Button shimmer & promo badges" },
  { value: "ambient_backdrop", label: "Ambient Backdrop", hint: "Vignettes & aurora glows" },
  { value: "floating_widget", label: "Floating Widgets", hint: "Sleigh & floating stickers" },
];

export const BLEND_MODE_OPTIONS: {
  value: ExperienceBlendMode;
  label: string;
  description: string;
}[] = [
  {
    value: "STACK",
    label: "Stack (Additive)",
    description: "Merge non-conflicting layers cleanly on top of lower-priority events.",
  },
  {
    value: "OVERRIDE",
    label: "Override Groups",
    description: "Claim matching conflict groups while allowing other groups to stack.",
  },
  {
    value: "EXCLUSIVE",
    label: "Exclusive Takeover",
    description: "Block all lower-priority events completely while active.",
  },
  {
    value: "THEME_ONLY",
    label: "Theme Only",
    description: "Apply only seasonal theme palette/header tokens without visual overlays.",
  },
];

export function createLayerFromCatalog(
  type: EffectLayerType,
  zoneOverride?: ExperienceZone
): ExperienceLayer {
  const def = EFFECT_BY_TYPE[type];
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return {
    id: `${type.replace(/_/g, "-")}-${uid}`,
    type,
    label: def.name,
    enabled: true,
    locked: false,
    zone: zoneOverride && def.allowedZones.includes(zoneOverride) ? zoneOverride : def.defaultZone,
    zIndex: def.defaultZIndex,
    opacity: def.defaultOpacity,
    blendMode: def.defaultBlendMode,
    visibility: { desktop: true, tablet: true, mobile: true },
    trigger: "immediate",
    props: structuredClone(def.defaultProps),
  };
}
