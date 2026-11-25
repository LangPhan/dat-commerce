import type { DiffRow, EditorOperation } from "@/features/builder/types";
import { partitionAiOperations } from "@/features/typography/ai-operations";
import type { TypographyAiOperation } from "@/features/typography/types";
import type { ThemeTokens } from "@/types/api-cms-ai";
import { normalizeGlobalMotion } from "./defaults";
import type {
  ElementMotionConfig,
  GlobalMotionSettings,
  MotionCategory,
} from "./types";

export type AiGlobalMotionOp = {
  type: "update_global_motion";
  motion: Partial<GlobalMotionSettings>;
};

export type AiCreateAnimationPresetOp = {
  type: "create_animation_preset";
  name: string;
  category: MotionCategory;
  description?: string;
  config: ElementMotionConfig;
};

export function partitionAllEditorAiOperations(
  rawOps: Array<{ type: string; [key: string]: unknown }>
): {
  nodeOps: Array<{ type: string; [key: string]: unknown }>;
  typographyOps: TypographyAiOperation[];
  globalMotionOps: AiGlobalMotionOp[];
  presetCreateOps: AiCreateAnimationPresetOp[];
} {
  const globalMotionOps: AiGlobalMotionOp[] = [];
  const presetCreateOps: AiCreateAnimationPresetOp[] = [];
  const remaining: Array<{ type: string; [key: string]: unknown }> = [];

  for (const op of rawOps || []) {
    if (!op || typeof op !== "object") continue;
    const t = String(op.type || "").toLowerCase();
    if (t === "update_global_motion" && op.motion && typeof op.motion === "object") {
      globalMotionOps.push({
        type: "update_global_motion",
        motion: op.motion as Partial<GlobalMotionSettings>,
      });
    } else if (t === "create_animation_preset" && typeof op.name === "string") {
      presetCreateOps.push({
        type: "create_animation_preset",
        name: op.name,
        category: ((op.category as MotionCategory) || "entrance"),
        description: typeof op.description === "string" ? op.description : "",
        config: (op.config as ElementMotionConfig) || { enabled: true },
      });
    } else {
      remaining.push(op);
    }
  }

  const { nodeOps, typographyOps } = partitionAiOperations(remaining);
  return { nodeOps, typographyOps, globalMotionOps, presetCreateOps };
}

export function applyGlobalMotionAiOperations(
  tokens: ThemeTokens,
  ops: AiGlobalMotionOp[]
): { nextTokens: ThemeTokens; diffs: DiffRow[] } {
  const before = normalizeGlobalMotion(tokens.motion);
  let next: GlobalMotionSettings = {
    ...before,
    timingTokens: { ...before.timingTokens },
    easingTokens: { ...before.easingTokens },
  };

  for (const op of ops) {
    const patch = op.motion || {};
    next = {
      ...next,
      ...patch,
      timingTokens: {
        ...next.timingTokens,
        ...(patch.timingTokens || {}),
      },
      easingTokens: {
        ...next.easingTokens,
        ...(patch.easingTokens || {}),
      },
    };
  }

  const normalizedNext = normalizeGlobalMotion(next);
  const diffs: DiffRow[] = [];

  const scalarKeys: Array<
    [keyof typeof normalizedNext, string]
  > = [
    ["enabled", "Global Animations"],
    ["scrollEffectsEnabled", "Scroll Effects"],
    ["hoverEffectsEnabled", "Hover Effects"],
    ["mobileBehavior", "Mobile Behavior"],
    ["reducedMotionPolicy", "Reduced Motion"],
    ["defaultDuration", "Default Duration"],
    ["defaultHoverDuration", "Hover Duration"],
    ["defaultEasing", "Default Easing"],
    ["defaultEntrancePreset", "Default Entrance"],
  ];

  for (const [k, label] of scalarKeys) {
    const bVal = String(before[k]);
    const aVal = String(normalizedNext[k]);
    if (bVal !== aVal) {
      diffs.push({
        nodeId: "global-motion",
        nodeLabel: "Global Motion",
        field: label,
        before: bVal,
        after: aVal,
      });
    }
  }

  for (const tk of ["fast", "normal", "slow"] as const) {
    if (before.timingTokens[tk] !== normalizedNext.timingTokens[tk]) {
      diffs.push({
        nodeId: "global-motion",
        nodeLabel: "Global Motion",
        field: `timing.${tk}`,
        before: `${before.timingTokens[tk]}ms`,
        after: `${normalizedNext.timingTokens[tk]}ms`,
      });
    }
  }

  return {
    nextTokens: {
      ...tokens,
      motion: normalizedNext,
    },
    diffs,
  };
}

export function analyzeAiMotionConfirmation(
  nodeOps: EditorOperation[],
  globalMotionOps: AiGlobalMotionOp[]
): {
  required: boolean;
  reasons: string[];
  animatedNodeIds: string[];
} {
  const animatedIds = new Set<string>();
  const reasons: string[] = [];
  let hasRemove = false;

  for (const op of nodeOps) {
    if (
      op.type === "set_element_animation" ||
      op.type === "update_element_animation" ||
      op.type === "update_responsive_animation"
    ) {
      animatedIds.add(op.nodeId);
    } else if (op.type === "remove_element_animation") {
      animatedIds.add(op.nodeId);
      hasRemove = true;
    } else if (op.type === "apply_animation_to_selection") {
      for (const id of op.nodeIds) animatedIds.add(id);
    }
  }

  if (animatedIds.size >= 3) {
    reasons.push(`Bulk motion edit affects ${animatedIds.size} elements`);
  }
  if (hasRemove) {
    reasons.push("Removes existing element animation configuration");
  }
  if (globalMotionOps.some((op) => op.motion?.enabled === false)) {
    reasons.push("Disables animations globally across the storefront");
  }

  return {
    required: reasons.length > 0,
    reasons,
    animatedNodeIds: Array.from(animatedIds),
  };
}
