import { describe, expect, it } from "vitest";
import {
  apiBlockSchema,
  apiBlocksToEditorBlocks,
  editorBlocksToApiBlocks,
  safeUrlSchema,
  themeTokensSchema,
  themeTokensToCssVars,
} from "@/lib/cms-schema";
import { initialBlocks } from "@/mocks/pages";

describe("cms-schema", () => {
  it("round-trips editor blocks to API schema v1 and back cleanly", () => {
    const apiPayload = editorBlocksToApiBlocks(initialBlocks);
    expect(apiPayload.blocks.length).toBe(initialBlocks.length);
    for (const block of apiPayload.blocks) {
      expect(() => apiBlockSchema.parse(block)).not.toThrow();
    }

    const back = apiBlocksToEditorBlocks(apiPayload);
    expect(back.length).toBe(initialBlocks.length);
    expect(back[0].type).toBe("Hero");
    expect(back[0].heading).toBe(initialBlocks[0].heading);
  });

  it("rejects unsafe XSS script tags, javascript URLs, and arbitrary block types", () => {
    expect(() =>
      apiBlockSchema.parse({
        id: "xss",
        type: "hero",
        version: 1,
        label: "Bad",
        visible: true,
        props: { heading: "<script>alert(1)</script>" },
      })
    ).toThrow();

    expect(() => safeUrlSchema.parse("javascript:alert(1)")).toThrow();
    expect(() =>
      apiBlockSchema.parse({
        id: "html",
        type: "raw_html",
        version: 1,
        label: "Raw",
        visible: true,
        props: {},
      })
    ).toThrow();
  });

  it("validates allowlisted theme tokens and builds CSS variables", () => {
    const valid = themeTokensSchema.parse({
      version: 1,
      colors: {
        primary: "#5B46E8",
        background: "#FFFFFF",
        text: "#111318",
      },
      typography: {
        headingFont: "Georgia",
        bodyFont: "Inter",
      },
      radius: {
        card: "10px",
        button: "8px",
      },
      container: {
        maxWidth: "1280px",
      },
    });
    const css = themeTokensToCssVars(valid) as Record<string, string>;
    expect(css["--accent"]).toBe("#5B46E8");
    expect(css["--store-font-heading"]).toBe("Georgia");

    expect(() =>
      themeTokensSchema.parse({
        ...valid,
        colors: { ...valid.colors, primary: "blue" },
      })
    ).toThrow();
  });
});
