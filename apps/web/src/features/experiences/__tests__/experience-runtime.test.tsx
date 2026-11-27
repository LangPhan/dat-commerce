import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ExperienceFooterSlot,
  ExperienceHeaderFrameSlot,
  ExperienceHeroSlot,
  ExperienceOverlayRuntime,
  ExperienceTopSlot,
} from "../runtime/ExperienceRuntime";
import type { ResolvedStorefrontExperienceDto } from "../types";

function buildMockResolvedExperience(): ResolvedStorefrontExperienceDto {
  const futureEnd = new Date(Date.now() + 3600_000).toISOString();
  return {
    enabled: true,
    resolvedAt: new Date().toISOString(),
    nextTransitionAt: futureEnd,
    mobilePerformanceMode: "ADAPTIVE",
    respectReducedMotion: true,
    allowCustomerDismiss: true,
    globalParticleCap: 160,
    activeExperiences: [
      {
        id: "exp-1",
        slug: "christmas",
        name: "Christmas Wonderland",
        category: "HOLIDAY",
        priority: 80,
        blendMode: "OVERRIDE",
        endsAt: futureEnd,
        targetPages: ["*"],
      },
    ],
    effectiveThemeOverride: {
      enabled: true,
      mode: "accent_tint",
      backdrop: { kind: "top_aurora", primaryColor: "#DC2626", secondaryColor: "#16A34A", opacity: 0.2 },
    },
    layers: [
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "promo-1",
        type: "promo_banner",
        label: "Christmas Banner",
        zone: "top_announcement",
        zIndex: 45,
        opacity: 1,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        experienceEndsAt: futureEnd,
        targetPages: ["*"],
        props: {
          badgeText: "CHRISTMAS",
          headline: "Holiday Sale 20% Off",
          promoCode: "XMAS20",
          ctaLabel: "Shop Gifts",
          ctaUrl: "/store/shop",
          dismissible: true,
        },
      },
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "cd-1",
        type: "countdown_bar",
        label: "Flash Timer",
        zone: "hero_stage",
        zIndex: 44,
        opacity: 1,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        experienceEndsAt: futureEnd,
        targetPages: ["*"],
        props: {
          title: "Flash Ends In",
          syncWithExperienceEnd: true,
          ctaLabel: "Grab Deal",
          ctaUrl: "/store/shop",
        },
      },
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "lights-1",
        type: "string_lights",
        label: "Lights",
        zone: "header_frame",
        zIndex: 42,
        opacity: 0.95,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        targetPages: ["*"],
        props: { bulbCount: 12 },
      },
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "lanterns-1",
        type: "festive_lanterns",
        label: "Lanterns",
        zone: "footer_stage",
        zIndex: 35,
        opacity: 0.95,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        targetPages: ["*"],
        props: { count: 4, emblemText: "福" },
      },
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "snow-1",
        type: "snowfall",
        label: "Snow",
        zone: "viewport_overlay",
        zIndex: 25,
        opacity: 0.9,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        targetPages: ["*"],
        props: { density: 50 },
      },
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "sleigh-1",
        type: "santa_sleigh",
        label: "Santa Sleigh",
        zone: "viewport_overlay",
        zIndex: 38,
        opacity: 0.98,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        targetPages: ["*"],
        props: { direction: "ltr" },
      },
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "corner-1",
        type: "corner_floral_frame",
        label: "Corners",
        zone: "viewport_overlay",
        zIndex: 34,
        opacity: 0.95,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        targetPages: ["*"],
        props: { motif: "pine_holly", corners: ["top-left", "top-right"] },
      },
      {
        sourceExperienceId: "exp-1",
        sourceExperienceName: "Christmas Wonderland",
        id: "sticker-1",
        type: "floating_sticker",
        label: "Sticker",
        zone: "floating_corner",
        zIndex: 44,
        opacity: 1,
        blendMode: "normal",
        visibility: { desktop: true, tablet: true, mobile: true },
        trigger: "immediate",
        effectiveDensityScale: 1,
        targetPages: ["*"],
        props: { text: "FLASH DROP", subtext: "Code XMAS20", linkUrl: "/store/shop" },
      },
    ],
    resolutionTrace: [],
  };
}

describe("ExperienceRuntime storefront slots and overlays", () => {
  it("renders all slotted components, copyable promo code, countdown timer, and shopper pause toggle", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const exp = buildMockResolvedExperience();
    const { container } = render(
      <div>
        <ExperienceTopSlot experience={exp} currentPath="/" />
        <ExperienceHeaderFrameSlot experience={exp} currentPath="/" />
        <ExperienceHeroSlot experience={exp} currentPath="/" />
        <ExperienceFooterSlot experience={exp} currentPath="/" />
        <ExperienceOverlayRuntime experience={exp} currentPath="/" />
      </div>
    );

    // Promo banner & copy code
    expect(screen.getByText("Holiday Sale 20% Off")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Copy promo code"));
    expect(writeText).toHaveBeenCalledWith("XMAS20");

    // Countdown widget
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByText("Flash Ends In")).toBeInTheDocument();

    // Floating sticker
    expect(screen.getByText("FLASH DROP")).toBeInTheDocument();

    // Lantern calligraphy emblem
    expect(screen.getAllByText("福").length).toBeGreaterThan(0);

    // Canvas particle layer + shopper pause toggle
    expect(container.querySelector("canvas.exp-particle-canvas")).toBeInTheDocument();
    const pauseBtn = screen.getByRole("button", { name: /pause seasonal effects/i });
    fireEvent.click(pauseBtn);
    expect(container.querySelector("canvas.exp-particle-canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Effects paused")).toBeInTheDocument();

    // Dismiss promo banner
    fireEvent.click(screen.getByLabelText("Dismiss promotional banner"));
    expect(screen.queryByText("Holiday Sale 20% Off")).not.toBeInTheDocument();
  });

  it("respects targetPages filtering when currentPath does not match", () => {
    const exp = buildMockResolvedExperience();
    exp.layers = exp.layers.map((l) => ({ ...l, targetPages: ["/store/shop"] }));

    render(<ExperienceTopSlot experience={exp} currentPath="/store/cart" />);
    expect(screen.queryByText("Holiday Sale 20% Off")).not.toBeInTheDocument();
  });
});
