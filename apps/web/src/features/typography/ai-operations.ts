import type { EditorOperation } from "@/features/builder/types";
import type { ThemeTokens } from "@/types/api-cms-ai";
import {
  FONT_ROLE_METADATA,
  cloneTypography,
  normalizeGlobalTypography,
  resetAllTypography,
  resetSinglePreset,
} from "./defaults";
import { findCatalogFont } from "./font-catalog";
import type {
  TypographyAiOperation,
  TypographyFontRole,
  TypographyPreset,
} from "./types";

const TYPOGRAPHY_OP_TYPES = new Set([
  "update_typography_font",
  "update_typography_preset",
  "reset_typography_preset",
]);

export function isTypographyOperation(
  op: unknown
): op is TypographyAiOperation {
  if (!op || typeof op !== "object") return false;
  const t = (op as { type?: string }).type;
  return typeof t === "string" && TYPOGRAPHY_OP_TYPES.has(t);
}

export function partitionAiOperations(ops: unknown[]): {
  nodeOps: EditorOperation[];
  typographyOps: TypographyAiOperation[];
} {
  const nodeOps: EditorOperation[] = [];
  const typographyOps: TypographyAiOperation[] = [];
  for (const op of ops) {
    if (isTypographyOperation(op)) {
      typographyOps.push(op);
    } else if (op && typeof op === "object") {
      nodeOps.push(op as EditorOperation);
    }
  }
  return { nodeOps, typographyOps };
}

function summarizeVal(val: unknown): string {
  if (val === undefined || val === null) return "unset";
  if (typeof val === "object") {
    const rec = val as Record<string, unknown>;
    return ["desktop", "tablet", "mobile"]
      .filter((bp) => rec[bp] !== undefined)
      .map((bp) => `${bp[0].toUpperCase()}:${String(rec[bp])}`)
      .join(" / ");
  }
  return String(val);
}

function applyPresetProperty(
  preset: TypographyPreset,
  prop: keyof TypographyPreset,
  value: unknown,
  responsiveValues?: Record<string, unknown>
): TypographyPreset {
  const next = { ...preset };
  if (responsiveValues && (prop === "fontSize" || prop === "lineHeight" || prop === "letterSpacing")) {
    const prevObj =
      next[prop] && typeof next[prop] === "object"
        ? { ...(next[prop] as Record<string, unknown>) }
        : { desktop: next[prop] };
    const merged: Record<string, unknown> = { ...prevObj };
    for (const bp of ["desktop", "tablet", "mobile"]) {
      if (responsiveValues[bp] !== undefined) {
        merged[bp] = responsiveValues[bp];
      }
    }
    (next as Record<string, unknown>)[prop] = merged;
    return next;
  }

  if ((prop === "fontSize" || prop === "lineHeight" || prop === "letterSpacing") && typeof value !== "object") {
    const prevObj =
      next[prop] && typeof next[prop] === "object"
        ? { ...(next[prop] as Record<string, unknown>) }
        : {};
    (next as Record<string, unknown>)[prop] = {
      ...prevObj,
      desktop: value,
    };
    return next;
  }

  (next as Record<string, unknown>)[prop] = value;
  return next;
}

export function applyTypographyOperations(
  tokens: ThemeTokens,
  ops: TypographyAiOperation[]
): {
  nextTokens: ThemeTokens;
  diffs: string[];
  affectedPresets: string[];
} {
  let working = cloneTypography(normalizeGlobalTypography(tokens.typography));
  const diffs: string[] = [];
  const affected = new Set<string>();

  for (const op of ops) {
    if (op.type === "update_typography_font") {
      const role = op.role as TypographyFontRole;
      const existing = working.fonts[role];
      if (!existing) continue;
      const cat = findCatalogFont(op.family);
      const prevFamily = existing.family;
      working.fonts[role] = {
        ...existing,
        family: op.family,
        source: op.source || cat?.source || existing.source,
        fallback: op.fallback || cat?.fallback || existing.fallback,
        weights: op.weights?.length ? op.weights : cat?.weights || existing.weights,
        style: op.style || existing.style,
        variable: cat?.variable ?? existing.variable,
      };
      if (role === "heading") working.headingFont = op.family;
      if (role === "body") working.bodyFont = op.family;
      diffs.push(
        `${FONT_ROLE_METADATA[role].label}: ${prevFamily} -> ${op.family}`
      );
      for (const preset of Object.values(working.presets)) {
        if (preset.fontFamily === role) {
          affected.add(preset.id);
        }
      }
      continue;
    }

    if (op.type === "update_typography_preset") {
      const target = working.presets[op.target];
      if (!target) continue;
      let nextPreset = { ...target };

      if (op.patch && typeof op.patch === "object") {
        for (const [k, v] of Object.entries(op.patch)) {
          if (v === undefined) continue;
          const prevDisplay = summarizeVal((nextPreset as Record<string, unknown>)[k]);
          if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            nextPreset = applyPresetProperty(
              nextPreset,
              k as keyof TypographyPreset,
              undefined,
              v as Record<string, unknown>
            );
          } else {
            nextPreset = applyPresetProperty(
              nextPreset,
              k as keyof TypographyPreset,
              v
            );
          }
          diffs.push(
            `${nextPreset.name} · ${k}: ${prevDisplay} -> ${summarizeVal(v)}`
          );
        }
      } else if (op.property) {
        const prevDisplay = summarizeVal(
          (nextPreset as Record<string, unknown>)[op.property]
        );
        const valInput = op.responsiveValues || op.value;
        nextPreset = applyPresetProperty(
          nextPreset,
          op.property,
          op.value,
          op.responsiveValues as Record<string, unknown> | undefined
        );
        diffs.push(
          `${nextPreset.name} · ${op.property}: ${prevDisplay} -> ${summarizeVal(valInput)}`
        );
      }

      working.presets[op.target] = nextPreset;
      affected.add(op.target);
      continue;
    }

    if (op.type === "reset_typography_preset") {
      if (op.target === "all") {
        working = resetAllTypography();
        diffs.push("Reset all Global Typography settings to defaults");
        for (const id of Object.keys(working.presets)) {
          affected.add(id);
        }
      } else if (working.presets[op.target]) {
        const name = working.presets[op.target].name;
        working = resetSinglePreset(working, op.target);
        diffs.push(`Reset ${name} preset to default`);
        affected.add(op.target);
      }
    }
  }

  return {
    nextTokens: {
      ...tokens,
      typography: working,
    },
    diffs,
    affectedPresets: Array.from(affected),
  };
}
