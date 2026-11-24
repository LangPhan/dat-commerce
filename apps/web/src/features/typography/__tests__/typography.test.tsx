import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageRenderer } from "@/features/builder/renderer/PageRenderer";
import { createElementNode } from "@/features/builder/registry/definitions";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { themeTokensSchema } from "@/lib/cms-schema";
import type { ThemeTokens } from "@/types/api-cms-ai";
import { evaluatePresetAccessibility, getContrastRatio } from "../accessibility";
import { applyTypographyOperations, partitionAiOperations } from "../ai-operations";
import { compileGlobalTypographyCss } from "../css-generator";
import {
  createCustomPreset,
  normalizeGlobalTypography,
  resetAllTypography,
  resetSinglePreset,
} from "../defaults";
import { buildGoogleFontsHref, searchFontCatalog } from "../font-catalog";
import {
  resetResponsiveMetricViewport,
  resolveElementTypographyState,
  resolveResponsiveMetric,
  updateResponsiveMetricValue,
} from "../resolve";

const BASE_THEME: ThemeTokens = {
  version: 1,
  colors: {
    primary: "#5B46E8",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    text: "#111318",
    muted: "#5C6270",
    accent: "#18794E",
    border: "#E5E7EB",
  },
  typography: {
    headingFont: "Georgia",
    bodyFont: "Inter",
  },
  radius: { card: "10px", button: "8px" },
  container: { maxWidth: "1280px" },
};

