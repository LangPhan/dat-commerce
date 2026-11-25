import { z } from "zod";
import type { ElementMotionConfig, GlobalMotionSettings } from "./types";

const cubicOrToken = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(
    (v) =>
      ["linear", "ease", "easeIn", "easeOut", "easeInOut", "spring", "custom", "ease-in", "ease-out", "ease-in-out"].includes(v) ||
      /^cubic-bezier\(\s*[0-9]*\.?[0-9]+\s*,\s*-?[0-9]*\.?[0-9]+\s*,\s*[0-9]*\.?[0-9]+\s*,\s*-?[0-9]*\.?[0-9]+\s*\)$/.test(v),
    "Invalid easing value"
  );

export const entranceMotionSchema = z.object({
  enabled: z.boolean().optional(),
  preset: z.string().optional(),
  trigger: z.enum(["load", "viewport"]).optional(),
  duration: z.number().min(0).max(5000).optional(),
  delay: z.number().min(0).max(5000).optional(),
  easing: cubicOrToken.optional(),
  repeat: z.number().int().min(1).max(100).optional(),
  repeatDelay: z.number().min(0).max(10000).optional(),
  direction: z.enum(["normal", "reverse", "alternate", "alternate-reverse"]).optional(),
  threshold: z.number().min(0).max(1).optional(),
  distance: z.number().min(0).max(300).optional(),
  once: z.boolean().optional(),
});

export const scrollMotionSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["reveal", "linked", "parallax", "sticky"]).optional(),
  effect: z.string().optional(),
  start: z.number().min(0).max(100).optional(),
  end: z.number().min(0).max(100).optional(),
  direction: z.enum(["normal", "reverse", "up", "down", "left", "right"]).optional(),
  min: z.number().min(-2000).max(2000).optional(),
  max: z.number().min(-2000).max(2000).optional(),
  speed: z.number().min(-200).max(200).optional(),
  intensity: z.number().min(0).max(200).optional(),
  offset: z.number().min(-500).max(500).optional(),
  stickyOffset: z.number().min(0).max(400).optional(),
  stickyDuration: z.number().min(100).max(3000).optional(),
  duration: z.number().min(0).max(5000).optional(),
  easing: cubicOrToken.optional(),
});

export const hoverMotionSchema = z.object({
  enabled: z.boolean().optional(),
  preset: z.string().optional(),
  scale: z.number().min(0.2).max(3).optional(),
  translateX: z.number().min(-200).max(200).optional(),
  translateY: z.number().min(-200).max(200).optional(),
  rotate: z.number().min(-720).max(720).optional(),
  opacity: z.number().min(0).max(1).optional(),
  blur: z.number().min(0).max(40).optional(),
  shadow: z.string().max(160).optional(),
  duration: z.number().min(0).max(5000).optional(),
  delay: z.number().min(0).max(5000).optional(),
  easing: cubicOrToken.optional(),
});

export const interactionMotionSchema = z.object({
  enabled: z.boolean().optional(),
  preset: z.string().optional(),
  trigger: z.enum(["click", "tap", "focus", "active", "toggle"]).optional(),
  triggers: z.array(z.enum(["click", "tap", "focus", "active", "toggle"])).optional(),
  scale: z.number().min(0.5).max(2).optional(),
  rotate: z.number().min(-360).max(360).optional(),
  duration: z.number().min(0).max(3000).optional(),
  easing: cubicOrToken.optional(),
});

export const continuousMotionSchema = z.object({
  enabled: z.boolean().optional(),
  preset: z.string().optional(),
  duration: z.number().min(100).max(15000).optional(),
  delay: z.number().min(0).max(5000).optional(),
  repeat: z.number().int().min(1).max(100).optional(),
  infinite: z.boolean().optional(),
  direction: z.enum(["normal", "reverse", "alternate", "alternate-reverse"]).optional(),
  easing: cubicOrToken.optional(),
  pauseOnHover: z.boolean().optional(),
});

export const textMotionSchema = z.object({
  enabled: z.boolean().optional(),
  preset: z.string().optional(),
  splitBy: z.enum(["char", "word", "line"]).optional(),
  staggerMs: z.number().min(0).max(500).optional(),
  duration: z.number().min(50).max(5000).optional(),
  delay: z.number().min(0).max(5000).optional(),
  easing: cubicOrToken.optional(),
  trigger: z.enum(["load", "viewport"]).optional(),
});

export const staggerMotionSchema = z.object({
  enabled: z.boolean().optional(),
  preset: z.string().optional(),
  initialDelay: z.number().min(0).max(3000).optional(),
  interval: z.number().min(0).max(500).optional(),
  maxDelay: z.number().min(0).max(3000).optional(),
  duration: z.number().min(50).max(3000).optional(),
  direction: z.enum(["forward", "reverse", "center"]).optional(),
  order: z.enum(["sequential", "row", "column"]).optional(),
  trigger: z.enum(["load", "viewport"]).optional(),
});

const responsiveMotionOverrideSchema = z.object({
  enabled: z.boolean().optional(),
  presetRef: z.string().max(80).optional(),
  entrance: entranceMotionSchema.optional(),
  scroll: scrollMotionSchema.optional(),
  hover: hoverMotionSchema.optional(),
  interaction: interactionMotionSchema.optional(),
  continuous: continuousMotionSchema.optional(),
  text: textMotionSchema.optional(),
  stagger: staggerMotionSchema.optional(),
});

export const elementMotionSchema = z.object({
  schemaVersion: z.number().int().optional(),
  enabled: z.boolean().optional(),
  presetRef: z.string().max(80).optional(),
  entrance: entranceMotionSchema.optional(),
  scroll: scrollMotionSchema.optional(),
  hover: hoverMotionSchema.optional(),
  interaction: interactionMotionSchema.optional(),
  continuous: continuousMotionSchema.optional(),
  text: textMotionSchema.optional(),
  stagger: staggerMotionSchema.optional(),
  responsive: z
    .object({
      tablet: responsiveMotionOverrideSchema.optional(),
      mobile: responsiveMotionOverrideSchema.optional(),
    })
    .optional(),
});

export const globalMotionSchema = z.object({
  schemaVersion: z.number().int().optional(),
  enabled: z.boolean().optional(),
  scrollEffectsEnabled: z.boolean().optional(),
  hoverEffectsEnabled: z.boolean().optional(),
  mobileBehavior: z.enum(["full", "reduced", "disabled"]).optional(),
  reducedMotionPolicy: z
    .enum(["respect-system", "always-reduced", "essential-only"])
    .optional(),
  defaultDuration: z.number().min(50).max(3000).optional(),
  defaultEasing: cubicOrToken.optional(),
  defaultHoverDuration: z.number().min(50).max(2000).optional(),
  defaultEntrancePreset: z.string().optional(),
  timingTokens: z
    .object({
      fast: z.number().min(50).max(3000).optional(),
      normal: z.number().min(50).max(3000).optional(),
      slow: z.number().min(50).max(3000).optional(),
    })
    .optional(),
  easingTokens: z
    .object({
      linear: cubicOrToken.optional(),
      ease: cubicOrToken.optional(),
      easeIn: cubicOrToken.optional(),
      easeOut: cubicOrToken.optional(),
      easeInOut: cubicOrToken.optional(),
      custom: cubicOrToken.optional(),
    })
    .optional(),
});

export function sanitizeElementMotion(raw: unknown): ElementMotionConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const parsed = elementMotionSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return parsed.data as ElementMotionConfig;
}

export function sanitizeGlobalMotion(raw: unknown): GlobalMotionSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const parsed = globalMotionSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return parsed.data as GlobalMotionSettings;
}
