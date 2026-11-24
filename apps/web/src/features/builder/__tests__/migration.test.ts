import { describe, expect, it } from "vitest";
import { editorBlocksToApiBlocks } from "@/lib/cms-schema";
import { initialBlocks } from "@/mocks/pages";
import {
  extractPageDocumentV2,
  isV2Content,
  migrateBlockToV2Node,
  migrateV1ToV2,
} from "../migration";
import { countTreeNodes } from "../operations";

describe("v1 to v2 CMS migration", () => {
  it("migrates seeded v1 homepage blocks into nested editable v2 element trees", () => {
    const v1Payload = editorBlocksToApiBlocks(initialBlocks);
    expect(isV2Content(v1Payload)).toBe(false);

    const v2 = migrateV1ToV2(v1Payload);
    expect(v2.version).toBe(2);
    expect(v2.nodes.length).toBe(initialBlocks.length);
    expect(countTreeNodes(v2.nodes)).toBeGreaterThan(initialBlocks.length);
    expect(v2.nodes[0].type).toBe("section");
    expect(v2.nodes[0].children?.length).toBeGreaterThan(0);

    // Passing a native v2 document preserves nodes cleanly without re-migrating
    expect(isV2Content(v2)).toBe(true);
    const extracted = extractPageDocumentV2(v2);
    expect(extracted.nodes).toEqual(v2.nodes);
  });

  it("aligns left-aligned hero container with header without centering maxWidth gap while keeping centered hero centered", () => {
    const leftHero = migrateBlockToV2Node({
      id: "hero",
      type: "Hero",
      label: "Hero",
      visible: true,
      tone: "forest",
      layout: "overlay",
      scale: "large",
      image: "/media/terrain-hero.jpg",
      heading: "Engineered for where the road ends.",
      kicker: "AUTUMN",
      copy: "Purpose-built footwear.",
      action: "Shop",
      actionUrl: "/store/shop",
    });

    expect(leftHero.styles.base.paddingLeft).toBe("64px");
    expect(leftHero.styles.base.paddingRight).toBe("64px");
    expect(leftHero.styles.base.justifyContent).toBe("flex-start");
    expect(leftHero.styles.tablet?.paddingLeft).toBe("36px");
    expect(leftHero.styles.mobile?.paddingLeft).toBe("24px");
    const leftWrap = leftHero.children?.[0];
    expect(leftWrap?.styles.base.margin).toBe("0");
    expect(leftWrap?.styles.base.maxWidth).toBeUndefined();

    const centeredHero = migrateBlockToV2Node({
      id: "hero-center",
      type: "Hero",
      label: "Centered Hero",
      visible: true,
      tone: "ink",
      layout: "centered",
      scale: "large",
      image: "/media/terrain-hero.jpg",
      heading: "Centered",
      copy: "Centered hero copy.",
      action: "Shop",
      actionUrl: "/store/shop",
    });
    const centeredWrap = centeredHero.children?.[0];
    expect(centeredWrap?.styles.base.margin).toBe("0 auto");
    expect(centeredWrap?.styles.base.maxWidth).toBe("1280px");
  });
});
