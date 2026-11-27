"use client";

import type { CSSProperties } from "react";
import type { ResolvedExperienceLayerDto } from "../types";

export function AmbientGlowOverlay({
  layer,
  contained = false,
}: {
  layer: ResolvedExperienceLayerDto;
  contained?: boolean;
}) {
  const p = layer.props || {};
  const styleKind = typeof p.style === "string" ? p.style : "gold_spotlight";
  const primary = typeof p.primaryColor === "string" ? p.primaryColor : "#FACC15";
  const secondary = typeof p.secondaryColor === "string" ? p.secondaryColor : "#F43F5E";
  const intensity = typeof p.intensity === "number" ? Math.max(0.05, Math.min(0.9, p.intensity)) : 0.35;

  let background = `radial-gradient(circle at 50% 12%, ${primary}55, transparent 62%)`;
  if (styleKind === "frost_vignette") {
    background = `radial-gradient(ellipse at center, transparent 52%, ${primary}66 100%)`;
  } else if (styleKind === "aurora_ribbon") {
    background = `linear-gradient(125deg, ${primary}44 0%, transparent 45%, ${secondary}44 100%)`;
  } else if (styleKind === "rose_aura" || styleKind === "crimson_glow") {
    background = `radial-gradient(circle at 20% 15%, ${primary}48, transparent 48%), radial-gradient(circle at 82% 80%, ${secondary}40, transparent 52%)`;
  }

  const css: CSSProperties = {
    background,
    opacity: Math.min(1, layer.opacity * (intensity * 1.8)),
    mixBlendMode: layer.blendMode === "screen" ? "screen" : layer.blendMode === "lighter" ? "plus-lighter" : "normal",
    zIndex: layer.zIndex,
  };

  return (
    <div
      aria-hidden="true"
      className={contained ? "exp-ambient-glow is-contained" : "exp-ambient-glow"}
      style={css}
    />
  );
}
