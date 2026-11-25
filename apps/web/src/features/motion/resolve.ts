import type { ViewportMode } from "@/features/builder/types";
import { normalizeGlobalMotion } from "./defaults";
import { findPresetByKey } from "./presets";
import type {
  AnimationPresetDefinition,
  ElementMotionConfig,
  GlobalMotionSettings,
  NormalizedGlobalMotion,
  ResolvedViewportMotion,
  ResponsiveMotionOverride,
} from "./types";

function mergeSub<T extends Record<string, unknown>>(
  base?: T,
  override?: T
): T | undefined {
  if (!base && !override) return undefined;
  return { ...(base || {}), ...(override || {}) } as T;
}

export function hasAnyActiveMotion(motion?: ElementMotionConfig | null): boolean {
  if (!motion) return false;
  if (motion.enabled === false) return false;
  return Boolean(
    motion.presetRef ||
      (motion.entrance?.enabled && motion.entrance.preset && motion.entrance.preset !== "none") ||
      (motion.scroll?.enabled && motion.scroll.effect && motion.scroll.effect !== "none") ||
      (motion.hover?.enabled && motion.hover.preset && motion.hover.preset !== "none") ||
      (motion.interaction?.enabled && motion.interaction.preset && motion.interaction.preset !== "none") ||
      (motion.continuous?.enabled && motion.continuous.preset && motion.continuous.preset !== "none") ||
      (motion.text?.enabled && motion.text.preset && motion.text.preset !== "none") ||
      motion.stagger?.enabled
  );
}

/**
 * Resolves effective motion for a viewport using:
 * 1. Global Preset reference base (if presetRef is set)
 * 2. Local Desktop base overrides (preserving local edits even if preset updates)
 * 3. Responsive cascading: Desktop -> Tablet -> Mobile
 * 4. Global Motion settings (master toggle, scroll/hover switches, mobileBehavior)
 */
