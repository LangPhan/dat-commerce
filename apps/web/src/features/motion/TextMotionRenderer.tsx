"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/format";
import { normalizeGlobalMotion, resolveEasingCss } from "./defaults";
import type { GlobalMotionSettings, NormalizedGlobalMotion, TextMotionConfig } from "./types";

function splitTokens(text: string, splitBy: "char" | "word" | "line"): string[] {
  if (!text) return [];
  if (splitBy === "line") {
    return text.split("\n");
  }
  if (splitBy === "char") {
    // Cap split chars at 120 to protect DOM performance on long paragraphs
    if (text.length > 120) {
      return text.split(/(\s+)/);
    }
    return Array.from(text);
  }
  return text.split(/(\s+)/);
}

function keyframeForTextPreset(preset: string): string {
  switch (preset) {
    case "textFadeIn":
      return "m-fadeIn";
    case "textSlideUp":
    case "staggerWord":
    case "staggerLine":
      return "m-fadeInUp";
    case "textSlideDown":
      return "m-fadeInDown";
    case "textBlurReveal":
      return "m-textBlurReveal";
    case "staggerChar":
    case "typingEffect":
      return "m-fadeIn";
    case "textReveal":
      return "m-textRevealClip";
    default:
      return "m-fadeInUp";
  }
}

export function TextMotionContent({
  text,
  config,
  globalMotion,
  replayNonce = 0,
}: {
  text: string;
  config?: TextMotionConfig | null;
  globalMotion?: GlobalMotionSettings | NormalizedGlobalMotion | null;
  replayNonce?: number;
}) {
  const prefersReduced = useReducedMotion();
  const normalizedGlobal = useMemo(() => normalizeGlobalMotion(globalMotion), [globalMotion]);
  const reduced =
    Boolean(prefersReduced) || normalizedGlobal.reducedMotionPolicy === "always-reduced";

  const active = Boolean(
    !reduced &&
      normalizedGlobal.enabled &&
      config && config.enabled !== false &&
      config.preset &&
      config.preset !== "none"
  );

  const hostRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState<boolean>(
    () => !active || config?.trigger === "load"
  );

  const needsTextObserver =
    active &&
    config?.trigger !== "load" &&
    typeof IntersectionObserver !== "undefined";
  const isVisible = !needsTextObserver || visible;

  useEffect(() => {
    if (!needsTextObserver) return;
    const el = hostRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [needsTextObserver, active, config?.trigger, replayNonce]);

  if (!active || !config) {
    return <>{text}</>;
  }

  const preset = config.preset!;
  const ease = resolveEasingCss(config.easing, normalizedGlobal);
  const dur = config.duration ?? 520;
  const baseDelay = config.delay ?? 0;

  if (preset === "gradientTextMove") {
    return (
      <span
        ref={hostRef}
        className="m-text-gradient"
        style={{ "--m-txt-dur": `${dur}ms` } as CSSProperties}
      >
        {text}
      </span>
    );
  }

  const isSplit =
    preset === "staggerChar" ||
    preset === "staggerWord" ||
    preset === "staggerLine" ||
    preset === "typingEffect";

  if (!isSplit) {
    return (
      <span
        ref={hostRef}
        key={`txt-${preset}-${dur}-${baseDelay}-${replayNonce}`}
        className={cn(isVisible ? "m-text-token" : "m-entrance-pending")}
        style={
          {
            "--m-txt-name": keyframeForTextPreset(preset),
            "--m-txt-dur": `${dur}ms`,
            "--m-txt-delay": `${baseDelay}ms`,
            "--m-txt-ease": ease,
          } as CSSProperties
        }
      >
        {text}
      </span>
    );
  }

  const splitBy: "char" | "word" | "line" =
    config.splitBy ||
    (preset === "staggerChar" || preset === "typingEffect"
      ? "char"
      : preset === "staggerLine"
        ? "line"
        : "word");

  const tokens = splitTokens(text, splitBy);
  const staggerMs =
    config.staggerMs ??
    (splitBy === "char" ? 30 : splitBy === "line" ? 110 : 70);
  const maxTotalDelay = 1200;

  return (
    <span
      ref={hostRef}
      key={`txtsplit-${preset}-${splitBy}-${staggerMs}-${dur}-${replayNonce}`}
      className={cn(preset === "typingEffect" && "m-text-typing-caret")}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {tokens.map((tok, i) => {
          if (splitBy === "line") {
            const delay = Math.min(baseDelay + i * staggerMs, baseDelay + maxTotalDelay);
            return (
              <span
                key={i}
                className={cn(isVisible ? "m-text-token" : "m-entrance-pending")}
                style={
                  {
                    display: "block",
                    "--m-txt-name": keyframeForTextPreset(preset),
                    "--m-txt-dur": `${dur}ms`,
                    "--m-txt-delay": `${delay}ms`,
                    "--m-txt-ease": ease,
                  } as CSSProperties
                }
              >
                {tok || "\u00A0"}
              </span>
            );
          }
          if (/^\s+$/.test(tok)) {
            return <span key={i}>{tok}</span>;
          }
          const delay = Math.min(baseDelay + i * staggerMs, baseDelay + maxTotalDelay);
          return (
            <span
              key={i}
              className={cn(isVisible ? "m-text-token" : "m-entrance-pending")}
              style={
                {
                  "--m-txt-name": keyframeForTextPreset(preset),
                  "--m-txt-dur": `${dur}ms`,
                  "--m-txt-delay": `${delay}ms`,
                  "--m-txt-ease": ease,
                } as CSSProperties
              }
            >
              {tok}
            </span>
          );
        })}
      </span>
    </span>
  );
}
