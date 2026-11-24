import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/builder/registry/definitions";
import {
  extractPreloadImageUrls,
  recordInitialPathname,
  resetPageRevealStateForTest,
  shouldShowStorePageLoader,
  StorePageReveal,
} from "../page-reveal";

let mockedPathname: string | null = "/store";

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
}));

describe("StorePageReveal and preload URL extractor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedPathname = "/store";
    resetPageRevealStateForTest();
    window.history.replaceState({}, "", "/store");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps full-page loader visible while ready=false, resets scroll to top, and transitions revealing -> ready once", async () => {
    const { container, rerender } = render(
      <StorePageReveal ready={false} maxWaitMs={2400}>
        <main>Storefront Ready Content</main>
      </StorePageReveal>
    );

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
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
      await vi.advanceTimersByTimeAsync(450);
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
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(container.querySelector(".store-page-stage")).toHaveClass("is-ready");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("skips the full-page loader on subsequent storefront client navigations after initial reveal", async () => {
    const first = render(
      <StorePageReveal ready={true} maxWaitMs={2400}>
        <main>Home View</main>
      </StorePageReveal>
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(first.container.querySelector(".store-page-stage")).toHaveClass("is-ready");
    first.unmount();

    mockedPathname = "/store/shop";
    const second = render(
      <StorePageReveal ready={false} maxWaitMs={2400}>
        <main>Shop View</main>
      </StorePageReveal>
    );

    expect(screen.queryByRole("status", { name: "Loading storefront" })).not.toBeInTheDocument();
    expect(second.container.querySelector(".store-page-stage")).toHaveClass("is-ready");
    expect(screen.getByText("Shop View")).toBeInTheDocument();
  });

  it("skips the loader on /store when navigating from another initial route such as /", () => {
    recordInitialPathname("/");
    expect(shouldShowStorePageLoader("/store")).toBe(false);

    mockedPathname = "/store";
    const { container } = render(
      <StorePageReveal ready={false} maxWaitMs={2400}>
        <main>Store After Editor Link</main>
      </StorePageReveal>
    );

    expect(screen.queryByRole("status", { name: "Loading storefront" })).not.toBeInTheDocument();
    expect(container.querySelector(".store-page-stage")).toHaveClass("is-ready");
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
