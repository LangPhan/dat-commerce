import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_GLOBAL_MOTION } from "../defaults";
import { GlobalMotionSettingsPanel } from "../GlobalMotionSettingsPanel";
import { resolveElementMotionForViewport } from "../resolve";
import type { AnimationPresetDefinition, ElementMotionConfig } from "../types";

describe("Phase 4 — Global Motion Settings, Reusable Presets & Responsive Cascade", () => {
  it("renders GlobalMotionSettingsPanel tabs and emits typed global motion updates", () => {
    const onChange = vi.fn();
    const customPreset: AnimationPresetDefinition = {
      id: "preset-1",
      presetKey: "brand-hero-rise",
      name: "Brand Hero Rise",
      category: "entrance",
      description: "Custom brand entrance",
      defaultDuration: 620,
      defaultEasing: "easeOut",
      isSystem: false,
      config: {
        enabled: true,
        entrance: { enabled: true, preset: "fadeInUp", duration: 620, easing: "easeOut" },
      },
    };

    render(
      <GlobalMotionSettingsPanel
        motion={DEFAULT_GLOBAL_MOTION}
        customPresets={[customPreset]}
        canWrite={true}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Enable Global Animations")).toBeTruthy();

    // Toggle global animations off
    const masterCheck = screen.getByLabelText("Enable Global Animations") as HTMLInputElement;
    fireEvent.click(masterCheck);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].enabled).toBe(false);

    // Switch to Timing & Easing Tokens tab
    fireEvent.click(screen.getByRole("tab", { name: /Timing & Easing Tokens/i }));
    const customBezierInput = screen.getByLabelText("Custom Cubic Bezier") as HTMLInputElement;
    fireEvent.change(customBezierInput, { target: { value: "invalid-bezier" } });
    fireEvent.blur(customBezierInput);
    expect(screen.getByText(/Use valid cubic-bezier/i)).toBeTruthy();

    fireEvent.change(customBezierInput, {
      target: { value: "cubic-bezier(0.16, 1, 0.3, 1)" },
    });
    fireEvent.blur(customBezierInput);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0].easingTokens.custom).toBe(
      "cubic-bezier(0.16, 1, 0.3, 1)"
    );

    // Switch to Reusable Presets tab
    fireEvent.click(screen.getByRole("tab", { name: /Reusable Presets \(1\)/i }));
    expect(screen.getByText("Brand Hero Rise")).toBeTruthy();
    expect(screen.getByText("brand-hero-rise")).toBeTruthy();
  });

  it("propagates custom preset updates to linked elements while preserving local overrides", () => {
    const updatedPreset: AnimationPresetDefinition = {
      id: "p-custom",
      presetKey: "brand-card-pop",
      name: "Brand Card Pop",
      category: "entrance",
      description: "Updated duration from 500 -> 800",
      defaultDuration: 800,
      defaultEasing: "easeInOut",
      isSystem: false,
      config: {
        enabled: true,
        entrance: { enabled: true, preset: "zoomIn", duration: 800, easing: "easeInOut" },
        hover: { enabled: true, preset: "scaleUp", duration: 240, easing: "easeOut" },
      },
    };

    const pureLinkedNode: ElementMotionConfig = {
      enabled: true,
      presetRef: "brand-card-pop",
    };

    const overriddenNode: ElementMotionConfig = {
      enabled: true,
      presetRef: "brand-card-pop",
      entrance: { duration: 350 },
    };

    const resolvedPure = resolveElementMotionForViewport(
      pureLinkedNode,
      "desktop",
      [updatedPreset],
      DEFAULT_GLOBAL_MOTION
    );
    expect(resolvedPure.entrance?.preset).toBe("zoomIn");
    expect(resolvedPure.entrance?.duration).toBe(800);
    expect(resolvedPure.hover?.preset).toBe("scaleUp");

    const resolvedOverridden = resolveElementMotionForViewport(
      overriddenNode,
      "desktop",
      [updatedPreset],
      DEFAULT_GLOBAL_MOTION
    );
    // Preserves local duration override while inheriting preset's preset/easing/hover!
    expect(resolvedOverridden.entrance?.preset).toBe("zoomIn");
    expect(resolvedOverridden.entrance?.duration).toBe(350);
    expect(resolvedOverridden.entrance?.easing).toBe("easeInOut");
    expect(resolvedOverridden.hover?.preset).toBe("scaleUp");
  });

  it("applies responsive cascade and mobileBehavior reduced/disabled cleanly", () => {
    const config: ElementMotionConfig = {
      enabled: true,
      entrance: { enabled: true, preset: "fadeInUp", duration: 600 },
      scroll: { enabled: true, mode: "parallax", effect: "parallaxVertical", speed: 40 },
      continuous: { enabled: true, preset: "floating", duration: 2400 },
      responsive: {
        tablet: { entrance: { duration: 480 } },
        mobile: { enabled: true },
      },
    };

    const tablet = resolveElementMotionForViewport(config, "tablet", [], DEFAULT_GLOBAL_MOTION);
    expect(tablet.entrance?.duration).toBe(480);

    const mobileReduced = resolveElementMotionForViewport(config, "mobile", [], {
      ...DEFAULT_GLOBAL_MOTION,
      mobileBehavior: "reduced",
    });
    expect(mobileReduced.entrance?.duration).toBeLessThan(480);
    expect(mobileReduced.scroll?.enabled).toBe(false);
    expect(mobileReduced.continuous?.enabled).toBe(false);

    const mobileDisabled = resolveElementMotionForViewport(config, "mobile", [], {
      ...DEFAULT_GLOBAL_MOTION,
      mobileBehavior: "disabled",
    });
    expect(mobileDisabled.enabled).toBe(false);
  });
});
