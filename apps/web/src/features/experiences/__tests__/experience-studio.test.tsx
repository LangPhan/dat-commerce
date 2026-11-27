import { beforeEach, describe, expect, it } from "vitest";
import { useExperienceStudioStore } from "../builder/experience-store";
import type { ExperienceDetailDto } from "../types";

const SAMPLE_DETAIL: ExperienceDetailDto = {
  id: "exp-100",
  slug: "winter-test",
  name: "Winter Test",
  description: "Test experience",
  category: "SEASON",
  presetKey: "winter-snowfall",
  status: "DRAFT",
  activationMode: "MANUAL",
  manualOverride: false,
  startsAt: null,
  endsAt: null,
  timezone: "UTC",
  recurrenceRule: "NONE",
  priority: 50,
  blendMode: "OVERRIDE",
  exclusiveGroups: ["weather_particles"],
  targetPages: ["*"],
  maxParticleBudget: 120,
  activeVersionId: null,
  latestVersionNumber: 1,
  version: 0,
  latestVersion: {
    id: "ver-1",
    versionNumber: 1,
    config: {
      schemaVersion: 1,
      themeOverride: { enabled: false, mode: "accent_tint" },
      motion: {
        respectReducedMotion: true,
        mobileDensityRatio: 0.5,
        pauseOnHiddenTab: true,
      },
      layers: [],
    },
    changeSummary: "Initial",
    createdAt: "2026-11-27T00:00:00Z",
  },
  activeVersion: null,
  versions: [],
  updatedAt: "2026-11-27T00:00:00Z",
};

describe("useExperienceStudioStore", () => {
  beforeEach(() => {
    useExperienceStudioStore.getState().loadExperience(SAMPLE_DETAIL);
  });

  it("supports adding, updating, reordering, duplicating, deleting layers and undo/redo", () => {
    const store = useExperienceStudioStore.getState();

    store.addLayer("snowfall");
    store.addLayer("countdown_bar", "hero_stage");

    const state = useExperienceStudioStore.getState();
    expect(state.config.layers).toHaveLength(2);
    expect(state.config.layers[1].zone).toBe("hero_stage");
    expect(state.dirty).toBe(true);

    const snowId = state.config.layers[0].id;
    store.updateLayerProps(snowId, { density: 140 });
    expect(useExperienceStudioStore.getState().config.layers[0].props.density).toBe(140);

    // Reorder layers
    store.reorderLayers(0, 1);
    expect(useExperienceStudioStore.getState().config.layers[0].type).toBe("countdown_bar");

    // Duplicate & remove
    store.duplicateLayer(snowId);
    expect(useExperienceStudioStore.getState().config.layers).toHaveLength(3);

    // Undo restores prior state
    store.undo();
    expect(useExperienceStudioStore.getState().config.layers).toHaveLength(2);

    // Redo brings duplicate back
    store.redo();
    expect(useExperienceStudioStore.getState().config.layers).toHaveLength(3);

    store.removeLayer(snowId);
    expect(useExperienceStudioStore.getState().config.layers).toHaveLength(2);
  });

  it("supports AI before/after preview, toggling view mode, applying, and discarding", () => {
    const store = useExperienceStudioStore.getState();
    store.addLayer("snowfall");
    const before = structuredClone(useExperienceStudioStore.getState().config);

    store.setAiPreview({
      beforeConfig: before,
      proposedConfig: {
        schemaVersion: 1,
        themeOverride: { enabled: true, mode: "dark_luxe", colors: { primary: "#EAB308" } },
        motion: before.motion,
        layers: [
          ...before.layers,
          {
            id: "ai-gold-1",
            type: "golden_particles",
            label: "AI Golden Particles",
            enabled: true,
            locked: false,
            zone: "viewport_overlay",
            zIndex: 25,
            opacity: 0.9,
            blendMode: "screen",
            visibility: { desktop: true, tablet: true, mobile: true },
            trigger: "immediate",
            props: { density: 70 },
          },
        ],
      },
      summary: "Add golden particles & dark luxe",
      explanation: "Applied dark luxe palette and gold embers.",
      operations: [{ type: "add_layer", targetId: "ai-gold-1", description: "Added gold" }],
    });

    expect(useExperienceStudioStore.getState().aiPreview?.viewMode).toBe("after");
    store.toggleAiPreviewMode("before");
    expect(useExperienceStudioStore.getState().aiPreview?.viewMode).toBe("before");

    store.applyAiPreview();
    const afterApply = useExperienceStudioStore.getState();
    expect(afterApply.aiPreview).toBeNull();
    expect(afterApply.config.layers).toHaveLength(2);
    expect(afterApply.config.themeOverride.mode).toBe("dark_luxe");

    // Undo reverts AI apply cleanly
    afterApply.undo();
    expect(useExperienceStudioStore.getState().config.layers).toHaveLength(1);
    expect(useExperienceStudioStore.getState().config.themeOverride.mode).toBe("accent_tint");
  });
});
