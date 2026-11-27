import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";
import {
  createLayerFromCatalog,
  EFFECT_CATALOG,
} from "../catalog";
import {
  createEmptyExperienceConfig,
  experienceLayerSchema,
  normalizeExperienceConfig,
  seasonalExperienceConfigSchema,
} from "../schema";
import {
  matchesTargetPages,
  mergeExperienceHeaderConfig,
  mergeExperienceThemeVars,
} from "../theme-merge";

describe("experiences schema, catalog & theme merge", () => {
  it("contains all 14 distinct effect types in the catalog with valid schema", () => {
    expect(EFFECT_CATALOG).toHaveLength(14);
    const types = new Set(EFFECT_CATALOG.map((e) => e.type));
    expect(types.size).toBe(14);

    for (const item of EFFECT_CATALOG) {
      const layer = createLayerFromCatalog(item.type);
      expect(() => experienceLayerSchema.parse(layer)).not.toThrow();
    }
  });

  it("rejects dangerous XSS/script payloads inside layer props", () => {
    const cfg = createEmptyExperienceConfig();
    const banner = createLayerFromCatalog("promo_banner");
    banner.props.headline = "<script>alert('xss')</script>";
    cfg.layers.push(banner);

    const parsed = seasonalExperienceConfigSchema.safeParse(cfg);
    expect(parsed.success).toBe(false);
  });

  it("merges non-destructive dark_luxe theme vars and header overrides", () => {
    const baseVars = {
      "--bg": "#FFFFFF",
      "--surface": "#F8FAFC",
      "--text": "#111318",
      "--accent": "#5B46E8",
      "--store-bg": "#FFFFFF",
    } as CSSProperties;

    const merged = mergeExperienceThemeVars(baseVars, {
      enabled: true,
      mode: "dark_luxe",
      colors: {
        primary: "#EAB308",
        background: "#0B0C10",
        surface: "#14161D",
        text: "#F8FAFC",
      },
      ctaHighlight: {
        enabled: true,
        glowColor: "#FACC15",
        shimmer: true,
      },
    }) as Record<string, string>;

    expect(merged["--bg"]).toBe("#0B0C10");
    expect(merged["--store-bg"]).toBe("#0B0C10");
    expect(merged["--store-surface"]).toBe("#14161D");
    expect(merged["--store-text"]).toBe("#F8FAFC");
    expect(merged["--accent"]).toBe("#EAB308");
    expect(merged["--exp-cta-glow"]).toBe("#FACC15");

    // Disabled override leaves base intact
    expect(mergeExperienceThemeVars(baseVars, { enabled: false, mode: "dark_luxe" })).toBe(
      baseVars
    );

    const header = mergeExperienceHeaderConfig(
      { announcement: { enabled: true, text: "Default", bgColor: "#111111" } },
      {
        enabled: true,
        mode: "accent_tint",
        headerOverride: {
          announcementText: "Black Friday VIP",
          announcementBg: "#000000",
        },
      }
    );
    expect(header?.announcement?.text).toBe("Black Friday VIP");
    expect(header?.announcement?.bgColor).toBe("#000000");
  });

  it("matches target page patterns accurately", () => {
    expect(matchesTargetPages("/store/shop", ["*"])).toBe(true);
    expect(matchesTargetPages("/store/shop", ["/store/shop"])).toBe(true);
    expect(matchesTargetPages("/store/product/ridge-runner", ["/store/product/*"])).toBe(true);
    expect(matchesTargetPages("/store/cart", ["/store/product/*"])).toBe(false);
  });

  it("normalizes partial configs safely", () => {
    const normalized = normalizeExperienceConfig({
      themeOverride: { enabled: true, mode: "accent_tint" },
    });
    expect(normalized.schemaVersion).toBe(1);
    expect(normalized.layers).toEqual([]);
    expect(normalized.motion.respectReducedMotion).toBe(true);
  });
});
