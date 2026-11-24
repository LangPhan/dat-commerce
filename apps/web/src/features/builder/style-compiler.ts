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
export function compileLivePageCss(
  nodes: ElementNode[],
  opts?: { hoverOnly?: boolean; forceViewport?: ViewportMode }
): string {
  const hoverOnly = Boolean(opts?.hoverOnly);
  const forceViewport = opts?.forceViewport;
  const baseRules: string[] = [];
  const hoverRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];

  const visit = (list: ElementNode[]) => {
    for (const node of list) {
      const safeId = escapeSelectorAttr(node.id);
      if (safeId) {
        // Specificity (0,3,0) cleanly overrides base/variant classes (.bldr-button.variant-outline, .btn.primary) without !important
        const selector = `.bldr-page-root [data-builder-node="${safeId}"][data-builder-node="${safeId}"]`;

        if (!hoverOnly) {
          const baseDecl = serializeDeclarations(node.styles?.base || {});
          if (baseDecl) {
            baseRules.push(`${selector} { ${baseDecl} }`);
          }
        }

        const hoverDecl = serializeDeclarations(node.styles?.hover || {});
        if (hoverDecl) {
          hoverRules.push(`${selector}:hover { ${hoverDecl} }`);
        }

        if (!hoverOnly) {
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

        if (node.partStyles) {
          for (const [partKey, partResp] of Object.entries(node.partStyles)) {
            const safePart = escapeSelectorAttr(partKey);
            if (!safePart || !partResp) continue;
            const partSelector = `${selector} [data-builder-part="${safePart}"][data-builder-part="${safePart}"]`;
            if (forceViewport) {
              const { resolved } = resolveStylesForViewport(partResp, forceViewport);
              const resolvedDecl = serializeDeclarations(resolved);
              if (resolvedDecl) {
                baseRules.push(`${partSelector} { ${resolvedDecl} }`);
              }
            } else {
              const partBase = serializeDeclarations(partResp.base || {});
              if (partBase) {
                baseRules.push(`${partSelector} { ${partBase} }`);
              }
              const partTablet = serializeDeclarations(partResp.tablet || {});
              if (partTablet) {
                tabletRules.push(`  ${partSelector} { ${partTablet} }`);
              }
              const partMobile = serializeDeclarations(partResp.mobile || {});
              if (partMobile) {
                mobileRules.push(`  ${partSelector} { ${partMobile} }`);
              }
            }
            const partHover = serializeDeclarations(partResp.hover || {});
            if (partHover) {
              hoverRules.push(`${partSelector}:hover { ${partHover} }`);
            }
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

export function compileEditPartCss(
  nodes: ElementNode[],
  viewport: ViewportMode,
  highlight?: {
    selectedPart?: { nodeId: string; partKey: string } | null;
    hoveredPart?: { nodeId: string; partKey: string } | null;
  }
): string {
  const rules: string[] = [];

  const visit = (list: ElementNode[]) => {
    for (const node of list) {
      const safeId = escapeSelectorAttr(node.id);
      if (safeId && node.partStyles) {
        const nodeSelector = `.bldr-page-root [data-editor-node-id="${safeId}"][data-editor-node-id="${safeId}"]`;
        for (const [partKey, partResp] of Object.entries(node.partStyles)) {
          const safePart = escapeSelectorAttr(partKey);
          if (!safePart || !partResp) continue;
          const partSelector = `${nodeSelector} [data-builder-part="${safePart}"][data-builder-part="${safePart}"]`;
          const { resolved } = resolveStylesForViewport(partResp, viewport);
          const decl = serializeDeclarations(resolved);
          if (decl) {
            rules.push(`${partSelector} { ${decl} }`);
          }
          const hoverDecl = serializeDeclarations(partResp.hover || {});
          if (hoverDecl) {
            rules.push(`${partSelector}:hover { ${hoverDecl} }`);
          }
        }
      }
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };

  visit(nodes);

  const hovered = highlight?.hoveredPart;
  const selected = highlight?.selectedPart;
  if (
    hovered &&
    (!selected ||
      hovered.nodeId !== selected.nodeId ||
      hovered.partKey !== selected.partKey)
  ) {
    const hId = escapeSelectorAttr(hovered.nodeId);
    const hPart = escapeSelectorAttr(hovered.partKey);
    if (hId && hPart) {
      rules.push(
        `.bldr-page-root [data-editor-node-id="${hId}"][data-editor-node-id="${hId}"] [data-builder-part="${hPart}"] { outline: 1.5px dashed rgba(91, 70, 232, 0.82); outline-offset: 1px; }`
      );
    }
  }
  if (selected) {
    const sId = escapeSelectorAttr(selected.nodeId);
    const sPart = escapeSelectorAttr(selected.partKey);
    if (sId && sPart) {
      rules.push(
        `.bldr-page-root [data-editor-node-id="${sId}"][data-editor-node-id="${sId}"] [data-builder-part="${sPart}"] { outline: 2px solid #5b46e8; outline-offset: 1px; box-shadow: 0 0 0 3px rgba(91, 70, 232, 0.14); }`
      );
    }
  }

  return rules.join("\n");
}
