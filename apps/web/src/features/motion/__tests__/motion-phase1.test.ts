import { describe, expect, it } from "vitest";
import { createElementNode } from "@/features/builder/registry/definitions";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { themeTokensToCssVars } from "@/lib/cms-schema";
import { DEFAULT_GLOBAL_MOTION, normalizeGlobalMotion, resolveEasingCss } from "../defaults";
import { SYSTEM_ANIMATION_PRESETS, getPresetsByCategory } from "../presets";
import { computeStaggerDelayMs, resolveElementMotionForViewport } from "../resolve";
import { elementMotionSchema } from "../schema";
import type { AnimationPresetDefinition, ElementMotionConfig } from "../types";

describe("Phase 1: Motion data model, presets, responsive inheritance & store Undo/Redo", () => {
  it("provides curated presets across all categories without duplicate keys", () => {
    const keys = SYSTEM_ANIMATION_PRESETS.map((p) => p.presetKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getPresetsByCategory("entrance").length).toBeGreaterThanOrEqual(25);
    expect(getPresetsByCategory("scroll").length).toBeGreaterThanOrEqual(16);
    expect(getPresetsByCategory("hover").length).toBeGreaterThanOrEqual(14);
    expect(getPresetsByCategory("interaction").length).toBeGreaterThanOrEqual(6);
    expect(getPresetsByCategory("continuous").length).toBeGreaterThanOrEqual(10);
    expect(getPresetsByCategory("text").length).toBeGreaterThanOrEqual(10);
  });

  it("validates schemas and rejects invalid bounds or unsafe easing", () => {
    expect(
      elementMotionSchema.safeParse({
        enabled: true,
        entrance: { enabled: true, preset: "fadeInUp", duration: 600, easing: "easeOut" },
      }).success
    ).toBe(true);

    expect(
      elementMotionSchema.safeParse({
        entrance: { duration: 99999 },
      }).success
    ).toBe(false);

    expect(
      elementMotionSchema.safeParse({
        entrance: { easing: "javascript:alert(1)" },
      }).success
    ).toBe(false);
  });

  it("resolves preset references with local overrides and Desktop -> Tablet -> Mobile cascading", () => {
    const customPreset: AnimationPresetDefinition = {
      id: "custom-1",
      presetKey: "brand-hero-rise",
      name: "Brand Hero Rise",
      category: "entrance",
      description: "Custom hero preset",
      defaultDuration: 650,
      defaultEasing: "custom",
      isSystem: false,
      config: {
        enabled: true,
        entrance: { enabled: true, preset: "fadeInUp", duration: 650, delay: 50, easing: "custom" },
        scroll: { enabled: true, mode: "parallax", effect: "parallaxVertical", speed: 30 },
      },
    };

    const motion: ElementMotionConfig = {
      enabled: true,
      presetRef: "brand-hero-rise",
      entrance: { delay: 120 }, // local override on top of presetRef
      responsive: {
        tablet: { entrance: { duration: 420 } },
        mobile: { scroll: { enabled: false }, entrance: { preset: "fadeIn", duration: 300 } },
      },
    };

    const desktop = resolveElementMotionForViewport(motion, "desktop", [customPreset], DEFAULT_GLOBAL_MOTION);
    expect(desktop.entrance?.preset).toBe("fadeInUp");
    expect(desktop.entrance?.duration).toBe(650);
    expect(desktop.entrance?.delay).toBe(120); // local override preserved!
    expect(desktop.scroll?.enabled).toBe(true);

    const tablet = resolveElementMotionForViewport(motion, "tablet", [customPreset], DEFAULT_GLOBAL_MOTION);
    expect(tablet.hasCustomOverride).toBe(true);
    expect(tablet.entrance?.duration).toBe(420);
    expect(tablet.entrance?.delay).toBe(120); // inherited from desktop

    const mobile = resolveElementMotionForViewport(motion, "mobile", [customPreset], DEFAULT_GLOBAL_MOTION);
    expect(mobile.entrance?.preset).toBe("fadeIn");
    expect(mobile.entrance?.duration).toBe(300);
    expect(mobile.scroll?.enabled).toBe(false);
  });

  it("caps stagger delays on large collections and emits CSS motion tokens", () => {
    expect(computeStaggerDelayMs(0, 20, { initialDelay: 50, interval: 100, maxDelay: 500 })).toBe(50);
    expect(computeStaggerDelayMs(3, 20, { initialDelay: 50, interval: 100, maxDelay: 500 })).toBe(350);
    expect(computeStaggerDelayMs(19, 20, { initialDelay: 50, interval: 100, maxDelay: 500 })).toBe(550);

    const gm = normalizeGlobalMotion({ timingTokens: { fast: 120, normal: 280, slow: 640 } });
    expect(resolveEasingCss("custom", gm)).toContain("cubic-bezier");

    const vars = themeTokensToCssVars({
      version: 1,
      colors: { primary: "#5B46E8", background: "#FFFFFF", text: "#111318" },
      typography: { headingFont: "Georgia", bodyFont: "Inter" },
      radius: { card: "10px", button: "8px" },
      container: { maxWidth: "1280px" },
      motion: gm,
    }) as Record<string, string>;
    expect(vars["--motion-fast"]).toBe("120ms");
    expect(vars["--motion-slow"]).toBe("640ms");
  });

  it("applies motion operations and multi-select batch updates with full Undo/Redo in Zustand", () => {
    const h1 = createElementNode("heading");
    h1.id = "m-h1";
    const btn = createElementNode("button");
    btn.id = "m-btn";

    const store = useEditorStore.getState();
    store.loadPage({ pageId: "p1", pageSlug: "home", pageTitle: "Home", nodes: [h1, btn] });
    store.selectNode("m-h1");
    store.selectNode("m-btn", { additive: true });

    store.applyMotionToSelected({
      enabled: true,
      hover: { enabled: true, preset: "scaleUp", scale: 1.04, duration: 220 },
    });

    expect(useEditorStore.getState().nodes[0].motion?.hover?.preset).toBe("scaleUp");
    expect(useEditorStore.getState().nodes[1].motion?.hover?.preset).toBe("scaleUp");

    store.updateNodeResponsiveMotion("m-h1", "mobile", { enabled: false });
    expect(useEditorStore.getState().nodes[0].motion?.responsive?.mobile?.enabled).toBe(false);
    // Desktop remains untouched
    expect(useEditorStore.getState().nodes[0].motion?.hover?.preset).toBe("scaleUp");

    // Undo responsive edit -> restores mobile undefined
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes[0].motion?.responsive?.mobile).toBeUndefined();

    // Undo batch hover apply -> restores clean nodes
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes[0].motion).toBeUndefined();
    expect(useEditorStore.getState().nodes[1].motion).toBeUndefined();

    // Redo restores both
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().nodes[1].motion?.hover?.scale).toBe(1.04);
  });
});
