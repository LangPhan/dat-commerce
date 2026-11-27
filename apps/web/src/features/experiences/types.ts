export type ExperienceCategory =
  | "SEASON"
  | "HOLIDAY"
  | "CULTURAL"
  | "OCCASION"
  | "CAMPAIGN"
  | "FLASH_SALE"
  | "CUSTOM";

export type ExperienceStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "ENDED"
  | "ARCHIVED";

export type ActivationMode = "MANUAL" | "SCHEDULED";
export type RecurrenceRule = "NONE" | "YEARLY" | "MONTHLY";
export type ExperienceBlendMode = "EXCLUSIVE" | "OVERRIDE" | "STACK" | "THEME_ONLY";

export type ExclusiveGroup =
  | "weather_particles"
  | "theme_palette"
  | "top_banner"
  | "header_decor"
  | "corner_decor"
  | "promo_highlight"
  | "ambient_backdrop"
  | "floating_widget";

export type ExperienceZone =
  | "viewport_overlay"
  | "top_announcement"
  | "header_frame"
  | "hero_stage"
  | "floating_corner"
  | "footer_stage";

export type EffectLayerType =
  | "snowfall"
  | "blossom_petals"
  | "floating_hearts"
  | "golden_particles"
  | "fireworks"
  | "confetti_burst"
  | "santa_sleigh"
  | "string_lights"
  | "festive_lanterns"
  | "corner_floral_frame"
  | "promo_banner"
  | "countdown_bar"
  | "ambient_glow"
  | "floating_sticker";

export type LayerBlendMode = "normal" | "screen" | "lighter";
export type LayerTrigger = "immediate" | "on_scroll" | "timed_burst";

export type LayerVisibility = {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
};

export type ExperienceLayer = {
  id: string;
  type: EffectLayerType;
  label: string;
  enabled: boolean;
  locked: boolean;
  zone: ExperienceZone;
  zIndex: number;
  opacity: number;
  blendMode: LayerBlendMode;
  visibility: LayerVisibility;
  trigger: LayerTrigger;
  props: Record<string, unknown>;
};

export type ThemeOverrideConfig = {
  enabled: boolean;
  mode: "accent_tint" | "full_palette" | "dark_luxe";
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    muted?: string;
    border?: string;
  };
  surfaceTint?: string;
  backdrop?: {
    kind: "none" | "radial_glow" | "top_aurora" | "vignette";
    primaryColor?: string;
    secondaryColor?: string;
    opacity?: number;
  };
  headerOverride?: {
    bgColor?: string;
    textColor?: string;
    borderColor?: string;
    announcementBg?: string;
    announcementTextColor?: string;
    announcementText?: string;
  };
  ctaHighlight?: {
    enabled: boolean;
    badgeText?: string;
    glowColor?: string;
    shimmer?: boolean;
  };
};

export type ExperienceMotionConfig = {
  respectReducedMotion: boolean;
  mobileDensityRatio: number;
  pauseOnHiddenTab: boolean;
};

export type SeasonalExperienceConfig = {
  schemaVersion: 1;
  themeOverride: ThemeOverrideConfig;
  motion: ExperienceMotionConfig;
  layers: ExperienceLayer[];
};

export type ExperienceTemplateDto = {
  presetKey: string;
  name: string;
  category: ExperienceCategory;
  description: string;
  accentColor: string;
  previewGradient: string;
  tags: string[];
  defaultPriority: number;
  defaultBlendMode: ExperienceBlendMode;
  defaultExclusiveGroups: ExclusiveGroup[];
  config: SeasonalExperienceConfig;
};

export type ExperienceVersionDto = {
  id: string;
  versionNumber: number;
  config: SeasonalExperienceConfig;
  changeSummary?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

export type ExperienceSummaryDto = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category: ExperienceCategory | string;
  presetKey?: string | null;
  status: ExperienceStatus | string;
  activationMode: ActivationMode | string;
  manualOverride: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone: string;
  recurrenceRule: RecurrenceRule | string;
  priority: number;
  blendMode: ExperienceBlendMode | string;
  exclusiveGroups: string[];
  targetPages: string[];
  maxParticleBudget: number;
  activeVersionId?: string | null;
  latestVersionNumber: number;
  layerCount: number;
  version: number;
  updatedAt: string;
};

export type ExperienceDetailDto = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category: ExperienceCategory | string;
  presetKey?: string | null;
  status: ExperienceStatus | string;
  activationMode: ActivationMode | string;
  manualOverride: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone: string;
  recurrenceRule: RecurrenceRule | string;
  priority: number;
  blendMode: ExperienceBlendMode | string;
  exclusiveGroups: string[];
  targetPages: string[];
  maxParticleBudget: number;
  activeVersionId?: string | null;
  latestVersionNumber: number;
  version: number;
  latestVersion?: ExperienceVersionDto | null;
  activeVersion?: ExperienceVersionDto | null;
  versions: ExperienceVersionDto[];
  updatedAt: string;
};

export type ConflictStrategy =
  | "SINGLE_HIGHEST_PRIORITY"
  | "PRIORITY_STACK"
  | "MANUAL_WINS_OVER_SCHEDULED";

export type MobilePerformanceMode = "FULL" | "ADAPTIVE" | "MINIMAL" | "OFF";
export type FallbackBehavior =
  | "REVERT_DEFAULT_THEME"
  | "ACTIVATE_NEXT_SCHEDULED"
  | "KEEP_SEASONAL_BASE";

export type ExperienceSettingsDto = {
  storeId: string;
  enabled: boolean;
  conflictStrategy: ConflictStrategy | string;
  maxConcurrentExperiences: number;
  globalParticleCap: number;
  mobilePerformanceMode: MobilePerformanceMode | string;
  respectReducedMotion: boolean;
  fallbackBehavior: FallbackBehavior | string;
  defaultExperienceId?: string | null;
  allowCustomerDismiss: boolean;
  updatedAt: string;
};

export type ActiveExperienceSummaryDto = {
  id: string;
  slug: string;
  name: string;
  category: string;
  priority: number;
  blendMode: string;
  startsAt?: string | null;
  endsAt?: string | null;
  targetPages: string[];
};

export type ResolvedExperienceLayerDto = {
  sourceExperienceId: string;
  sourceExperienceName: string;
  id: string;
  type: EffectLayerType;
  label: string;
  zone: ExperienceZone;
  zIndex: number;
  opacity: number;
  blendMode: LayerBlendMode;
  visibility: LayerVisibility;
  trigger: LayerTrigger;
  effectiveDensityScale: number;
  experienceEndsAt?: string | null;
  targetPages: string[];
  props: Record<string, unknown>;
};

export type ResolvedStorefrontExperienceDto = {
  enabled: boolean;
  resolvedAt: string;
  nextTransitionAt?: string | null;
  mobilePerformanceMode: MobilePerformanceMode | string;
  respectReducedMotion: boolean;
  allowCustomerDismiss: boolean;
  globalParticleCap: number;
  activeExperiences: ActiveExperienceSummaryDto[];
  effectiveThemeOverride?: ThemeOverrideConfig | null;
  layers: ResolvedExperienceLayerDto[];
  resolutionTrace: string[];
};

export type ExperienceAiOperationDto = {
  type: string;
  targetId: string;
  description: string;
};

export type ExperienceAiDesignResponse = {
  model: string;
  summary: string;
  explanation: string;
  operations: ExperienceAiOperationDto[];
  proposedConfig: SeasonalExperienceConfig;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export type ExperienceAiChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  summary?: string;
  operations?: ExperienceAiOperationDto[];
  model?: string;
  latencyMs?: number;
};
