"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { useReducedMotion } from "@/features/motion/use-reduced-motion";
import { matchesTargetPages } from "../theme-merge";
import type { ResolvedExperienceLayerDto, ResolvedStorefrontExperienceDto } from "../types";
import { AmbientGlowOverlay } from "./AmbientGlowOverlay";
import { CornerFloralFrame } from "./CornerFloralFrame";
import { FestiveLanternsBar } from "./FestiveLanternsBar";
import { FlashCountdownWidget } from "./FlashCountdownWidget";
import { ParticleCanvasEngine } from "./ParticleCanvasEngine";
import { SantaSleighScene } from "./SantaSleighScene";
import { SeasonalPromoBanner } from "./SeasonalPromoBanner";
import { StringLightsBar } from "./StringLightsBar";
import { FloatingStickerBadge } from "./FloatingStickerBadge";

const CANVAS_TYPES = new Set([
  "snowfall",
  "blossom_petals",
  "floating_hearts",
  "golden_particles",
  "fireworks",
  "confetti_burst",
]);

function isLayerVisibleForViewport(
  layer: ResolvedExperienceLayerDto,
  viewport?: "desktop" | "tablet" | "mobile"
): boolean {
  if (!viewport) return true;
  if (!layer.visibility) return true;
  return layer.visibility[viewport] !== false;
}

