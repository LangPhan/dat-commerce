import type { BrandPaletteColor, ThemeTokens } from "@/types/api-cms-ai";

export type BrandPaletteOption = {
  id: string;
  name: string;
  hex: string;
  isCustom: boolean;
  tokenKey?: keyof ThemeTokens["colors"];
};

const CORE_PALETTE_DEFS: {
  id: string;
  tokenKey: keyof ThemeTokens["colors"];
  name: string;
  fallback: string;
}[] = [
  { id: "primary", tokenKey: "primary", name: "Primary", fallback: "#5B46E8" },
  { id: "secondary", tokenKey: "secondary", name: "Secondary", fallback: "#1F2937" },
  { id: "accent", tokenKey: "accent", name: "Accent", fallback: "#18794E" },
  { id: "background", tokenKey: "background", name: "Background", fallback: "#FFFFFF" },
  { id: "surface", tokenKey: "surface", name: "Surface", fallback: "#F8FAFC" },
  { id: "text", tokenKey: "text", name: "Text", fallback: "#111318" },
  { id: "muted", tokenKey: "muted", name: "Muted", fallback: "#5C6270" },
  { id: "border", tokenKey: "border", name: "Border", fallback: "#E5E7EB" },
];

const RESERVED_CORE_IDS = new Set(CORE_PALETTE_DEFS.map((d) => d.id));
const HEX6_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHexColor(raw: string, fallback = "#5B46E8"): string {
  const trimmed = raw.trim();
  return HEX6_RE.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

export function isValidHex6(raw: string): boolean {
  return HEX6_RE.test(raw.trim());
}

export function getBrandPaletteOptions(
  tokens?: ThemeTokens | null
): BrandPaletteOption[] {
  const core: BrandPaletteOption[] = CORE_PALETTE_DEFS.map((def) => ({
    id: def.id,
    tokenKey: def.tokenKey,
    name: def.name,
    hex: normalizeHexColor(tokens?.colors?.[def.tokenKey] || def.fallback, def.fallback),
    isCustom: false,
  }));

  const custom: BrandPaletteOption[] = (tokens?.customPalette || [])
    .filter((item) => item && isValidHex6(item.hex) && item.name.trim().length > 0)
    .map((item) => ({
      id: item.id,
      name: item.name.trim(),
      hex: normalizeHexColor(item.hex),
      isCustom: true,
    }));

  return [...core, ...custom];
}

export function createCustomPaletteColor(
  name: string,
  hex: string,
  existing: BrandPaletteColor[]
): BrandPaletteColor {
  const cleanName = name.trim().slice(0, 32) || "Brand Color";
  const cleanHex = normalizeHexColor(hex);
  const rawSlug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const baseId = rawSlug || "swatch";

  const taken = new Set<string>([
    ...Array.from(RESERVED_CORE_IDS),
    ...existing.map((c) => c.id),
  ]);

  let uniqueId = baseId;
  let suffix = 2;
  while (taken.has(uniqueId)) {
    const suffixText = `-${suffix}`;
    const keep = Math.max(1, 40 - suffixText.length);
    uniqueId = `${baseId.slice(0, keep)}${suffixText}`;
    suffix++;
  }

  return {
    id: uniqueId,
    name: cleanName,
    hex: cleanHex,
  };
}
