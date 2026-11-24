import type { CSSProperties } from "react";
import { sanitizeStyleValues } from "./sanitizers";
import type {
  ElementNode,
  ResponsiveStyles,
  ResponsiveVisibility,
  StylePropertyKey,
  StyleValues,
  ViewportMode,
} from "./types";

const NUMERIC_UNITLESS_PROPS = new Set<StylePropertyKey>([
  "fontWeight",
  "lineHeight",
  "opacity",
  "zIndex",
  "flexGrow",
  "flexShrink",
]);

function assignStyleMap(target: Record<string, string | number>, map?: StyleValues) {
  if (!map) return;
  const clean = sanitizeStyleValues(map as Record<string, unknown>);
  for (const [key, val] of Object.entries(clean)) {
    if (!val) continue;
    const propKey = key as StylePropertyKey;
    if (NUMERIC_UNITLESS_PROPS.has(propKey)) {
      const n = Number(val);
      target[key] = Number.isFinite(n) && val !== "" ? n : val;
    } else {
      target[key] = val;
    }
  }
}

export function resolveStylesForViewport(
  styles: ResponsiveStyles | undefined,
  viewport: ViewportMode
): {
  resolved: StyleValues;
  overriddenKeys: Set<StylePropertyKey>;
  hasViewportOverride: boolean;
} {
  const base = sanitizeStyleValues((styles?.base || {}) as Record<string, unknown>);
  const tablet = sanitizeStyleValues((styles?.tablet || {}) as Record<string, unknown>);
  const mobile = sanitizeStyleValues((styles?.mobile || {}) as Record<string, unknown>);

  const resolved: StyleValues = { ...base };
  const overriddenKeys = new Set<StylePropertyKey>();

  if (viewport === "tablet" || viewport === "mobile") {
    for (const [k, v] of Object.entries(tablet)) {
      if (v !== undefined) {
        resolved[k as StylePropertyKey] = v;
        if (viewport === "tablet") {
          overriddenKeys.add(k as StylePropertyKey);
        }
      }
    }
  }

  if (viewport === "mobile") {
    for (const [k, v] of Object.entries(mobile)) {
      if (v !== undefined) {
        resolved[k as StylePropertyKey] = v;
        overriddenKeys.add(k as StylePropertyKey);
      }
    }
  }

  return {
    resolved,
    overriddenKeys,
    hasViewportOverride: overriddenKeys.size > 0,
  };
}

export function compileNodeInlineStyle(
  styles: ResponsiveStyles | undefined,
  viewport: ViewportMode
): CSSProperties {
  const { resolved } = resolveStylesForViewport(styles, viewport);
  const cssObj: Record<string, string | number> = {};
  assignStyleMap(cssObj, resolved);
  return cssObj as CSSProperties;
}

export function isVisibleForViewport(
  visible: boolean,
  visibility: ResponsiveVisibility | undefined,
  viewport: ViewportMode
): boolean {
  if (!visible) return false;
  if (!visibility) return true;
  if (viewport === "desktop" && visibility.desktop === false) return false;
  if (viewport === "tablet" && visibility.tablet === false) return false;
  if (viewport === "mobile" && visibility.mobile === false) return false;
  return true;
}

function toKebabCase(camel: string): string {
  return camel.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function serializeDeclarations(map: StyleValues): string {
  const clean = sanitizeStyleValues(map as Record<string, unknown>);
  return Object.entries(clean)
    .map(([k, v]) => `${toKebabCase(k)}: ${v};`)
    .join(" ");
}

function escapeSelectorAttr(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "");
}

/**
 * Generates deterministic, sanitized scoped CSS rules for live storefront rendering
 * so tablet, mobile, hover, and responsive visibility work via native media queries.
 */
export function compileLivePageCss(nodes: ElementNode[]): string {
  const baseRules: string[] = [];
  const hoverRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];

  const visit = (list: ElementNode[]) => {
    for (const node of list) {
      const safeId = escapeSelectorAttr(node.id);
      if (safeId) {
        const selector = `[data-builder-node="${safeId}"]`;

        const baseDecl = serializeDeclarations(node.styles?.base || {});
        if (baseDecl) {
          baseRules.push(`${selector} { ${baseDecl} }`);
        }

        const hoverDecl = serializeDeclarations(node.styles?.hover || {});
        if (hoverDecl) {
          hoverRules.push(`${selector}:hover { ${hoverDecl} }`);
        }

        const tabletDecl = serializeDeclarations(node.styles?.tablet || {});
        if (tabletDecl) {
          tabletRules.push(`  ${selector} { ${tabletDecl} }`);
        }

        const mobileDecl = serializeDeclarations(node.styles?.mobile || {});
        if (mobileDecl) {
          mobileRules.push(`  ${selector} { ${mobileDecl} }`);
        }

        const vis = node.visibility;
        if (vis) {
          if (vis.desktop === false) {
            baseRules.push(`@media (min-width: 1025px) { ${selector} { display: none !important; } }`);
          }
          if (vis.tablet === false) {
            tabletRules.push(`  ${selector} { display: none !important; }`);
          }
          if (vis.mobile === false) {
            mobileRules.push(`  ${selector} { display: none !important; }`);
          }
        }
      }
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };

  visit(nodes);

  const sections: string[] = [];
  if (baseRules.length) sections.push(baseRules.join("\n"));
  if (hoverRules.length) sections.push(hoverRules.join("\n"));
  if (tabletRules.length) {
    sections.push(`@media (max-width: 1024px) {\n${tabletRules.join("\n")}\n}`);
  }
  if (mobileRules.length) {
    sections.push(`@media (max-width: 640px) {\n${mobileRules.join("\n")}\n}`);
  }
  return sections.join("\n");
}
