import { describe, expect, it } from "vitest";
import { editorBlocksToApiBlocks } from "@/lib/cms-schema";
import { initialBlocks } from "@/mocks/pages";
import { extractPageDocumentV2, isV2Content, migrateV1ToV2 } from "../migration";
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
});
