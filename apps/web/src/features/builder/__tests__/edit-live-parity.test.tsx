import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createElementNode } from "../registry/definitions";
import { PageRenderer } from "../renderer/PageRenderer";
import { splitEditWrapperStyles } from "../style-compiler";

describe("Edit vs Live flex/grid wrapper layout parity", () => {
  it("hoists flex/grid placement, width, margin, and positioning onto wrapperStyle without compounding percentages", () => {
    const hoistedFull = splitEditWrapperStyles(
      {
        width: "100%",
        margin: "0",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        flexGrow: 1,
        flexShrink: 0,
        alignSelf: "stretch",
        gridColumn: "span 2",
        gridRow: "1 / 2",
        position: "relative",
        top: "4px",
        left: "8px",
        zIndex: 5,
      },
      "container"
    );

    expect(hoistedFull.wrapperStyle).toEqual({
      width: "100%",
      margin: "0",
      flexGrow: 1,
      flexShrink: 0,
      alignSelf: "stretch",
      gridColumn: "span 2",
      gridRow: "1 / 2",
      position: "relative",
      top: "4px",
      left: "8px",
      zIndex: 5,
    });
    expect(hoistedFull.elementStyle.width).toBe("100%");
    expect(hoistedFull.elementStyle.margin).toBeUndefined();
    expect(hoistedFull.elementStyle.flexGrow).toBeUndefined();
    expect(hoistedFull.elementStyle.display).toBe("flex");
    expect(hoistedFull.elementStyle.gap).toBe("16px");

    const halfWidth = splitEditWrapperStyles(
      { width: "50%", padding: "12px" },
      "container"
    );
    expect(halfWidth.wrapperStyle.width).toBe("50%");
    expect(halfWidth.elementStyle.width).toBe("100%");
    expect(halfWidth.elementStyle.padding).toBe("12px");

    const centeredMaxWidth = splitEditWrapperStyles(
      { maxWidth: "680px", margin: "0 auto" },
      "container"
    );
    expect(centeredMaxWidth.wrapperStyle.maxWidth).toBe("680px");
    expect(centeredMaxWidth.wrapperStyle.margin).toBe("0 auto");
    expect(centeredMaxWidth.elementStyle.maxWidth).toBe("100%");
    expect(centeredMaxWidth.elementStyle.margin).toBeUndefined();

    const intrinsicBtn = splitEditWrapperStyles(
      { backgroundColor: "#5B46E8", padding: "10px 20px" },
      "button"
    );
    expect(intrinsicBtn.wrapperStyle.width).toBeUndefined();
    expect(intrinsicBtn.elementStyle.width).toBeUndefined();

    const intrinsicPromo = splitEditWrapperStyles({}, "promotion_banner");
    expect(intrinsicPromo.wrapperStyle.width).toBe("100%");

    const heroHeight = splitEditWrapperStyles(
      { minHeight: "88vh", height: "100%", display: "flex" },
      "section"
    );
    expect(heroHeight.wrapperStyle.minHeight).toBeUndefined();
    expect(heroHeight.wrapperStyle.height).toBe("100%");
    expect(heroHeight.elementStyle.minHeight).toBe("88vh");
    expect(heroHeight.elementStyle.height).toBe("100%");
  });

  it("propagates container width and promo banner full width directly onto flex/DnD wrappers in PageRenderer", () => {
    const promoBanner = createElementNode("promotion_banner");
    promoBanner.id = "promo-banner-child";
    promoBanner.styles = { base: {} };

    const innerContainer = createElementNode("container");
    innerContainer.id = "promo-inner-container";
    innerContainer.styles = {
      base: {
        width: "100%",
        margin: "0",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      },
    };
    innerContainer.children = [promoBanner];

    const promoSection = createElementNode("section");
    promoSection.id = "promo-section";
    promoSection.styles = {
      base: {
        display: "flex",
        justifyContent: "flex-start",
        paddingLeft: "64px",
        paddingRight: "64px",
        backgroundColor: "#111318",
      },
    };
    promoSection.children = [innerContainer];

    // 1. Default edit mode (without wrapEditNode)
    const { container: defaultEditRoot } = render(
      <PageRenderer mode="edit" nodes={[promoSection]} />
    );
    const sectionEl1 = defaultEditRoot.querySelector("section");
    expect(sectionEl1).not.toBeNull();
    const directChildWrap1 = sectionEl1?.firstElementChild as HTMLElement | null;
    expect(directChildWrap1).toHaveClass("bldr-edit-wrap");
    expect(directChildWrap1?.style.width).toBe("100%");
    expect(directChildWrap1?.style.margin).toBe("0px");

    const innerContainerEl1 = sectionEl1?.querySelector(".bldr-type-container") as HTMLElement | null;
    expect(innerContainerEl1?.style.width).toBe("100%");
    expect(innerContainerEl1?.style.margin).toBe("");

    const promoChildWrap1 = innerContainerEl1?.firstElementChild as HTMLElement | null;
    expect(promoChildWrap1).toHaveClass("bldr-edit-wrap");
    expect(promoChildWrap1?.style.width).toBe("100%");

    // 2. Edit mode with custom wrapEditNode (mimicking CanvasNodeDndShell)
    const { container: dndEditRoot } = render(
      <PageRenderer
        mode="edit"
        nodes={[promoSection]}
        wrapEditNode={({ wrapperStyle, children }) => (
          <div className="ed-dnd-item-wrap" style={wrapperStyle}>
            <div className="ed-dnd-node-shell">{children}</div>
          </div>
        )}
      />
    );
    const sectionEl2 = dndEditRoot.querySelector("section");
    const dndDirectChild = sectionEl2?.firstElementChild as HTMLElement | null;
    expect(dndDirectChild).toHaveClass("ed-dnd-item-wrap");
    expect(dndDirectChild?.style.width).toBe("100%");
    expect(dndDirectChild?.style.margin).toBe("0px");

    const dndInnerContainer = sectionEl2?.querySelector(".bldr-type-container") as HTMLElement | null;
    expect(dndInnerContainer?.style.width).toBe("100%");
    expect(dndInnerContainer?.style.margin).toBe("");
    const dndPromoChild = dndInnerContainer?.firstElementChild as HTMLElement | null;
    expect(dndPromoChild).toHaveClass("ed-dnd-item-wrap");
    expect(dndPromoChild?.style.width).toBe("100%");

    // 3. Live mode structure baseline
    const { container: liveRoot } = render(
      <PageRenderer mode="live" nodes={[promoSection]} />
    );
    const liveSection = liveRoot.querySelector('[data-builder-node="promo-section"]');
    const liveContainer = liveSection?.firstElementChild as HTMLElement | null;
    expect(liveContainer?.getAttribute("data-builder-node")).toBe("promo-inner-container");
  });
});
