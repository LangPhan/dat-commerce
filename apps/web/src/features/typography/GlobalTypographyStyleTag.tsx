"use client";

import { useEffect, useMemo, useState } from "react";
import type { ViewportMode } from "@/features/builder/types";
import { compileGlobalTypographyCss } from "./css-generator";
import { normalizeGlobalTypography } from "./defaults";
import { buildGoogleFontsHref } from "./font-catalog";
import type {
  FontLoadingStatus,
  GlobalTypographyTokens,
  NormalizedGlobalTypography,
  TypographyFontRole,
} from "./types";

const GOOGLE_FONT_LINK_ID = "dat-global-typography-gfonts";

export function useGoogleFontLoader(
  typography: NormalizedGlobalTypography
): Record<TypographyFontRole, FontLoadingStatus> {
  const [statuses, setStatuses] = useState<Record<TypographyFontRole, FontLoadingStatus>>({
    primary: "idle",
    secondary: "idle",
    heading: "idle",
    body: "idle",
    monospace: "idle",
  });

  const href = useMemo(
    () => buildGoogleFontsHref(Object.values(typography.fonts)),
    [typography.fonts]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    let linkEl = document.getElementById(GOOGLE_FONT_LINK_ID) as HTMLLinkElement | null;
    if (href) {
      if (!linkEl) {
        linkEl = document.createElement("link");
        linkEl.id = GOOGLE_FONT_LINK_ID;
        linkEl.rel = "stylesheet";
        document.head.appendChild(linkEl);
      }
      if (linkEl.href !== href) {
        linkEl.href = href;
      }
    } else if (linkEl) {
      linkEl.remove();
    }
  }, [href]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;

    const computeStatuses = () => {
      if (cancelled) return;
      const next = {} as Record<TypographyFontRole, FontLoadingStatus>;
      const fontSet = "fonts" in document ? document.fonts : null;

      for (const role of [
        "primary",
        "secondary",
        "heading",
        "body",
        "monospace",
      ] as TypographyFontRole[]) {
        const cfg = typography.fonts[role];
        if (cfg.source === "system") {
          next[role] = "loaded";
          continue;
        }
        if (!fontSet || typeof fontSet.check !== "function") {
          next[role] = "loaded";
          continue;
        }
        try {
          const checkStr = `${cfg.style === "italic" ? "italic " : ""}${
            cfg.weights?.[0] || 400
          } 16px "${cfg.family}"`;
          const alreadyLoaded = fontSet.check(checkStr);
          next[role] = alreadyLoaded ? "loaded" : "loading";
        } catch {
          next[role] = "idle";
        }
      }
      setStatuses(next);
    };

    computeStatuses();

    const fontSet = "fonts" in document ? document.fonts : null;
    if (fontSet && typeof fontSet.ready?.then === "function") {
      fontSet.ready.then(() => {
        if (cancelled) return;
        setStatuses((prev) => {
          const updated = { ...prev };
          for (const role of Object.keys(updated) as TypographyFontRole[]) {
            if (updated[role] === "loading") {
              updated[role] = "loaded";
            }
          }
          return updated;
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [typography.fonts]);

  return statuses;
}

export function GlobalTypographyStyleTag({
  typography,
  scopeId = "global",
  scopeSelector = ":root, .store.public-store",
  forceViewport,
}: {
  typography?: GlobalTypographyTokens | NormalizedGlobalTypography | null;
  scopeId?: string;
  scopeSelector?: string;
  forceViewport?: ViewportMode;
}) {
  const normalized = useMemo(
    () => normalizeGlobalTypography(typography),
    [typography]
  );

  useGoogleFontLoader(normalized);

  const css = useMemo(
    () =>
      compileGlobalTypographyCss(normalized, {
        scopeSelector,
        forceViewport,
      }),
    [normalized, scopeSelector, forceViewport]
  );

  return <style data-global-typography={scopeId}>{css}</style>;
}
