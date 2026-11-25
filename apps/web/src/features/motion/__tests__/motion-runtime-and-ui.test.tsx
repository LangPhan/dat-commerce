import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/builder/registry/definitions";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { MotionInspectorTab } from "@/features/editor/MotionInspectorTab";
import { DEFAULT_GLOBAL_MOTION } from "../defaults";
import { MotionWrapper } from "../MotionWrapper";
import { computeScrollVariables } from "../scroll-engine";
import { TextMotionContent } from "../TextMotionRenderer";

describe("Phase 2 & 3 — Motion Runtime, Scroll Engine & Inspector UI", () => {
  beforeEach(() => {
    const heading = createElementNode("heading");
    heading.id = "node_heading_1";
    heading.label = "Hero Heading";
    useEditorStore.getState().loadPage({
      pageId: "page-1",
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
    useEditorStore.getState().selectNode(heading.id);
  });

  it("computes scroll CSS variables accurately for linked, parallax, and sticky modes", () => {
    const opacityVars = computeScrollVariables(
      { mode: "linked", effect: "opacity", min: 0.2, max: 1, direction: "normal" },
      0.5
    );
    expect(Number(opacityVars["--m-sc-op"])).toBeCloseTo(0.6, 2);

    const parallaxVars = computeScrollVariables(
      { mode: "parallax", effect: "parallaxVertical", speed: 40, direction: "up" },
      1
    );
    expect(parallaxVars["--m-sc-ty"]).toBe("-40.0px");

    const stickyVars = computeScrollVariables(
      { mode: "sticky", effect: "stickyScale", min: 1, max: 0.9 },
      0.5
    );
    expect(Number(stickyVars["--m-sc-scale"])).toBeCloseTo(0.95, 2);
  });

  it("renders MotionWrapper with entrance vars, edit scroll scrub, and reduced motion guard", () => {
    const { container, rerender } = render(
      <MotionWrapper
        nodeId="node_heading_1"
        nodeType="heading"
        motion={{
          enabled: true,
          entrance: { preset: "fadeInUp", duration: 600, trigger: "load" },
          scroll: { mode: "linked", effect: "scale", min: 0.9, max: 1.1 },
        }}
        viewport="desktop"
        mode="edit"
        globalMotion={DEFAULT_GLOBAL_MOTION}
        scrollProgressOverride={50}
      >
        <div data-testid="inner">Animated Card</div>
      </MotionWrapper>
    );

    const host = container.querySelector(".m-node") as HTMLElement | null;
    expect(host).not.toBeNull();
    expect(host?.style.getPropertyValue("--m-ent-name")).toBe("m-fadeInUp");
    expect(Number(host?.style.getPropertyValue("--m-sc-scale"))).toBeCloseTo(1, 2);

    // Reduced motion policy always-reduced suppresses entrance animation
    rerender(
      <MotionWrapper
        nodeId="node_heading_1"
        nodeType="heading"
        motion={{
          enabled: true,
          entrance: { preset: "fadeInUp", duration: 600, trigger: "load" },
        }}
        viewport="desktop"
        mode="live"
        globalMotion={{ ...DEFAULT_GLOBAL_MOTION, reducedMotionPolicy: "always-reduced" }}
      >
        <div data-testid="inner">Animated Card</div>
      </MotionWrapper>
    );
    expect(container.querySelector(".m-entrance-active")).toBeNull();
    expect(screen.getByTestId("inner").textContent).toBe("Animated Card");
  });

  it("preserves accessible semantic DOM in TextMotionContent and degrades under reduced motion", () => {
    const { container, rerender } = render(
      <h1>
        <TextMotionContent
          text="Build Faster Today"
          config={{ enabled: true, preset: "staggerWord", trigger: "load", staggerMs: 40 }}
          globalMotion={DEFAULT_GLOBAL_MOTION}
        />
      </h1>
    );

    const sr = container.querySelector(".sr-only");
    expect(sr?.textContent).toBe("Build Faster Today");
    const visual = container.querySelector('[aria-hidden="true"]');
    expect(visual?.querySelectorAll(".m-text-token").length).toBe(3);

    rerender(
      <h1>
        <TextMotionContent
          text="Build Faster Today"
          config={{ enabled: true, preset: "staggerWord", trigger: "load", staggerMs: 40 }}
          globalMotion={{ ...DEFAULT_GLOBAL_MOTION, reducedMotionPolicy: "always-reduced" }}
        />
      </h1>
    );
    expect(container.querySelector(".m-text-token")).toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Build Faster Today");
  });

  it("updates node motion via MotionInspectorTab and supports Undo/Redo + scroll scrub", () => {
    const node = useEditorStore.getState().nodes[0];
    const { rerender } = render(
      <MotionInspectorTab
        node={node}
        viewport="desktop"
        globalMotion={DEFAULT_GLOBAL_MOTION}
        customPresets={[]}
        canWrite={true}
        onOpenLibrary={() => {}}
      />
    );

    expect(screen.getByText("Entrance")).toBeTruthy();
    expect(screen.getByText("Scroll")).toBeTruthy();
    expect(screen.getByText("Hover")).toBeTruthy();
    expect(screen.getByText("Text Animation")).toBeTruthy();

    useEditorStore.getState().updateNodeMotion(
      node.id,
      {
        enabled: true,
        entrance: { preset: "zoomIn", duration: 550, trigger: "viewport" },
        scroll: { enabled: true, mode: "parallax", effect: "parallaxVertical", speed: 40 },
      },
      "Apply zoomIn + parallax"
    );

    const updated = useEditorStore.getState().nodes[0];
    expect(updated.motion?.entrance?.preset).toBe("zoomIn");
    expect(updated.motion?.scroll?.effect).toBe("parallaxVertical");

    rerender(
      <MotionInspectorTab
        node={updated}
        viewport="desktop"
        globalMotion={DEFAULT_GLOBAL_MOTION}
        customPresets={[]}
        canWrite={true}
        onOpenLibrary={() => {}}
      />
    );

    // Open Scroll section and scrub simulated progress slider
    fireEvent.click(screen.getByText("Scroll"));
    const slider = screen.getByLabelText("Simulated scroll progress");
    fireEvent.change(slider, { target: { value: "65" } });
    expect(useEditorStore.getState().motionScrollProgressByNodeId[node.id]).toBe(65);

    // Undo restores previous clean motion state
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes[0].motion).toBeUndefined();

    // Redo brings it back
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().nodes[0].motion?.entrance?.preset).toBe("zoomIn");
  });
});
