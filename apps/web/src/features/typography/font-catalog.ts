import type { FontSource, TypographyFontConfig } from "./types";

export type CatalogFontEntry = {
  family: string;
  source: Exclude<FontSource, "custom">;
  category: "sans-serif" | "serif" | "display" | "monospace";
  weights: number[];
  fallback: string;
  variable?: boolean;
};

export const FONT_CATALOG: CatalogFontEntry[] = [
  // Sans-Serif & Geometric (Google Fonts)
  { family: "Inter", source: "google", category: "sans-serif", weights: [300, 400, 500, 600, 700, 800], fallback: "system-ui, -apple-system, sans-serif", variable: true },
  { family: "Plus Jakarta Sans", source: "google", category: "sans-serif", weights: [400, 500, 600, 700, 800], fallback: "sans-serif", variable: true },
  { family: "DM Sans", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Poppins", source: "google", category: "sans-serif", weights: [300, 400, 500, 600, 700, 800], fallback: "sans-serif" },
  { family: "Montserrat", source: "google", category: "sans-serif", weights: [300, 400, 500, 600, 700, 800], fallback: "sans-serif", variable: true },
  { family: "Manrope", source: "google", category: "sans-serif", weights: [400, 500, 600, 700, 800], fallback: "sans-serif", variable: true },
  { family: "Outfit", source: "google", category: "sans-serif", weights: [300, 400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Work Sans", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Lato", source: "google", category: "sans-serif", weights: [300, 400, 700, 900], fallback: "sans-serif" },
  { family: "Open Sans", source: "google", category: "sans-serif", weights: [400, 500, 600, 700, 800], fallback: "sans-serif", variable: true },
  { family: "Roboto", source: "google", category: "sans-serif", weights: [300, 400, 500, 700], fallback: "sans-serif", variable: true },
  { family: "Nunito", source: "google", category: "sans-serif", weights: [400, 500, 600, 700, 800], fallback: "sans-serif", variable: true },
  { family: "Source Sans 3", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Rubik", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Space Grotesk", source: "google", category: "display", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Syne", source: "google", category: "display", weights: [500, 600, 700, 800], fallback: "sans-serif", variable: true },
  { family: "Sora", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Urbanist", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Figtree", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },
  { family: "Geist", source: "google", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "sans-serif", variable: true },

  // Editorial Serif & Display (Google + System Serif)
  { family: "Playfair Display", source: "google", category: "serif", weights: [400, 500, 600, 700, 800], fallback: "Georgia, serif", variable: true },
  { family: "Cormorant Garamond", source: "google", category: "serif", weights: [400, 500, 600, 700], fallback: "Georgia, serif" },
  { family: "Fraunces", source: "google", category: "serif", weights: [400, 500, 600, 700], fallback: "Georgia, serif", variable: true },
  { family: "Lora", source: "google", category: "serif", weights: [400, 500, 600, 700], fallback: "Georgia, serif", variable: true },
  { family: "Merriweather", source: "google", category: "serif", weights: [400, 700, 900], fallback: "Georgia, serif" },
  { family: "Libre Baskerville", source: "google", category: "serif", weights: [400, 700], fallback: "Georgia, serif" },
  { family: "DM Serif Display", source: "google", category: "serif", weights: [400], fallback: "Georgia, serif" },
  { family: "Bodoni Moda", source: "google", category: "serif", weights: [400, 500, 600, 700], fallback: "Georgia, serif", variable: true },
  { family: "EB Garamond", source: "google", category: "serif", weights: [400, 500, 600, 700], fallback: "Georgia, serif", variable: true },
  { family: "Crimson Pro", source: "google", category: "serif", weights: [400, 500, 600, 700], fallback: "Georgia, serif", variable: true },
  { family: "Georgia", source: "system", category: "serif", weights: [400, 700], fallback: '"Times New Roman", serif' },
  { family: "Times New Roman", source: "system", category: "serif", weights: [400, 700], fallback: "Georgia, serif" },

  // Monospace
  { family: "JetBrains Mono", source: "google", category: "monospace", weights: [400, 500, 600, 700], fallback: "ui-monospace, monospace", variable: true },
  { family: "Fira Code", source: "google", category: "monospace", weights: [400, 500, 600, 700], fallback: "ui-monospace, monospace", variable: true },
  { family: "IBM Plex Mono", source: "google", category: "monospace", weights: [400, 500, 600, 700], fallback: "monospace" },
  { family: "Space Mono", source: "google", category: "monospace", weights: [400, 700], fallback: "monospace" },
  { family: "Source Code Pro", source: "google", category: "monospace", weights: [400, 500, 600, 700], fallback: "monospace", variable: true },

  // System UI & Classic System Fonts
  { family: "System UI", source: "system", category: "sans-serif", weights: [400, 500, 600, 700], fallback: "-apple-system, BlinkMacSystemFont, sans-serif" },
  { family: "Arial", source: "system", category: "sans-serif", weights: [400, 700], fallback: "Helvetica, sans-serif" },
  { family: "Helvetica", source: "system", category: "sans-serif", weights: [400, 700], fallback: "Arial, sans-serif" },
  { family: "Verdana", source: "system", category: "sans-serif", weights: [400, 700], fallback: "sans-serif" },
  { family: "Trebuchet MS", source: "system", category: "sans-serif", weights: [400, 700], fallback: "sans-serif" },
  { family: "Courier New", source: "system", category: "monospace", weights: [400, 700], fallback: "monospace" },
];

export const BUILTIN_FONT_NAMES = FONT_CATALOG.map((f) => f.family);

export function findCatalogFont(family: string): CatalogFontEntry | undefined {
  const clean = family.trim().toLowerCase();
  return FONT_CATALOG.find((f) => f.family.toLowerCase() === clean);
}

export function searchFontCatalog(
  query: string,
  filter?: "all" | "google" | "system"
): CatalogFontEntry[] {
  const q = query.trim().toLowerCase();
  return FONT_CATALOG.filter((entry) => {
    if (filter && filter !== "all" && entry.source !== filter) {
      return false;
    }
    if (!q) return true;
    return (
      entry.family.toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q)
    );
  });
}

export function buildGoogleFontsHref(
  fonts: Array<Pick<TypographyFontConfig, "family" | "source" | "weights" | "style">>
): string | null {
  const byFamily = new Map<string, { weights: Set<number>; hasItalic: boolean }>();
  for (const font of fonts) {
    if (font.source !== "google" || !font.family) continue;
    const cat = findCatalogFont(font.family);
    const allowedWeights = new Set(cat?.weights || [400, 500, 600, 700]);
    const entry = byFamily.get(font.family) || {
      weights: new Set<number>(),
      hasItalic: false,
    };
    for (const w of font.weights?.length ? font.weights : [400, 600, 700]) {
      if (allowedWeights.has(w)) {
        entry.weights.add(w);
      }
    }
    if (!entry.weights.size) {
      for (const w of cat?.weights || [400, 700]) {
        entry.weights.add(w);
      }
    }
    if (font.style === "italic") {
      entry.hasItalic = true;
    }
    byFamily.set(font.family, entry);
  }

  if (!byFamily.size) return null;

  const params: string[] = [];
  for (const [family, info] of Array.from(byFamily.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const sortedWeights = Array.from(info.weights).sort((a, b) => a - b);
    const encoded = family.trim().replace(/\s+/g, "+");
    if (info.hasItalic) {
      const tuples = [
        ...sortedWeights.map((w) => `0,${w}`),
        ...sortedWeights.map((w) => `1,${w}`),
      ];
      params.push(`family=${encoded}:ital,wght@${tuples.join(";")}`);
    } else {
      params.push(`family=${encoded}:wght@${sortedWeights.join(";")}`);
    }
  }

  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}