export function ExperienceTopSlot({
  experience,
  currentPath = "/",
  viewport,
  reducedMotionOverride,
}: {
  experience?: ResolvedStorefrontExperienceDto | null;
  currentPath?: string;
  viewport?: "desktop" | "tablet" | "mobile";
  reducedMotionOverride?: boolean;
}) {
  const sysReduced = useReducedMotion();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  if (!experience?.enabled) return null;

  const reduced = reducedMotionOverride ?? (experience.respectReducedMotion && sysReduced);
  const topLayers = (experience.layers || []).filter(
    (l) =>
      l.zone === "top_announcement" &&
      !dismissedIds.has(l.id) &&
      matchesTargetPages(currentPath, l.targetPages) &&
      isLayerVisibleForViewport(l, viewport)
  );
  if (!topLayers.length) return null;

  return (
    <div className="exp-top-slot">
      {topLayers.map((layer) => {
        if (layer.type === "promo_banner") {
          return (
            <SeasonalPromoBanner
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
              onDismiss={() =>
                setDismissedIds((prev) => new Set(prev).add(layer.id))
              }
            />
          );
        }
        if (layer.type === "countdown_bar") {
          return (
            <FlashCountdownWidget
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        if (layer.type === "string_lights") {
          return (
            <StringLightsBar
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export function ExperienceHeaderFrameSlot({
  experience,
  currentPath = "/",
  viewport,
  reducedMotionOverride,
}: {
  experience?: ResolvedStorefrontExperienceDto | null;
  currentPath?: string;
  viewport?: "desktop" | "tablet" | "mobile";
  reducedMotionOverride?: boolean;
}) {
  const sysReduced = useReducedMotion();
  if (!experience?.enabled) return null;
  const reduced = reducedMotionOverride ?? (experience.respectReducedMotion && sysReduced);

  const headerLayers = (experience.layers || []).filter(
    (l) =>
      l.zone === "header_frame" &&
      matchesTargetPages(currentPath, l.targetPages) &&
      isLayerVisibleForViewport(l, viewport)
  );
  if (!headerLayers.length) return null;

  return (
    <div className="exp-header-frame-slot">
      {headerLayers.map((layer) => {
        if (layer.type === "string_lights") {
          return (
            <StringLightsBar
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        if (layer.type === "festive_lanterns") {
          return (
            <FestiveLanternsBar
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        if (layer.type === "santa_sleigh") {
          return (
            <SantaSleighScene
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
              contained
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export function ExperienceHeroSlot({
  experience,
  currentPath = "/",
  viewport,
  reducedMotionOverride,
}: {
  experience?: ResolvedStorefrontExperienceDto | null;
  currentPath?: string;
  viewport?: "desktop" | "tablet" | "mobile";
  reducedMotionOverride?: boolean;
}) {
  const sysReduced = useReducedMotion();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  if (!experience?.enabled) return null;
  const reduced = reducedMotionOverride ?? (experience.respectReducedMotion && sysReduced);

  const heroLayers = (experience.layers || []).filter(
    (l) =>
      l.zone === "hero_stage" &&
      !CANVAS_TYPES.has(l.type) &&
      !dismissedIds.has(l.id) &&
      matchesTargetPages(currentPath, l.targetPages) &&
      isLayerVisibleForViewport(l, viewport)
  );
  if (!heroLayers.length) return null;

  return (
    <div className="exp-hero-slot">
      {heroLayers.map((layer) => {
        if (layer.type === "promo_banner") {
          return (
            <SeasonalPromoBanner
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
              onDismiss={() => setDismissedIds((prev) => new Set(prev).add(layer.id))}
            />
          );
        }
        if (layer.type === "countdown_bar") {
          return (
            <FlashCountdownWidget
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        if (layer.type === "santa_sleigh") {
          return (
            <SantaSleighScene
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
              contained
            />
          );
        }
        if (layer.type === "festive_lanterns") {
          return (
            <FestiveLanternsBar
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export function ExperienceFooterSlot({
  experience,
  currentPath = "/",
  viewport,
  reducedMotionOverride,
}: {
  experience?: ResolvedStorefrontExperienceDto | null;
  currentPath?: string;
  viewport?: "desktop" | "tablet" | "mobile";
  reducedMotionOverride?: boolean;
}) {
  const sysReduced = useReducedMotion();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  if (!experience?.enabled) return null;
  const reduced = reducedMotionOverride ?? (experience.respectReducedMotion && sysReduced);

  const footerLayers = (experience.layers || []).filter(
    (l) =>
      l.zone === "footer_stage" &&
      !dismissedIds.has(l.id) &&
      matchesTargetPages(currentPath, l.targetPages) &&
      isLayerVisibleForViewport(l, viewport)
  );
  if (!footerLayers.length) return null;

  return (
    <div className="exp-footer-slot">
      {footerLayers.map((layer) => {
        if (layer.type === "string_lights") {
          return (
            <StringLightsBar
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        if (layer.type === "festive_lanterns") {
          return (
            <FestiveLanternsBar
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
            />
          );
        }
        if (layer.type === "promo_banner") {
          return (
            <SeasonalPromoBanner
              key={`${layer.sourceExperienceId}-${layer.id}`}
              layer={layer}
              reducedMotion={reduced}
              onDismiss={() => setDismissedIds((prev) => new Set(prev).add(layer.id))}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export function ExperienceOverlayRuntime({
  experience,
  currentPath = "/",
  contained = false,
  pausedOverride,
  reducedMotionOverride,
  viewport,
}: {
  experience?: ResolvedStorefrontExperienceDto | null;
  currentPath?: string;
  contained?: boolean;
  pausedOverride?: boolean;
  reducedMotionOverride?: boolean;
  viewport?: "desktop" | "tablet" | "mobile";
}) {
  const sysReduced = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);

  if (!experience?.enabled) return null;
  const reduced = reducedMotionOverride ?? (experience.respectReducedMotion && sysReduced);
  const paused = pausedOverride ?? userPaused;

  const eligible = (experience.layers || []).filter(
    (l) =>
      matchesTargetPages(currentPath, l.targetPages) &&
      isLayerVisibleForViewport(l, viewport)
  );

  const canvasLayers = eligible.filter((l) => CANVAS_TYPES.has(l.type));
  const ambientLayers = eligible.filter((l) => l.type === "ambient_glow");
  const cornerLayers = eligible.filter((l) => l.type === "corner_floral_frame");
  const overlaySanta = eligible.filter(
    (l) => l.type === "santa_sleigh" && l.zone === "viewport_overlay"
  );
  const stickers = eligible.filter((l) => l.type === "floating_sticker");
  const floatingCountdowns = eligible.filter(
    (l) => l.type === "countdown_bar" && l.zone === "floating_corner"
  );

  const mobileRatio =
    experience.mobilePerformanceMode === "OFF"
      ? 0
      : experience.mobilePerformanceMode === "MINIMAL"
        ? 0.25
        : experience.mobilePerformanceMode === "FULL"
          ? 1.0
          : 0.5;

  const backdrop = experience.effectiveThemeOverride?.enabled
    ? experience.effectiveThemeOverride.backdrop
    : null;

  return (
    <>
      {backdrop && backdrop.kind !== "none" ? (
        <div
          aria-hidden="true"
          className={contained ? "exp-theme-backdrop is-contained" : "exp-theme-backdrop"}
          style={{
            opacity: backdrop.opacity ?? 0.25,
            background:
              backdrop.kind === "vignette"
                ? `radial-gradient(ellipse at center, transparent 54%, ${backdrop.primaryColor || "#BAE6FD"}88 100%)`
                : backdrop.kind === "top_aurora"
                  ? `linear-gradient(180deg, ${backdrop.primaryColor || "#DC2626"}40 0%, ${backdrop.secondaryColor || "#FACC15"}14 38%, transparent 72%)`
                  : `radial-gradient(circle at 50% 15%, ${backdrop.primaryColor || "#FACC15"}45, ${backdrop.secondaryColor || "#F43F5E"}18 45%, transparent 75%)`,
          }}
        />
      ) : null}

      {ambientLayers.map((layer) => (
        <AmbientGlowOverlay
          key={`${layer.sourceExperienceId}-${layer.id}`}
          layer={layer}
          contained={contained}
        />
      ))}

      {canvasLayers.length > 0 && !paused ? (
        <ParticleCanvasEngine
          layers={canvasLayers}
          contained={contained}
          paused={paused}
          reducedMotion={reduced}
          mobileDensityRatio={mobileRatio}
          pauseOnHiddenTab
        />
      ) : null}

      {cornerLayers.map((layer) => (
        <CornerFloralFrame
          key={`${layer.sourceExperienceId}-${layer.id}`}
          layer={layer}
          reducedMotion={reduced}
          contained={contained}
        />
      ))}

      {overlaySanta.map((layer) => (
        <SantaSleighScene
          key={`${layer.sourceExperienceId}-${layer.id}`}
          layer={layer}
          reducedMotion={reduced}
          contained={contained}
        />
      ))}

      {stickers.map((layer) => (
        <FloatingStickerBadge
          key={`${layer.sourceExperienceId}-${layer.id}`}
          layer={layer}
          reducedMotion={reduced}
          contained={contained}
        />
      ))}

      {floatingCountdowns.map((layer) => (
        <div
          key={`${layer.sourceExperienceId}-${layer.id}`}
          className={contained ? "exp-floating-countdown is-contained" : "exp-floating-countdown"}
        >
          <FlashCountdownWidget layer={layer} reducedMotion={reduced} />
        </div>
      ))}

      {!contained && experience.allowCustomerDismiss && canvasLayers.length > 0 ? (
        <button
          type="button"
          className="exp-shopper-toggle"
          onClick={() => setUserPaused((p) => !p)}
          aria-label={userPaused ? "Resume seasonal effects" : "Pause seasonal effects"}
          title={userPaused ? "Resume seasonal effects" : "Pause seasonal effects"}
        >
          {userPaused ? <Play size={12} /> : <Pause size={12} />}
          <span>{userPaused ? "Effects paused" : "Pause effects"}</span>
        </button>
      ) : null}
    </>
  );
}
