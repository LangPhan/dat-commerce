import type { CSSProperties } from "react";
import { MEDIA_QUERIES } from "./breakpoints";
import { sanitizeStyleValues } from "./sanitizers";
import type {
  ElementNode,
  ElementType,
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

function assignStyleMap(
  target: Record<string, string | number>,
  map?: StyleValues,
  alreadySanitized = false
) {
  if (!map) return;
  const clean = alreadySanitized
    ? map
    : sanitizeStyleValues(map as Record<string, unknown>);
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
  const resolved: StyleValues = { ...base };
  const overriddenKeys = new Set<StylePropertyKey>();

  if (viewport === "tablet" || viewport === "mobile") {
    const tablet = styles?.tablet
      ? sanitizeStyleValues(styles.tablet as Record<string, unknown>)
      : null;
    if (tablet) {
      for (const [k, v] of Object.entries(tablet)) {
        if (v !== undefined) {
          resolved[k as StylePropertyKey] = v;
          if (viewport === "tablet") {
            overriddenKeys.add(k as StylePropertyKey);
          }
        }
      }
    }
  }

  if (viewport === "mobile") {
    const mobile = styles?.mobile
      ? sanitizeStyleValues(styles.mobile as Record<string, unknown>)
      : null;
    if (mobile) {
      for (const [k, v] of Object.entries(mobile)) {
        if (v !== undefined) {
          resolved[k as StylePropertyKey] = v;
          overriddenKeys.add(k as StylePropertyKey);
        }
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
  assignStyleMap(cssObj, resolved, true);
  return cssObj as CSSProperties;
}

const WRAPPER_HOIST_KEYS: readonly (keyof CSSProperties)[] = [
  "width",
  "minWidth",
  "maxWidth",
  "flexGrow",
  "flexShrink",
  "alignSelf",
  "gridColumn",
  "gridRow",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
];

const FULL_WIDTH_INTRINSIC_TYPES = new Set<ElementType>([
  "promotion_banner",
  "divider",
]);

/**
 * Splits a node's compiled style into outer wrapper styles (flex/grid placement,
 * outer width, margins, positioning) and inner element styles so edit/DnD
 * wrappers preserve exact flex/grid sizing fidelity with live rendering without
 * double-applying margins or percentage widths.
 */
export function splitEditWrapperStyles(
  compiledStyle: CSSProperties,
  nodeType?: ElementType
): {
  wrapperStyle: CSSProperties;
  elementStyle: CSSProperties;
} {
  const elementStyle: Record<string, unknown> = { ...compiledStyle };
  const wrapperStyle: Record<string, unknown> = {};

  for (const key of WRAPPER_HOIST_KEYS) {
    const val = elementStyle[key as string];
    if (val !== undefined) {
      wrapperStyle[key as string] = val;
      delete elementStyle[key as string];
    }
  }

  if (compiledStyle.width !== undefined) {
    elementStyle.width = "100%";
  }
  if (compiledStyle.maxWidth !== undefined) {
    elementStyle.maxWidth = "100%";
  }
  if (compiledStyle.minWidth !== undefined) {
    elementStyle.minWidth = "100%";
  }
  if (compiledStyle.height === "100%") {
    wrapperStyle.height = "100%";
  }

  if (
    nodeType &&
    FULL_WIDTH_INTRINSIC_TYPES.has(nodeType) &&
    wrapperStyle.width === undefined &&
    wrapperStyle.flexGrow === undefined
  ) {
    wrapperStyle.width = "100%";
  }

  return {
    wrapperStyle: wrapperStyle as CSSProperties,
    elementStyle: elementStyle as CSSProperties,
  };
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

const CAMEL_UPPER_RE = /[A-Z]/g;
const UNSAFE_SELECTOR_ATTR_RE = /[^A-Za-z0-9_-]/g;
const KEBAB_CACHE = new Map<string, string>();

function toKebabCase(camel: string): string {
  const cached = KEBAB_CACHE.get(camel);
  if (cached !== undefined) return cached;
  const kebab = camel.replace(CAMEL_UPPER_RE, (m) => `-${m.toLowerCase()}`);
  KEBAB_CACHE.set(camel, kebab);
  return kebab;
}

function serializeDeclarations(map: StyleValues, alreadySanitized = false): string {
  const clean = alreadySanitized
    ? map
    : sanitizeStyleValues(map as Record<string, unknown>);
  const entries = Object.entries(clean);
  if (!entries.length) return "";
  let out = "";
  for (let i = 0; i < entries.length; i += 1) {
    const [k, v] = entries[i];
    if (i > 0) out += " ";
    out += `${toKebabCase(k)}: ${v};`;
  }
  return out;
}

function escapeSelectorAttr(id: string): string {
  return id.replace(UNSAFE_SELECTOR_ATTR_RE, "");
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
              baseRules.push(`@media ${MEDIA_QUERIES.desktop} { ${selector} { display: none !important; } }`);
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
    sections.push(`@media ${MEDIA_QUERIES.tablet} {\n${tabletRules.join("\n")}\n}`);
  }
  if (mobileRules.length) {
    sections.push(`@media ${MEDIA_QUERIES.mobile} {\n${mobileRules.join("\n")}\n}`);
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
          const decl = serializeDeclarations(resolved, true);
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

  const highlightCss = compileEditHighlightCss(highlight);
  if (highlightCss) {
    rules.push(highlightCss);
  }

  return rules.join("\n");
}

export function compileEditHighlightCss(highlight?: {
  selectedPart?: { nodeId: string; partKey: string } | null;
  hoveredPart?: { nodeId: string; partKey: string } | null;
}): string {
  const rules: string[] = [];
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