export function resolveElementMotionForViewport(
  motion: ElementMotionConfig | null | undefined,
  viewport: ViewportMode,
  customPresets: AnimationPresetDefinition[] = [],
  rawGlobalMotion?: GlobalMotionSettings | NormalizedGlobalMotion | null
): ResolvedViewportMotion {
  const globalMotion = normalizeGlobalMotion(rawGlobalMotion);

  if (!motion) {
    return {
      viewport,
      enabled: false,
      disabledByBreakpoint: false,
      disabledByGlobal: !globalMotion.enabled,
      isInherited: viewport !== "desktop",
      hasCustomOverride: false,
    };
  }

  const tabletOverride: ResponsiveMotionOverride | undefined = motion.responsive?.tablet;
  const mobileOverride: ResponsiveMotionOverride | undefined = motion.responsive?.mobile;

  const activePresetRef =
    (viewport === "mobile" ? mobileOverride?.presetRef : undefined) ||
    (viewport === "tablet" || viewport === "mobile" ? tabletOverride?.presetRef : undefined) ||
    motion.presetRef;

  const presetDef = findPresetByKey(activePresetRef, customPresets);
  const presetBase = presetDef?.config;

  // Desktop resolved = preset base + local base overrides
  let entrance = mergeSub(presetBase?.entrance, motion.entrance);
  let scroll = mergeSub(presetBase?.scroll, motion.scroll);
  let hover = mergeSub(presetBase?.hover, motion.hover);
  let interaction = mergeSub(presetBase?.interaction, motion.interaction);
  let continuous = mergeSub(presetBase?.continuous, motion.continuous);
  let text = mergeSub(presetBase?.text, motion.text);
  let stagger = mergeSub(presetBase?.stagger, motion.stagger);

  let enabled = motion.enabled !== false;
  let disabledByBreakpoint = false;
  let hasCustomOverride = false;

  if (viewport === "tablet" || viewport === "mobile") {
    if (tabletOverride) {
      if (viewport === "tablet") hasCustomOverride = Object.keys(tabletOverride).length > 0;
      if (tabletOverride.enabled === false) {
        enabled = false;
        disabledByBreakpoint = true;
      } else if (tabletOverride.enabled === true) {
        enabled = true;
        disabledByBreakpoint = false;
      }
      entrance = mergeSub(entrance, tabletOverride.entrance);
      scroll = mergeSub(scroll, tabletOverride.scroll);
      hover = mergeSub(hover, tabletOverride.hover);
      interaction = mergeSub(interaction, tabletOverride.interaction);
      continuous = mergeSub(continuous, tabletOverride.continuous);
      text = mergeSub(text, tabletOverride.text);
      stagger = mergeSub(stagger, tabletOverride.stagger);
    }
  }

  if (viewport === "mobile") {
    if (mobileOverride) {
      hasCustomOverride = Object.keys(mobileOverride).length > 0;
      if (mobileOverride.enabled === false) {
        enabled = false;
        disabledByBreakpoint = true;
      } else if (mobileOverride.enabled === true) {
        enabled = true;
        disabledByBreakpoint = false;
      }
      entrance = mergeSub(entrance, mobileOverride.entrance);
      scroll = mergeSub(scroll, mobileOverride.scroll);
      hover = mergeSub(hover, mobileOverride.hover);
      interaction = mergeSub(interaction, mobileOverride.interaction);
      continuous = mergeSub(continuous, mobileOverride.continuous);
      text = mergeSub(text, mobileOverride.text);
      stagger = mergeSub(stagger, mobileOverride.stagger);
    }
  }

  // Apply Global Motion constraints
  let disabledByGlobal = !globalMotion.enabled;
  if (!globalMotion.enabled) {
    enabled = false;
  }
  if (viewport === "mobile" && globalMotion.mobileBehavior === "disabled") {
    enabled = false;
    disabledByGlobal = true;
  } else if (viewport === "mobile" && globalMotion.mobileBehavior === "reduced") {
    if (scroll && scroll.mode === "parallax") {
      scroll = { ...scroll, enabled: false };
    }
    if (continuous && continuous.enabled !== false) {
      continuous = { ...continuous, enabled: false };
    }
    if (entrance?.duration && entrance.duration > 350) {
      entrance = { ...entrance, duration: Math.round(entrance.duration * 0.7) };
    }
  }

  if (!globalMotion.scrollEffectsEnabled && scroll) {
    scroll = { ...scroll, enabled: false };
  }
  if (!globalMotion.hoverEffectsEnabled && hover) {
    hover = { ...hover, enabled: false };
  }

  return {
    viewport,
    enabled,
    disabledByBreakpoint,
    disabledByGlobal,
    isInherited: viewport !== "desktop" && !hasCustomOverride,
    hasCustomOverride,
    presetRef: activePresetRef,
    entrance,
    scroll,
    hover,
    interaction,
    continuous,
    text,
    stagger,
  };
}

/**
 * Computes capped stagger delay in ms for item `index` of `total` items in a grid/list.
 */
export function computeStaggerDelayMs(
  index: number,
  total: number,
  opts: {
    initialDelay?: number;
    interval?: number;
    maxDelay?: number;
    direction?: "forward" | "reverse" | "center";
    order?: "sequential" | "row" | "column";
    columns?: number;
  } = {}
): number {
  const initialDelay = Math.max(0, opts.initialDelay ?? 0);
  const interval = Math.max(0, opts.interval ?? 80);
  const maxDelay = Math.max(100, opts.maxDelay ?? 800);
  const cols = Math.max(1, opts.columns ?? 4);
  const count = Math.max(1, total);

  let step = index;
  if (opts.order === "row") {
    step = Math.floor(index / cols);
  } else if (opts.order === "column") {
    step = index % cols;
  }

  if (opts.direction === "reverse") {
    const maxStep =
      opts.order === "row"
        ? Math.floor((count - 1) / cols)
        : opts.order === "column"
          ? Math.min(cols - 1, count - 1)
          : count - 1;
    step = Math.max(0, maxStep - step);
  } else if (opts.direction === "center") {
    const maxStep =
      opts.order === "row"
        ? Math.floor((count - 1) / cols)
        : opts.order === "column"
          ? Math.min(cols - 1, count - 1)
          : count - 1;
    const mid = maxStep / 2;
    step = Math.abs(step - mid);
  }

  const raw = initialDelay + Math.round(step * interval);
  return Math.min(raw, initialDelay + maxDelay);
}
