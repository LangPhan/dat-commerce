import { describe, expect, it } from "vitest";
import { applyOperations, computeNodeDiffs, normalizeApiOperations } from "@/features/builder/operations";
import { createElementNode } from "@/features/builder/registry/definitions";
import { useEditorStore } from "@/features/builder/store/editor-store";
import type { ThemeTokens } from "@/types/api-cms-ai";
import {
  analyzeAiMotionConfirmation,
  applyGlobalMotionAiOperations,
  partitionAllEditorAiOperations,
} from "../ai-operations";
import { DEFAULT_GLOBAL_MOTION } from "../defaults";

const BASE_TOKENS: ThemeTokens = {
  version: 1,
  colors: {
    primary: "#5B46E8",
    background: "#FFFFFF",
    text: "#111318",
  },
  typography: { headingFont: "Georgia", bodyFont: "Inter" },
  radius: { card: "10px", button: "8px" },
  container: { maxWidth: "1280px" },
  motion: { ...DEFAULT_GLOBAL_MOTION },
};

describe("Phase 5 — AI Motion Operations, Confirmation Gates & Preview/Undo", () => {
  it("partitions node motion, typography, global motion, and preset creation ops cleanly", () => {
    const rawOps = [
      {
        type: "set_element_animation",
        nodeId: "h1-1",
        motion: {
          enabled: true,
          entrance: { enabled: true, preset: "fadeInUp", duration: 600 },
        },
      },
      {
        type: "update_typography_font",
        role: "heading",
        family: "Playfair Display",
      },
      {
        type: "update_global_motion",
        motion: { mobileBehavior: "disabled", defaultDuration: 420 },
      },
      {
        type: "create_animation_preset",
        name: "Editorial Rise",
        category: "entrance",
        description: "Reusable hero entrance",
        config: {
          enabled: true,
          entrance: { enabled: true, preset: "fadeInUp", duration: 600 },
        },
      },
    ];

    const part = partitionAllEditorAiOperations(rawOps);
    expect(part.nodeOps).toHaveLength(1);
    expect(part.typographyOps).toHaveLength(1);
    expect(part.globalMotionOps).toHaveLength(1);
    expect(part.presetCreateOps).toHaveLength(1);

    const gmApplied = applyGlobalMotionAiOperations(BASE_TOKENS, part.globalMotionOps);
    expect(gmApplied.nextTokens.motion?.mobileBehavior).toBe("disabled");
    expect(gmApplied.nextTokens.motion?.defaultDuration).toBe(420);
    expect(gmApplied.diffs.some((d) => d.field === "Mobile Behavior" && d.after === "disabled")).toBe(true);
    expect(gmApplied.diffs.some((d) => d.field === "Default Duration" && d.after === "420")).toBe(true);
  });

  it("enforces explicit confirmation for bulk (>=3 elements) or destructive motion ops", () => {
    const single = analyzeAiMotionConfirmation(
      [
        {
          type: "set_element_animation",
          nodeId: "n1",
          animation: { enabled: true, entrance: { enabled: true, preset: "fadeInUp" } },
        },
      ],
      []
    );
    expect(single.required).toBe(false);
    expect(single.animatedNodeIds).toEqual(["n1"]);

    const bulk = analyzeAiMotionConfirmation(
      [
        {
          type: "apply_animation_to_selection",
          nodeIds: ["n1", "n2", "n3"],
          animation: { enabled: true, hover: { enabled: true, preset: "moveUp" } },
        },
      ],
      []
    );
    expect(bulk.required).toBe(true);
    expect(bulk.reasons[0]).toContain("3 elements");

    const destructiveRemove = analyzeAiMotionConfirmation(
      [{ type: "remove_element_animation", nodeId: "n1" }],
      []
    );
    expect(destructiveRemove.required).toBe(true);

    const destructiveGlobalDisable = analyzeAiMotionConfirmation([], [
      { type: "update_global_motion", motion: { enabled: false } },
    ]);
    expect(destructiveGlobalDisable.required).toBe(true);
  });

  it("supports live AI motion preview -> Apply -> Undo without corrupting page state", () => {
    const heading = createElementNode("heading");
    heading.id = "hero-h1";
    heading.label = "Hero Heading";

    const store = useEditorStore.getState();
    store.loadPage({
      pageId: "p-ai",
      pageSlug: "home",
      pageTitle: "Home",
      seoTitle: "",
      seoDescription: "",
      pageVersion: 1,
      publishedVersionId: null,
      latestVersionNumber: 1,
      status: "DRAFT",
      nodes: [heading],
    });
    store.setThemeTokens(BASE_TOKENS, false);

    const normalizedOps = normalizeApiOperations([
      {
        type: "set_element_animation",
        nodeId: "hero-h1",
        motion: {
          enabled: true,
          entrance: { enabled: true, preset: "fadeInUp", duration: 600, easing: "easeOut" },
        },
      },
    ]);
    const previewNodes = applyOperations(useEditorStore.getState().nodes, normalizedOps);
    const diffs = computeNodeDiffs(useEditorStore.getState().nodes, previewNodes);
    expect(diffs.length).toBeGreaterThan(0);

    useEditorStore.getState().startAiPreview({
      prompt: "Fade in heading from bottom over 600ms",
      summary: "Apply fadeInUp entrance (600ms)",
      explanation: "Configured fadeInUp entrance on Hero Heading.",
      model: "gpt-6-luna",
      scope: "element",
      targetNodeIds: ["hero-h1"],
      operations: normalizedOps,
      diffs,
      previewNodes,
      beforeNodes: useEditorStore.getState().nodes,
      animatedNodeIds: ["hero-h1"],
      viewMode: "after",
    });

    // Before apply, persisted draft nodes remain untouched
    expect(useEditorStore.getState().nodes[0].motion).toBeUndefined();
    expect(useEditorStore.getState().aiPreview?.previewNodes[0].motion?.entrance?.preset).toBe("fadeInUp");

    // Apply commits into nodes & history
    useEditorStore.getState().applyAiPreview();
    expect(useEditorStore.getState().aiPreview).toBeNull();
    expect(useEditorStore.getState().nodes[0].motion?.entrance?.preset).toBe("fadeInUp");
    expect(useEditorStore.getState().nodes[0].motion?.entrance?.duration).toBe(600);

    // Undo reverts cleanly
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes[0].motion).toBeUndefined();
  });
});
