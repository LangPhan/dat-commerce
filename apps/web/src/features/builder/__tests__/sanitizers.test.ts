import { describe, expect, it } from "vitest";
import { createElementNode } from "../registry/definitions";
import {
  sanitizeCssClasses,
  sanitizeHtmlAttributes,
  sanitizeHtmlSubset,
  sanitizeMediaUrl,
  sanitizeStyleValues,
  sanitizeUrl,
} from "../sanitizers";
import {
  compileLivePageCss,
  compileNodeInlineStyle,
  resolveStylesForViewport,
} from "../style-compiler";

describe("builder sanitizers & responsive CSS compiler", () => {
  it("strips dangerous HTML tags, event handlers, and javascript URIs", () => {
    const dirty =
      '<div class="note" onclick="alert(1)"><script>steal()</script><a href="javascript:evil()">Link</a><iframe src="https://evil"></iframe><p>Safe</p></div>';
    const clean = sanitizeHtmlSubset(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<p>Safe</p>");
  });

  it("sanitizes URLs, CSS values, classes, and restricted attributes", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
    expect(sanitizeUrl("//evil.example/foo")).toBe("#");
    expect(sanitizeUrl("/store/shop")).toBe("/store/shop");
    expect(sanitizeMediaUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg"
    );
    expect(sanitizeMediaUrl("/etc/passwd")).toBe("/media/terrain-fallback.jpg");

    const styles = sanitizeStyleValues({
      color: "#2563EB",
      backgroundImage: "url(javascript:alert(1))",
      paddingTop: "48px; position: fixed",
      marginBottom: "24px",
      unknownProp: "bad",
    });
    expect(styles).toEqual({
      color: "#2563EB",
      marginBottom: "24px",
    });

    expect(sanitizeCssClasses(["hero-card", "bad class!", "hero-card"])).toEqual([
      "hero-card",
    ]);
    expect(
      sanitizeHtmlAttributes({
        "aria-label": "Hero",
        onclick: "alert(1)",
        "data-track": "cta",
      })
    ).toEqual({
      "aria-label": "Hero",
      "data-track": "cta",
    });
  });

  it("resolves cascaded responsive styles and compiles @media CSS deterministically", () => {
    const h = createElementNode("heading");
    h.id = "h-resp";
    h.styles = {
      base: { fontSize: "48px", color: "#111318" },
      tablet: { fontSize: "36px" },
      mobile: { fontSize: "24px" },
    };

    const mobile = resolveStylesForViewport(h.styles, "mobile");
    expect(mobile.resolved.fontSize).toBe("24px");
    expect(mobile.resolved.color).toBe("#111318");
    expect(mobile.overriddenKeys.has("fontSize")).toBe(true);
    expect(compileNodeInlineStyle(h.styles, "tablet").fontSize).toBe("36px");

    const css = compileLivePageCss([h]);
    expect(css).toContain('@media (max-width: 1024px)');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('[data-builder-node="h-resp"]');
  });
});
