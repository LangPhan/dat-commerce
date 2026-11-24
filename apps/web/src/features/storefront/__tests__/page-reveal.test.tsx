import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/builder/registry/definitions";
import { extractPreloadImageUrls, StorePageReveal } from "../page-reveal";

describe("StorePageReveal and preload URL extractor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps full-page loader visible while ready=false, then smoothly transitions revealing -> ready", async () => {
    const { container, rerender } = render(
      <StorePageReveal ready={false} maxWaitMs={2400}>
        <main>Storefront Ready Content</main>
      </StorePageReveal>
    );

    const loader = screen.getByRole("status", { name: "Loading storefront" });
    expect(loader).toBeInTheDocument();
    expect(loader).not.toHaveClass("is-exiting");
    expect(container.querySelector(".store-page-stage")).toHaveClass("is-loading");

    rerender(
      <StorePageReveal ready={true} maxWaitMs={2400}>
        <main>Storefront Ready Content</main>
      </StorePageReveal>
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(container.querySelector(".store-page-stage")).toHaveClass("is-revealing");
    expect(screen.getByRole("status")).toHaveClass("is-exiting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(550);
    });

    expect(container.querySelector(".store-page-stage")).toHaveClass("is-ready");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Storefront Ready Content")).toBeInTheDocument();
  });

  it("reveals automatically after maxWaitMs failsafe timeout when ready never becomes true", async () => {
    const { container } = render(
      <StorePageReveal ready={false} maxWaitMs={1200}>
        <main>Fallback Revealed Content</main>
      </StorePageReveal>
    );

    expect(container.querySelector(".store-page-stage")).toHaveClass("is-loading");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1250);
    });
    expect(container.querySelector(".store-page-stage")).toHaveClass("is-revealing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(550);
    });
    expect(container.querySelector(".store-page-stage")).toHaveClass("is-ready");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("extracts safe background and image URLs from first 2 sections and ignores unsafe schemes", () => {
    const sec1 = createElementNode("section");
    sec1.id = "hero";
    sec1.styles.base.backgroundImage =
      'linear-gradient(125deg, rgba(8,16,12,0.84), rgba(15,41,30,0.62)), url("/media/terrain-hero.jpg")';

    const unsafeImg = createElementNode("image");
    unsafeImg.props = { src: "javascript:alert(1)" };

    const safeImg = createElementNode("image");
    safeImg.props = { src: "https://cdn.example.com/trail.jpg" };

    const thirdImg = createElementNode("image");
    thirdImg.props = { src: "/media/extra-should-cap.jpg" };

    const dataBgSection = createElementNode("section");
    dataBgSection.styles.base.backgroundImage = "url(data:text/html,<svg/>)";
    dataBgSection.children = [unsafeImg, safeImg, thirdImg];

    const thirdSection = createElementNode("section");
    thirdSection.styles.base.backgroundImage = "url(/media/third-sec.jpg)";

    const urls = extractPreloadImageUrls([sec1, dataBgSection, thirdSection]);
    expect(urls).toEqual([
      "/media/terrain-hero.jpg",
      "https://cdn.example.com/trail.jpg",
    ]);
  });
});
