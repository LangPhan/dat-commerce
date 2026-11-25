"use client";

import { useReducedMotion } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ElementType, ViewportMode } from "@/features/builder/types";
import { cn } from "@/lib/format";
import { normalizeGlobalMotion, resolveEasingCss } from "./defaults";
import { computeStaggerDelayMs, resolveElementMotionForViewport } from "./resolve";
import { applyScrollProgressToElement, subscribeScrollMotion } from "./scroll-engine";
import type {
  AnimationPresetDefinition,
  ElementMotionConfig,
  GlobalMotionSettings,
  HoverMotionConfig,
  NormalizedGlobalMotion,
} from "./types";

const INLINE_NODE_TYPES = new Set<ElementType>(["button", "icon", "price"]);

function resolveHoverVars(
  hover: HoverMotionConfig,
  globalMotion: NormalizedGlobalMotion
): Record<string, string> {
  const preset = hover.preset || "none";
  let scale = hover.scale;
  let tx = hover.translateX;
  let ty = hover.translateY;
  let rot = hover.rotate;
  let op = hover.opacity;
  let blur = hover.blur;
  let shadow = hover.shadow;

  if (preset === "scaleUp" && scale === undefined) scale = 1.03;
  if (preset === "scaleDown" && scale === undefined) scale = 0.97;
  if (preset === "moveUp" && ty === undefined) ty = -6;
  if (preset === "moveDown" && ty === undefined) ty = 6;
  if (preset === "moveLeft" && tx === undefined) tx = -6;
  if (preset === "moveRight" && tx === undefined) tx = 6;
  if (preset === "rotate" && rot === undefined) rot = 3;
  if (preset === "tilt") {
    if (rot === undefined) rot = -2;
    if (scale === undefined) scale = 1.02;
  }
  if (preset === "fade" && op === undefined) op = 0.82;
  if (preset === "shadow") {
    if (ty === undefined) ty = -3;
    if (!shadow) shadow = "0 16px 36px rgba(15, 23, 42, 0.16)";
  }
  if (preset === "glow" && !shadow) {
    shadow = "0 0 0 4px rgba(91, 70, 232, 0.24)";
  }
  if (preset === "blur" && blur === undefined) blur = 2;

  return {
    "--m-hov-dur": `${hover.duration ?? globalMotion.defaultHoverDuration}ms`,
    "--m-hov-delay": `${hover.delay ?? 0}ms`,
    "--m-hov-ease": resolveEasingCss(hover.easing, globalMotion),
    "--m-hov-scale": String(scale ?? 1),
    "--m-hov-tx": `${tx ?? 0}px`,
    "--m-hov-ty": `${ty ?? 0}px`,
    "--m-hov-rot": `${rot ?? 0}deg`,
    "--m-hov-op": String(op ?? 1),
    "--m-hov-filter": blur && blur > 0 ? `blur(${blur}px)` : "none",
    "--m-hov-shadow": shadow || "none",
  };
}

