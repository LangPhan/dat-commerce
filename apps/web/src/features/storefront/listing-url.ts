export const LISTING_SORT_VALUES = [
  "featured",
  "low",
  "high",
  "rating",
  "newest",
] as const;

export type ListingSort = (typeof LISTING_SORT_VALUES)[number];
export type ListingView = "grid" | "list";

export type ListingUrlState = {
  q: string;
  category: string;
  maxPrice: string;
  sort: ListingSort;
  attrs: Record<string, string>;
  view: ListingView;
  page: number;
};

export type RawSearchParams =
  | URLSearchParams
  | { entries(): IterableIterator<[string, string]> }
  | Record<string, string | string[] | undefined>;

function isIterableParams(
  input: RawSearchParams
): input is { entries(): IterableIterator<[string, string]> } {
  return typeof (input as { entries?: unknown }).entries === "function";
}

function normalizeEntries(input: RawSearchParams): Array<[string, string]> {
  if (isIterableParams(input)) {
    return Array.from(input.entries());
  }
  const out: Array<[string, string]> = [];
  for (const [key, raw] of Object.entries(input)) {
    if (Array.isArray(raw)) {
      if (raw[0] !== undefined) out.push([key, raw[0]]);
    } else if (raw !== undefined) {
      out.push([key, raw]);
    }
  }
  return out;
}

function normalizePositiveNumericString(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? String(num) : "";
}

export function parseListingSearchParams(
  input: RawSearchParams,
  forcedCategory?: string
): ListingUrlState {
  const entries = normalizeEntries(input);
  const map = new Map<string, string>();
  const rawAttrs: Array<[string, string]> = [];

  for (const [key, val] of entries) {
    if (key.startsWith("attr.")) {
      const code = key.slice(5).trim();
      const trimmedVal = val.trim();
      if (code && trimmedVal) {
        rawAttrs.push([code, trimmedVal]);
      }
    } else if (!map.has(key)) {
      map.set(key, val);
    }
  }

  rawAttrs.sort(([a], [b]) => a.localeCompare(b));
  const attrs: Record<string, string> = {};
  for (const [code, val] of rawAttrs) {
    attrs[code] = val;
  }

  const q = (map.get("q") ?? "").trim();
  const rawCategory = (map.get("category") ?? "").trim();
  const category = rawCategory || (forcedCategory ?? "").trim();
  const maxPrice = normalizePositiveNumericString(map.get("maxPrice"));

  const rawSort = (map.get("sort") ?? "").trim();
  const sort: ListingSort = (LISTING_SORT_VALUES as readonly string[]).includes(
    rawSort
  )
    ? (rawSort as ListingSort)
    : "featured";

  const view: ListingView = map.get("view") === "list" ? "list" : "grid";

  const rawPage = (map.get("page") ?? "").trim();
  const parsedPage = /^\d+$/.test(rawPage) ? Number.parseInt(rawPage, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  return {
    q,
    category,
    maxPrice,
    sort,
    attrs,
    view,
    page,
  };
}

export function serializeListingSearchParams(
  state: ListingUrlState,
  options?: { forcedCategory?: string }
): string {
  const qs = new URLSearchParams();
  const q = state.q.trim();
  if (q) qs.set("q", q);

  const category = state.category.trim();
  const forced = (options?.forcedCategory ?? "").trim();
  if (category && category !== forced) {
    qs.set("category", category);
  }

  const maxPrice = normalizePositiveNumericString(state.maxPrice);
  if (maxPrice) qs.set("maxPrice", maxPrice);

  if (state.sort !== "featured") {
    qs.set("sort", state.sort);
  }

  const attrEntries = Object.entries(state.attrs)
    .map(([k, v]) => [k.trim(), v.trim()] as const)
    .filter(([k, v]) => Boolean(k && v))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [code, val] of attrEntries) {
    qs.set(`attr.${code}`, val);
  }

  if (state.view === "list") {
    qs.set("view", "list");
  }

  if (state.page > 1) {
    qs.set("page", String(state.page));
  }

  return qs.toString();
}

export function buildListingHref(
  pathname: string,
  state: ListingUrlState,
  options?: { forcedCategory?: string }
): string {
  const query = serializeListingSearchParams(state, options);
  return query ? `${pathname}?${query}` : pathname;
}

export function areListingStatesEqual(
  a: ListingUrlState,
  b: ListingUrlState
): boolean {
  if (
    a.q !== b.q ||
    a.category !== b.category ||
    a.maxPrice !== b.maxPrice ||
    a.sort !== b.sort ||
    a.view !== b.view ||
    a.page !== b.page
  ) {
    return false;
  }
  const keysA = Object.keys(a.attrs).filter((k) => Boolean(a.attrs[k]));
  const keysB = Object.keys(b.attrs).filter((k) => Boolean(b.attrs[k]));
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a.attrs[k] === b.attrs[k]);
}
