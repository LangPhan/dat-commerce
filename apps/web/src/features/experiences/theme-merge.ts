import type { CSSProperties } from "react";
import type { ThemeHeaderConfig } from "@/types/api-cms-ai";
import type { ThemeOverrideConfig } from "./types";

export function matchesTargetPages(pathname: string, targetPages?: string[] | null): boolean {
  if (!targetPages || targetPages.length === 0) return true;
  const cleanPath = (pathname || "/").trim();
  for (const rawPattern of targetPages) {
    const pattern = (rawPattern || "").trim();
    if (!pattern) continue;
    if (pattern === "*" || pattern === "/*") return true;
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (cleanPath.startsWith(prefix)) return true;
    } else if (cleanPath.toLowerCase() === pattern.toLowerCase()) {
      return true;
    }
  }
  return false;
}

export function mergeExperienceThemeVars(
  baseVars: CSSProperties,
  override?: ThemeOverrideConfig | null
): CSSProperties {
  if (!override || !override.enabled) return baseVars;

  const merged: Record<string, string> = {
    ...(baseVars as Record<string, string>),
  };

  const c = override.colors || {};
  if (c.primary) {
    merged["--accent"] = c.primary;
    merged["--accent-text"] = c.primary;
    merged["--brand"] = c.primary;
    merged["--accent-hover"] = `color-mix(in srgb, ${c.primary} 84%, #000000)`;
    merged["--accent-soft"] = `color-mix(in srgb, ${c.primary} 14%, #ffffff)`;
  }
  if (c.accent) {
    merged["--store-accent"] = c.accent;
  }
  if (c.secondary) {
    merged["--store-secondary"] = c.secondary;
  }

  if (override.mode === "full_palette" || override.mode === "dark_luxe") {
    if (c.background) {
      merged["--bg"] = c.background;
      merged["--store-bg"] = c.background;
    }
    if (c.surface) {
      merged["--surface"] = c.surface;
      merged["--store-surface"] = c.surface;
      merged["--subtle"] = `color-mix(in srgb, ${c.surface} 86%, ${c.primary || "#ffffff"})`;
    }
    if (c.text) {
      merged["--text"] = c.text;
      merged["--store-text"] = c.text;
    }
    if (c.muted) {
      merged["--muted"] = c.muted;
      merged["--store-muted"] = c.muted;
    }
    if (c.border) {
      merged["--border"] = c.border;
      merged["--line"] = c.border;
      merged["--store-border"] = c.border;
    }
  } else if (override.surfaceTint) {
    merged["--subtle"] = override.surfaceTint;
  }

  if (override.ctaHighlight?.enabled && override.ctaHighlight.glowColor) {
    merged["--exp-cta-glow"] = override.ctaHighlight.glowColor;
  }

  return merged as CSSProperties;
}

export function mergeExperienceHeaderConfig(
  baseHeader?: ThemeHeaderConfig | null,
  override?: ThemeOverrideConfig | null
): ThemeHeaderConfig | undefined {
  if (!override || !override.enabled || !override.headerOverride) {
    return baseHeader ?? undefined;
  }
  const h = override.headerOverride;
  return {
    ...baseHeader,
    announcement: {
      ...baseHeader?.announcement,
      ...(h.announcementText ? { enabled: true, text: h.announcementText } : {}),
      ...(h.announcementBg ? { bgColor: h.announcementBg } : {}),
      ...(h.announcementTextColor ? { textColor: h.announcementTextColor } : {}),
    },
    layout: {
      ...baseHeader?.layout,
      ...(h.bgColor ? { bgColor: h.bgColor } : {}),
      ...(h.textColor ? { textColor: h.textColor } : {}),
      ...(h.borderColor ? { borderColor: h.borderColor } : {}),
    },
  };
}