export function MotionWrapper({
  nodeId,
  nodeType,
  motion,
  viewport,
  mode,
  globalMotion,
  customPresets = [],
  replayNonce = 0,
  paused = false,
  scrollProgressOverride = null,
  children,
}: {
  nodeId: string;
  nodeType: ElementType;
  motion?: ElementMotionConfig;
  viewport: ViewportMode;
  mode: "edit" | "live";
  globalMotion?: GlobalMotionSettings | NormalizedGlobalMotion | null;
  customPresets?: AnimationPresetDefinition[];
  replayNonce?: number;
  paused?: boolean;
  scrollProgressOverride?: number | null;
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const normalizedGlobal = useMemo(
    () => normalizeGlobalMotion(globalMotion),
    [globalMotion]
  );

  const resolved = useMemo(
    () =>
      resolveElementMotionForViewport(
        motion,
        viewport,
        customPresets,
        normalizedGlobal
      ),
    [motion, viewport, customPresets, normalizedGlobal]
  );

  const isReduced =
    Boolean(prefersReducedMotion) ||
    normalizedGlobal.reducedMotionPolicy === "always-reduced";

  const hasEntrance = Boolean(
    resolved.enabled &&
      !isReduced &&
      resolved.entrance && resolved.entrance.enabled !== false &&
      resolved.entrance.preset &&
      resolved.entrance.preset !== "none"
  );
  const hasScroll = Boolean(
    resolved.enabled &&
      !isReduced &&
      resolved.scroll && resolved.scroll.enabled !== false &&
      resolved.scroll.effect &&
      resolved.scroll.effect !== "none"
  );
  const hasHover = Boolean(
    resolved.enabled &&
      resolved.hover && resolved.hover.enabled !== false &&
      resolved.hover.preset &&
      resolved.hover.preset !== "none"
  );
  const hasInteraction = Boolean(
    resolved.enabled &&
      resolved.interaction && resolved.interaction.enabled !== false &&
      resolved.interaction.preset &&
      resolved.interaction.preset !== "none"
  );
  const hasContinuous = Boolean(
    resolved.enabled &&
      !isReduced &&
      resolved.continuous && resolved.continuous.enabled !== false &&
      resolved.continuous.preset &&
      resolved.continuous.preset !== "none"
  );
  const hasStagger = Boolean(
    resolved.enabled && !isReduced && resolved.stagger?.enabled
  );

  const anyActive =
    hasEntrance ||
    hasScroll ||
    hasHover ||
    hasInteraction ||
    hasContinuous ||
    hasStagger;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState<boolean>(
    () => !hasEntrance || resolved.entrance?.trigger === "load"
  );
  const [playKey, setPlayKey] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const [toggled, setToggled] = useState(false);

  // Only restart entrance when entrance parameters or explicit replayNonce change
  // (never when unrelated Inspector styles/props change!)
  const entranceSig = hasEntrance
    ? `${resolved.entrance?.preset}|${resolved.entrance?.duration ?? normalizedGlobal.defaultDuration}|${resolved.entrance?.delay ?? 0}|${resolved.entrance?.easing ?? ""}|${resolved.entrance?.trigger ?? "viewport"}|${resolved.entrance?.direction ?? "normal"}|${resolved.entrance?.repeat ?? 1}|${replayNonce}`
    : "";
  const prevEntranceSigRef = useRef(entranceSig);

  const effectiveTrigger = hasEntrance
    ? resolved.entrance?.trigger || "viewport"
    : resolved.stagger?.trigger || "viewport";
  const needsObserver =
    (hasEntrance || hasStagger) &&
    !isReduced &&
    effectiveTrigger !== "load" &&
    typeof IntersectionObserver !== "undefined";
  const isEntered = !needsObserver || entered;

  useEffect(() => {
    if (!hasEntrance) {
      prevEntranceSigRef.current = "";
      return;
    }
    if (prevEntranceSigRef.current !== entranceSig) {
      prevEntranceSigRef.current = entranceSig;
      if (mode === "edit" || resolved.entrance?.trigger === "load") {
        const raf = window.requestAnimationFrame(() => {
          setEntered(true);
          setPlayKey((k) => k + 1);
        });
        return () => window.cancelAnimationFrame(raf);
      }
    }
  }, [hasEntrance, entranceSig, mode, resolved.entrance?.trigger]);

  // IntersectionObserver for viewport-triggered Entrance & Stagger
  useEffect(() => {
    if (!needsObserver) return;
    const el = hostRef.current;
    if (!el) return;

    const threshold = resolved.entrance?.threshold ?? 0.15;
    const once = resolved.entrance?.once !== false;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setEntered(true);
            if (once) observer.unobserve(el);
          } else if (!once) {
            setEntered(false);
          }
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    needsObserver,
    hasEntrance,
    hasStagger,
    isReduced,
    resolved.entrance?.trigger,
    resolved.entrance?.threshold,
    resolved.entrance?.once,
    resolved.stagger?.trigger,
    replayNonce,
  ]);

  // Zero-rerender Scroll Engine & Editor Simulated Scroll Progress Slider
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !hasScroll || !resolved.scroll) return;
    if (mode === "edit" && scrollProgressOverride !== null) {
      applyScrollProgressToElement(el, resolved.scroll, scrollProgressOverride / 100);
      return;
    }
    return subscribeScrollMotion(el, resolved.scroll);
  }, [hasScroll, resolved.scroll, mode, scrollProgressOverride]);

  // Stagger child delay injection (product cards, category cards, list items, container children)
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !hasStagger || !resolved.stagger || !isEntered) return;
    const targets = Array.from(
      el.querySelectorAll<HTMLElement>(
        '[data-builder-part="card"], [data-builder-part="item"]'
      )
    );
    const items = targets.length
      ? targets
      : Array.from(el.querySelectorAll<HTMLElement>(":scope > .bldr-container-inner > *"));
    if (!items.length) return;
    const total = items.length;
    const cols = viewport === "mobile" ? 1 : viewport === "tablet" ? 2 : 4;
    items.forEach((child, idx) => {
      const delayMs = computeStaggerDelayMs(idx, total, {
        initialDelay: resolved.stagger?.initialDelay,
        interval: resolved.stagger?.interval,
        maxDelay: resolved.stagger?.maxDelay,
        direction: resolved.stagger?.direction,
        order: resolved.stagger?.order,
        columns: cols,
      });
      child.style.animationDelay = `${delayMs}ms`;
    });
  }, [hasStagger, resolved.stagger, isEntered, viewport, playKey, replayNonce]);

  if (!anyActive) {
    return <>{children}</>;
  }

  const inlineVars: Record<string, string> = {};

  if (hasEntrance && resolved.entrance) {
    inlineVars["--m-ent-name"] = `m-${resolved.entrance.preset}`;
    inlineVars["--m-ent-dur"] = `${resolved.entrance.duration ?? normalizedGlobal.defaultDuration}ms`;
    inlineVars["--m-ent-delay"] = `${resolved.entrance.delay ?? 0}ms`;
    inlineVars["--m-ent-ease"] = resolveEasingCss(resolved.entrance.easing, normalizedGlobal);
    inlineVars["--m-ent-repeat"] = String(resolved.entrance.repeat ?? 1);
    inlineVars["--m-ent-dir"] = resolved.entrance.direction || "normal";
    if (resolved.entrance.distance !== undefined) {
      inlineVars["--m-dist"] = `${resolved.entrance.distance}px`;
    }
  }

  if (hasHover && resolved.hover) {
    Object.assign(inlineVars, resolveHoverVars(resolved.hover, normalizedGlobal));
  }

  if (hasInteraction && resolved.interaction) {
    inlineVars["--m-int-dur"] = `${resolved.interaction.duration ?? 160}ms`;
    inlineVars["--m-int-ease"] = resolveEasingCss(resolved.interaction.easing, normalizedGlobal);
    inlineVars["--m-int-scale"] = String(resolved.interaction.scale ?? 0.96);
    inlineVars["--m-int-rot"] = `${resolved.interaction.rotate ?? 180}deg`;
  }

  if (hasContinuous && resolved.continuous) {
    inlineVars["--m-cont-name"] = `m-cont-${resolved.continuous.preset}`;
    inlineVars["--m-cont-dur"] = `${resolved.continuous.duration ?? 2400}ms`;
    inlineVars["--m-cont-delay"] = `${resolved.continuous.delay ?? 0}ms`;
    inlineVars["--m-cont-ease"] = resolveEasingCss(resolved.continuous.easing, normalizedGlobal);
    inlineVars["--m-cont-repeat"] =
      resolved.continuous.infinite !== false
        ? "infinite"
        : String(resolved.continuous.repeat ?? 1);
    inlineVars["--m-cont-dir"] = resolved.continuous.direction || "normal";
  }

  if (hasScroll && resolved.scroll?.mode === "sticky") {
    inlineVars["--m-sticky-top"] = `${resolved.scroll.stickyOffset ?? 24}px`;
  }

  if (hasStagger && resolved.stagger) {
    inlineVars["--m-stg-name"] = `m-${resolved.stagger.preset || "fadeInUp"}`;
    inlineVars["--m-stg-dur"] = `${resolved.stagger.duration ?? 500}ms`;
    inlineVars["--m-stg-ease"] = resolveEasingCss(undefined, normalizedGlobal);
  }

  const hoverPreset = resolved.hover?.preset;
  const intPreset = resolved.interaction?.preset;
  const isInline = INLINE_NODE_TYPES.has(nodeType);

  const handleInteractionPointerDown = () => {
    if (!hasInteraction) return;
    setInteracted(true);
    window.setTimeout(() => setInteracted(false), (resolved.interaction?.duration ?? 180) + 40);
  };

  const handleInteractionClick = () => {
    if (!hasInteraction) return;
    if (intPreset === "iconRotate" || intPreset === "toggleTransition" || intPreset === "accordionExpand") {
      setToggled((prev) => !prev);
    }
  };

  return (
    <div
      ref={hostRef}
      key={hasEntrance ? `m-${playKey}` : undefined}
      data-motion-node={nodeId}
      data-motion-reduced={isReduced ? "true" : undefined}
      data-stagger-active={hasStagger && isEntered ? "true" : undefined}
      className={cn(
        "m-node",
        isInline && "m-inline",
        paused && "m-paused",
        hasEntrance && (isEntered ? "m-entrance-active" : "m-entrance-pending"),
        hasScroll && "m-has-scroll",
        hasScroll && resolved.scroll?.effect === "parallaxBackground" && "m-scroll-bg-parallax",
        hasScroll && resolved.scroll?.mode === "sticky" && "m-scroll-sticky",
        hasHover && "m-has-hover",
        hasHover && hoverPreset === "borderHighlight" && "m-hover-borderHighlight",
        hasHover && hoverPreset === "underlineReveal" && "m-hover-underlineReveal",
        hasInteraction && "m-has-interaction",
        hasInteraction &&
          (intPreset === "buttonPress" || intPreset === "clickScaleDown" || intPreset === "toggleTransition") &&
          "m-int-press",
        hasInteraction && intPreset === "iconRotate" && "m-int-rotate",
        hasInteraction && intPreset === "modalEntrance" && "m-int-modal",
        hasInteraction &&
          (resolved.interaction?.triggers?.includes("focus") || resolved.interaction?.trigger === "focus") &&
          "m-int-focus",
        interacted && "m-int-triggered",
        toggled && "m-int-toggled",
        hasContinuous && !hasEntrance && "m-has-continuous",
        hasContinuous && hasEntrance && isEntered && "m-has-continuous",
        hasContinuous && resolved.continuous?.pauseOnHover && "m-cont-pause-hover",
        hasStagger && "m-stagger-host"
      )}
      style={inlineVars as CSSProperties}
      onPointerDown={hasInteraction ? handleInteractionPointerDown : undefined}
      onClick={hasInteraction ? handleInteractionClick : undefined}
    >
      {children}
    </div>
  );
}