describe("Global Typography System", () => {
  it("normalizes legacy theme typography into 5 font roles and 14 built-in presets", () => {
    const norm = normalizeGlobalTypography({
      headingFont: "Playfair Display",
      bodyFont: "DM Sans",
    });

    expect(norm.fonts.heading.family).toBe("Playfair Display");
    expect(norm.fonts.body.family).toBe("DM Sans");
    expect(norm.fonts.primary.family).toBe("DM Sans");
    expect(norm.fonts.monospace.family).toBe("JetBrains Mono");

    for (const id of [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "body_large",
      "body",
      "body_small",
      "caption",
      "overline",
      "link",
      "button",
      "label",
    ]) {
      expect(norm.presets[id]).toBeDefined();
    }
    expect(norm.presets.h1.fontSize).toEqual({
      desktop: "48px",
      tablet: "38px",
      mobile: "30px",
    });
  });

  it("handles responsive inheritance and preserves desktop when editing mobile", () => {
    const h4 = normalizeGlobalTypography().presets.h4;
    expect(resolveResponsiveMetric(h4.lineHeight, "desktop")).toEqual({
      value: 1.35,
      inheritedFrom: null,
      isCustomized: false,
    });
    expect(resolveResponsiveMetric(h4.lineHeight, "mobile")).toEqual({
      value: 1.35,
      inheritedFrom: "desktop",
      isCustomized: false,
    });

    const editedMobile = updateResponsiveMetricValue(
      h4.fontSize,
      "mobile",
      "19px",
      "22px"
    );
    expect(editedMobile.desktop).toBe("22px");
    expect(editedMobile.mobile).toBe("19px");
    expect(resolveResponsiveMetric(editedMobile, "mobile").isCustomized).toBe(true);

    const resetBack = resetResponsiveMetricViewport(editedMobile, "mobile", "22px");
    expect(resetBack.mobile).toBeUndefined();
    expect(resolveResponsiveMetric(resetBack, "mobile").inheritedFrom).toBe("tablet");
  });

  it("generates CSS custom properties, @media queries, clamp(), and @font-face", () => {
    const typo = normalizeGlobalTypography();
    typo.fonts.secondary = {
      family: "TerrainCustom",
      source: "custom",
      weights: [400, 700],
      style: "normal",
      fallback: "sans-serif",
      url: "/storage/dat-commerce/stores/1/fonts/terrain.woff2",
      format: "woff2",
    };
    typo.presets.h2.useFluid = true;
    typo.presets.h2.fluidSize = "clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)";

    const liveCss = compileGlobalTypographyCss(typo);
    expect(liveCss).toContain('@font-face');
    expect(liveCss).toContain('font-family: "TerrainCustom"');
    expect(liveCss).toContain("--font-heading: Georgia");
    expect(liveCss).toContain("--text-h1-size: 48px;");
    expect(liveCss).toContain("--text-h2-size: clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem);");
    expect(liveCss).toContain("@media (max-width: 1024px)");
    expect(liveCss).toContain("@media (max-width: 767px)");
    expect(liveCss).toContain('[data-typography-preset="h1"]');

    const mobileForcedCss = compileGlobalTypographyCss(typo, {
      scopeSelector: ".ed-store-surface",
      forceViewport: "mobile",
    });
    expect(mobileForcedCss).not.toContain("@media");
    expect(mobileForcedCss).toContain("--text-h1-size: 30px;");
  });

  it("supports searchable font catalog & Google Fonts href builder", () => {
    const serifMatches = searchFontCatalog("playfair", "google");
    expect(serifMatches.some((f) => f.family === "Playfair Display")).toBe(true);

    const url = buildGoogleFontsHref(Object.values(normalizeGlobalTypography().fonts));
    expect(url).toContain("https://fonts.googleapis.com/css2?");
    expect(url).toContain("family=Inter:wght@");
    expect(url).toContain("display=swap");
  });

  it("supports custom preset creation, reset single preset, and schema validation", () => {
    const typo = normalizeGlobalTypography();
    const custom = createCustomPreset("Editorial Quote", typo.presets.h3, typo.presets);
    expect(custom.id).toBe("editorial_quote");
    expect(custom.builtIn).toBe(false);
    expect(custom.category).toBe("custom");

    typo.presets[custom.id] = custom;
    typo.presets.h1 = { ...typo.presets.h1, fontWeight: 500 };

    const check = themeTokensSchema.safeParse({ ...BASE_THEME, typography: typo });
    expect(check.success).toBe(true);

    const resetH1 = resetSinglePreset(typo, "h1");
    expect(resetH1.presets.h1.fontWeight).toBe(700);
    expect(resetH1.presets.editorial_quote).toBeDefined();

    const fullReset = resetAllTypography();
    expect(fullReset.presets.editorial_quote).toBeUndefined();
  });

  it("decouples semantic HTML tags from typography presets and preserves local overrides", () => {
    const headingNode = createElementNode("heading");
    headingNode.id = "h-semantic-decoupled";
    headingNode.props = { text: "Editorial Title", tag: "h2", typographyPreset: "h1" };
    headingNode.styles = { base: {} };

    const overriddenNode = createElementNode("heading");
    overriddenNode.id = "h-local-override";
    overriddenNode.props = { text: "Custom Accent Heading", tag: "h3" };
    overriddenNode.styles = { base: { fontSize: "24px", color: "#18794E" } };

    const typo = normalizeGlobalTypography({ headingFont: "Playfair Display", bodyFont: "Inter" });

    const { container } = render(
      <PageRenderer
        mode="live"
        nodes={[headingNode, overriddenNode]}
        typography={typo}
      />
    );

    const h2 = container.querySelector('[data-builder-node="h-semantic-decoupled"]');
    expect(h2?.tagName).toBe("H2");
    expect(h2?.getAttribute("data-typography-preset")).toBe("h1");

    const h3 = container.querySelector('[data-builder-node="h-local-override"]');
    expect(h3?.tagName).toBe("H3");
    expect(h3?.getAttribute("data-typography-preset")).toBe("h3");

    const stateInherited = resolveElementTypographyState(headingNode, typo, "desktop");
    expect(stateInherited.preset?.id).toBe("h1");
    expect(stateInherited.localOverriddenKeys).toHaveLength(0);
    expect(stateInherited.effective.fontFamily).toBe("Playfair Display");
    expect(stateInherited.effective.fontSize).toBe("48px");

    const stateOverridden = resolveElementTypographyState(overriddenNode, typo, "desktop");
    expect(stateOverridden.localOverrideSet.has("fontSize")).toBe(true);
    expect(stateOverridden.effective.fontSize).toBe("24px");
  });

  it("executes AI typography operations cleanly with reversible undo/redo preview history", () => {
    const store = useEditorStore.getState();
    store.loadPage({
      pageId: "p-typo",
      pageSlug: "home",
      pageTitle: "Home",
      nodes: [{ ...createElementNode("heading"), id: "h-main" }],
    });
    store.setThemeTokens(BASE_THEME, false);

    const { typographyOps } = partitionAiOperations([
      {
        type: "update_typography_font",
        role: "heading",
        family: "Playfair Display",
      },
      {
        type: "update_typography_preset",
        target: "h1",
        property: "fontSize",
        responsiveValues: { desktop: "42px", tablet: "34px", mobile: "28px" },
      },
      {
        type: "update_typography_preset",
        target: "h2",
        property: "fontWeight",
        value: 600,
      },
    ]);

    const result = applyTypographyOperations(BASE_THEME, typographyOps);
    expect(result.nextTokens.typography.headingFont).toBe("Playfair Display");
    expect(result.affectedPresets).toContain("h1");
    expect(result.affectedPresets).toContain("h2");
    expect(result.affectedPresets).not.toContain("body");

    useEditorStore.getState().startAiPreview({
      prompt: "Use Playfair Display and shrink headings",
      summary: "Refine global heading typography",
      explanation: "",
      model: "gpt-6-luna",
      scope: "typography",
      targetNodeIds: [],
      operations: [],
      typographyOperations: typographyOps,
      diffs: [],
      previewNodes: useEditorStore.getState().nodes,
      beforeNodes: useEditorStore.getState().nodes,
      beforeThemeTokens: BASE_THEME,
      previewThemeTokens: result.nextTokens,
      affectedPresets: result.affectedPresets,
      viewMode: "after",
    });

    useEditorStore.getState().applyAiPreview();
    expect(useEditorStore.getState().themeTokens?.typography.headingFont).toBe(
      "Playfair Display"
    );
    expect(useEditorStore.getState().themeDirty).toBe(true);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().themeTokens?.typography.headingFont).toBe(
      "Georgia"
    );

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().themeTokens?.typography.headingFont).toBe(
      "Playfair Display"
    );
  });

  it("emits non-blocking accessibility warnings for low contrast and tiny body text", () => {
    expect(getContrastRatio("#111318", "#FFFFFF")).toBeGreaterThan(15);
    const typo = normalizeGlobalTypography();
    const badBody = {
      ...typo.presets.body,
      fontSize: "11px",
      lineHeight: 1.1,
      color: "#E5E7EB",
    };
    const warnings = evaluatePresetAccessibility(badBody, typo, {
      background: "#FFFFFF",
      text: "#111318",
    });
    expect(warnings.some((w) => w.field === "fontSize")).toBe(true);
    expect(warnings.some((w) => w.field === "lineHeight")).toBe(true);
    expect(warnings.some((w) => w.field === "color")).toBe(true);
  });
});
