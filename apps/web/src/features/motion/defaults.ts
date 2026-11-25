import type { GlobalMotionSettings, NormalizedGlobalMotion } from "./types";

export const DEFAULT_GLOBAL_MOTION: NormalizedGlobalMotion = {
  schemaVersion: 1,
  enabled: true,
  scrollEffectsEnabled: true,
  hoverEffectsEnabled: true,
  mobileBehavior: "reduced",
  reducedMotionPolicy: "respect-system",
  defaultDuration: 300,
  defaultEasing: "easeOut",
  defaultHoverDuration: 220,
  defaultEntrancePreset: "fadeInUp",
  timingTokens: {
    fast: 150,
    normal: 300,
    slow: 600,
  },
  easingTokens: {
    linear: "cubic-bezier(0, 0, 1, 1)",
    ease: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    easeIn: "cubic-bezier(0.42, 0, 1, 1)",
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    custom: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
};

export function normalizeGlobalMotion(
  raw?: GlobalMotionSettings | NormalizedGlobalMotion | null
): NormalizedGlobalMotion {
  if (!raw) {
    return {
      ...DEFAULT_GLOBAL_MOTION,
      timingTokens: { ...DEFAULT_GLOBAL_MOTION.timingTokens },
      easingTokens: { ...DEFAULT_GLOBAL_MOTION.easingTokens },
    };
  }
  return {
    schemaVersion: raw.schemaVersion || 1,
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
    scrollEffectsEnabled:
      raw.scrollEffectsEnabled !== undefined ? Boolean(raw.scrollEffectsEnabled) : true,
    hoverEffectsEnabled:
      raw.hoverEffectsEnabled !== undefined ? Boolean(raw.hoverEffectsEnabled) : true,
    mobileBehavior:
      raw.mobileBehavior === "full" ||
      raw.mobileBehavior === "reduced" ||
      raw.mobileBehavior === "disabled"
        ? raw.mobileBehavior
        : "reduced",
    reducedMotionPolicy:
      raw.reducedMotionPolicy === "respect-system" ||
      raw.reducedMotionPolicy === "always-reduced" ||
      raw.reducedMotionPolicy === "essential-only"
        ? raw.reducedMotionPolicy
        : "respect-system",
    defaultDuration:
      typeof raw.defaultDuration === "number" && Number.isFinite(raw.defaultDuration)
        ? Math.max(50, Math.min(3000, Math.round(raw.defaultDuration)))
        : 300,
    defaultEasing: raw.defaultEasing || "easeOut",
    defaultHoverDuration:
      typeof raw.defaultHoverDuration === "number" &&
      Number.isFinite(raw.defaultHoverDuration)
        ? Math.max(50, Math.min(2000, Math.round(raw.defaultHoverDuration)))
        : 220,
    defaultEntrancePreset: raw.defaultEntrancePreset || "fadeInUp",
    timingTokens: {
      fast: raw.timingTokens?.fast ?? DEFAULT_GLOBAL_MOTION.timingTokens.fast,
      normal: raw.timingTokens?.normal ?? DEFAULT_GLOBAL_MOTION.timingTokens.normal,
      slow: raw.timingTokens?.slow ?? DEFAULT_GLOBAL_MOTION.timingTokens.slow,
    },
    easingTokens: {
      linear: raw.easingTokens?.linear || DEFAULT_GLOBAL_MOTION.easingTokens.linear,
      ease: raw.easingTokens?.ease || DEFAULT_GLOBAL_MOTION.easingTokens.ease,
      easeIn: raw.easingTokens?.easeIn || DEFAULT_GLOBAL_MOTION.easingTokens.easeIn,
      easeOut: raw.easingTokens?.easeOut || DEFAULT_GLOBAL_MOTION.easingTokens.easeOut,
      easeInOut:
        raw.easingTokens?.easeInOut || DEFAULT_GLOBAL_MOTION.easingTokens.easeInOut,
      custom: raw.easingTokens?.custom || DEFAULT_GLOBAL_MOTION.easingTokens.custom,
    },
  };
}

export function resolveEasingCss(
  easing: string | undefined,
  globalMotion: NormalizedGlobalMotion
): string {
  const token = (easing || globalMotion.defaultEasing || "easeOut").trim();
  switch (token) {
    case "linear":
      return globalMotion.easingTokens.linear;
    case "ease":
      return globalMotion.easingTokens.ease;
    case "easeIn":
      return globalMotion.easingTokens.easeIn;
    case "easeOut":
      return globalMotion.easingTokens.easeOut;
    case "easeInOut":
      return globalMotion.easingTokens.easeInOut;
    case "spring":
      return "cubic-bezier(0.34, 1.56, 0.64, 1)";
    case "custom":
      return globalMotion.easingTokens.custom;
    default:
      return token.startsWith("cubic-bezier(") ? token : globalMotion.easingTokens.easeOut;
  }
}
