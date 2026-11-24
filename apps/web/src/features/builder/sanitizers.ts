import type { StylePropertyKey, StyleValues } from "./types";

const ALLOWED_STYLE_KEYS: ReadonlySet<string> = new Set<StylePropertyKey>([
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "alignSelf",
  "flexWrap",
  "flexGrow",
  "flexShrink",
  "gap",
  "rowGap",
  "columnGap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridColumn",
  "gridRow",
  "width",
  "minWidth",
  "maxWidth",
  "height",
  "minHeight",
  "maxHeight",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "overflow",
  "textAlign",
  "color",
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "backgroundAttachment",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontStretch",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textDecoration",
  "textShadow",
  "textIndent",
  "textWrap",
  "textOverflow",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "borderRadius",
  "boxShadow",
  "opacity",
  "aspectRatio",
  "objectFit",
  "objectPosition",
  "cursor",
]);

const UNSAFE_CSS_VALUE =
  /(expression\s*\(|javascript:|vbscript:|behavior\s*:|@import|<|>|\{|\}|;)/i;

const DANGEROUS_HTML_RE =
  /<\s*(script|iframe|object|embed|style|link|meta|base)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|>)|<\s*\/?\s*(script|iframe|object|embed|style|link|meta|base)\b[^>]*>/gi;

const EVENT_ATTR_DOUBLE = /\s+on[a-z]{2,}\s*=\s*"[^"]*"/gi;
const EVENT_ATTR_SINGLE = /\s+on[a-z]{2,}\s*=\s*'[^']*'/gi;
const EVENT_ATTR_BARE = /\s+on[a-z]{2,}\s*=\s*[^\s>]+/gi;
const UNSAFE_HREF_SRC =
  /(href|src)\s*=\s*(["'])\s*(?:javascript:|vbscript:|data\s*:\s*text\/html)[^"']*\2/gi;

export function sanitizeUrl(raw: unknown, fallback = "#"): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) return fallback;
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  return fallback;
}

export function sanitizeMediaUrl(
  raw: unknown,
  fallback = "/media/terrain-fallback.jpg"
): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) return fallback;
  if (
    trimmed.startsWith("/media/") ||
    trimmed.startsWith("/storage/") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  return fallback;
}

export function sanitizeCssValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (UNSAFE_CSS_VALUE.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeStyleValues(
  raw: Record<string, unknown> | undefined | null
): StyleValues {
  const clean: StyleValues = {};
  if (!raw || typeof raw !== "object") return clean;
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_STYLE_KEYS.has(key)) continue;
    const safeVal = sanitizeCssValue(value);
    if (safeVal !== null) {
      clean[key as StylePropertyKey] = safeVal;
    }
  }
  return clean;
}

export function sanitizeCssClasses(raw: string[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  const valid: string[] = [];
  const seen = new Set<string>();
  for (const cls of raw) {
    const trimmed = typeof cls === "string" ? cls.trim() : "";
    if (/^[A-Za-z0-9_-]{1,64}$/.test(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
      valid.push(trimmed);
    }
  }
  return valid;
}

export function sanitizeHtmlAttributes(
  raw: Record<string, string> | undefined
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const attr = k.trim().toLowerCase();
    if (!/^(aria-[a-z0-9-]+|data-[a-z0-9-]+|role|id|title|tabindex)$/.test(attr)) {
      continue;
    }
    const strVal = String(v ?? "").slice(0, 200);
    if (/(javascript:|vbscript:)/i.test(strVal)) continue;
    clean[attr] = strVal;
  }
  return clean;
}

export function sanitizeHtmlSubset(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(DANGEROUS_HTML_RE, "")
    .replace(EVENT_ATTR_DOUBLE, "")
    .replace(EVENT_ATTR_SINGLE, "")
    .replace(EVENT_ATTR_BARE, "")
    .replace(UNSAFE_HREF_SRC, '$1="#"');
}

export function isValidCssClass(cls: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(cls);
}
