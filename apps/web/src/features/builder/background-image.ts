export type PresetMediaAsset = {
  id: string;
  name: string;
  url: string;
  category: string;
};

export const STORE_PRESET_MEDIA_ASSETS: PresetMediaAsset[] = [
  {
    id: "preset-terrain-hero",
    name: "Terrain Trail Hero",
    url: "/media/terrain-hero.jpg",
    category: "Hero & Landscape",
  },
  {
    id: "preset-jacket",
    name: "Alpine Shell Jacket",
    url: "/media/jacket.jpg",
    category: "Apparel",
  },
  {
    id: "preset-pack",
    name: "Technical Field Pack",
    url: "/media/pack.jpg",
    category: "Packs & Gear",
  },
  {
    id: "preset-shoe-olive",
    name: "Ridge Runner Olive",
    url: "/media/shoe-olive.jpg",
    category: "Footwear",
  },
  {
    id: "preset-shoe-red",
    name: "Trail Shoe Crimson",
    url: "/media/shoe-red.jpg",
    category: "Footwear",
  },
  {
    id: "preset-shoe-white",
    name: "Studio Runner White",
    url: "/media/shoe-white.jpg",
    category: "Footwear",
  },
  {
    id: "preset-watch",
    name: "Field Titanium Watch",
    url: "/media/watch.jpg",
    category: "Hardware",
  },
  {
    id: "preset-terrain-fallback",
    name: "Terrain Studio Backdrop",
    url: "/media/terrain-fallback.jpg",
    category: "Editorial",
  },
];

export type ParsedBackgroundImage = {
  imageUrl: string;
  imageOpacity: number;
  overlayColor: string;
  rawGradientOnly: string;
};

const HEX6_RE = /^#[0-9A-Fa-f]{6}$/;

export function sanitizeBackgroundImageUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) return "";
  if (/[;{}()\r\n'"]/.test(trimmed)) return "";
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:")
  ) {
    return "";
  }
  if (
    trimmed.startsWith("/") ||
    lower.startsWith("https://") ||
    lower.startsWith("http://")
  ) {
    return trimmed;
  }
  return "";
}

function normalizeOverlayHex(raw: string | undefined, fallback = "#111318"): string {
  const candidate = (raw || "").trim();
  return HEX6_RE.test(candidate) ? candidate.toUpperCase() : fallback;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = [clampByte(r), clampByte(g), clampByte(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const safe = normalizeOverlayHex(hex).slice(1);
  return [
    parseInt(safe.slice(0, 2), 16),
    parseInt(safe.slice(2, 4), 16),
    parseInt(safe.slice(4, 6), 16),
  ];
}

export function parseBackgroundImage(
  backgroundImage?: string,
  fallbackOverlayColor = "#111318"
): ParsedBackgroundImage {
  const safeFallback = normalizeOverlayHex(fallbackOverlayColor);
  const raw = (backgroundImage || "").trim();
  if (!raw || raw === "none") {
    return {
      imageUrl: "",
      imageOpacity: 1,
      overlayColor: safeFallback,
      rawGradientOnly: "",
    };
  }

  const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/i;
  const urlMatch = urlRegex.exec(raw);
  if (!urlMatch) {
    return {
      imageUrl: "",
      imageOpacity: 1,
      overlayColor: safeFallback,
      rawGradientOnly: raw,
    };
  }

  const imageUrl = sanitizeBackgroundImageUrl(urlMatch[2]);
  if (!imageUrl) {
    return {
      imageUrl: "",
      imageOpacity: 1,
      overlayColor: safeFallback,
      rawGradientOnly: "",
    };
  }

  const prefix = raw.slice(0, urlMatch.index);
  const rgbaMatches = Array.from(
    prefix.matchAll(
      /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+|\.\d+))?\s*\)/gi
    )
  );

  if (rgbaMatches.length === 0) {
    return {
      imageUrl,
      imageOpacity: 1,
      overlayColor: safeFallback,
      rawGradientOnly: "",
    };
  }

  let alphaSum = 0;
  for (const m of rgbaMatches) {
    const a = m[4] !== undefined ? Number(m[4]) : 1;
    alphaSum += Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1;
  }
  const avgAlpha = alphaSum / rgbaMatches.length;
  const imageOpacity = Math.max(
    0,
    Math.min(1, Math.round((1 - avgAlpha) * 100) / 100)
  );
  const first = rgbaMatches[0];
  const overlayColor = rgbToHex(
    Number(first[1]),
    Number(first[2]),
    Number(first[3])
  );

  return {
    imageUrl,
    imageOpacity,
    overlayColor,
    rawGradientOnly: "",
  };
}

export function buildBackgroundImageCss({
  imageUrl,
  imageOpacity = 1,
  overlayColor = "#111318",
}: {
  imageUrl: string;
  imageOpacity?: number;
  overlayColor?: string;
}): string {
  const safeUrl = sanitizeBackgroundImageUrl(imageUrl);
  if (!safeUrl) return "";

  const clampedOpacity = Number.isFinite(imageOpacity)
    ? Math.max(0, Math.min(1, imageOpacity))
    : 1;

  if (clampedOpacity >= 0.995) {
    return `url(${safeUrl})`;
  }

  const overlayAlpha = Number((1 - clampedOpacity).toFixed(2));
  const [r, g, b] = hexToRgb(overlayColor);
  const rgba = `rgba(${r},${g},${b},${overlayAlpha})`;
  return `linear-gradient(${rgba}, ${rgba}), url(${safeUrl})`;
}
