import { cache } from "react";
import type { ResolvedStorefrontExperienceDto } from "@/features/experiences/types";
import type {
  AnimationPresetDto,
  NavigationMenuDto,
  StorePageResponse,
  StorePageSummaryDto,
  ThemeVersionDto,
} from "@/types/api-cms-ai";
import type {
  CategoryDto,
  CollectionDto,
  ProductDto,
  StoreProductListResponse,
} from "@/types/api-commerce";
import { getApiInternalUrl } from "./site-url";
import { STORE_CACHE_TAGS } from "./store-cache-tags";

const SERVER_FETCH_TIMEOUT_MS = 2500;
const REVALIDATE_SECONDS = 60;

async function fetchStoreJson<T>(
  path: string,
  options?: { revalidate?: number; tags?: string[] }
): Promise<T | null> {
  const baseUrl = getApiInternalUrl();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      next: {
        revalidate: options?.revalidate ?? REVALIDATE_SECONDS,
        ...(options?.tags?.length ? { tags: options.tags } : {}),
      },
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const fetchStorePage = cache(
  (slug: string): Promise<StorePageResponse | null> =>
    fetchStoreJson<StorePageResponse>(
      `/api/v1/store/pages/${encodeURIComponent(slug)}`,
      {
        revalidate: REVALIDATE_SECONDS,
        tags: [STORE_CACHE_TAGS.pages, STORE_CACHE_TAGS.page(slug)],
      }
    )
);

export const fetchStorePublishedPages = cache(
  async (): Promise<StorePageSummaryDto[]> =>
    (await fetchStoreJson<StorePageSummaryDto[]>("/api/v1/store/pages", {
      revalidate: REVALIDATE_SECONDS,
      tags: [STORE_CACHE_TAGS.pages],
    })) ?? []
);

export const fetchStoreTheme = cache((): Promise<ThemeVersionDto | null> =>
  fetchStoreJson<ThemeVersionDto>("/api/v1/store/theme", {
    revalidate: REVALIDATE_SECONDS,
    tags: [STORE_CACHE_TAGS.theme],
  })
);

export const fetchStoreActiveExperience = cache(
  (): Promise<ResolvedStorefrontExperienceDto | null> =>
    fetchStoreJson<ResolvedStorefrontExperienceDto>(
      "/api/v1/store/experiences/active",
      {
        revalidate: 30,
        tags: [STORE_CACHE_TAGS.experience],
      }
    )
);

export const fetchStoreNavigation = cache(
  (menuKey = "main"): Promise<NavigationMenuDto | null> =>
    fetchStoreJson<NavigationMenuDto>(
      `/api/v1/store/navigation/${encodeURIComponent(menuKey)}`,
      {
        revalidate: REVALIDATE_SECONDS,
        tags: [STORE_CACHE_TAGS.navigation],
      }
    )
);

export const fetchStoreAnimationPresets = cache(
  async (): Promise<AnimationPresetDto[]> =>
    (await fetchStoreJson<AnimationPresetDto[]>(
      "/api/v1/store/animation-presets",
      {
        revalidate: REVALIDATE_SECONDS,
        tags: [STORE_CACHE_TAGS.presets],
      }
    )) ?? []
);

export const fetchStoreProduct = cache(
  (idOrSlug: string): Promise<ProductDto | null> =>
    fetchStoreJson<ProductDto>(
      `/api/v1/store/products/${encodeURIComponent(idOrSlug)}`,
      {
        revalidate: REVALIDATE_SECONDS,
        tags: [STORE_CACHE_TAGS.catalog],
      }
    )
);

const fetchStoreProductsByQuery = cache(
  (query: string): Promise<StoreProductListResponse | null> =>
    fetchStoreJson<StoreProductListResponse>(
      `/api/v1/store/products${query ? `?${query}` : ""}`,
      {
        revalidate: REVALIDATE_SECONDS,
        tags: [STORE_CACHE_TAGS.catalog],
      }
    )
);

export function fetchStoreProducts(params?: {
  q?: string;
  category?: string;
  maxPrice?: number;
  sort?: string;
  page?: number;
  size?: number;
  attrs?: Record<string, string>;
}): Promise<StoreProductListResponse | null> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.category) qs.set("category", params.category);
  if (params?.maxPrice !== undefined && Number.isFinite(params.maxPrice)) {
    qs.set("maxPrice", String(params.maxPrice));
  }
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.page !== undefined) qs.set("page", String(params.page));
  if (params?.size !== undefined) qs.set("size", String(params.size));
  if (params?.attrs) {
    for (const [code, val] of Object.entries(params.attrs).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      if (val) qs.set(`attr.${code}`, val);
    }
  }
  return fetchStoreProductsByQuery(qs.toString());
}

export const fetchStoreCategories = cache(
  async (): Promise<CategoryDto[]> =>
    (await fetchStoreJson<CategoryDto[]>("/api/v1/store/categories", {
      revalidate: REVALIDATE_SECONDS,
      tags: [STORE_CACHE_TAGS.categories],
    })) ?? []
);

export const fetchStoreCollections = cache(
  async (): Promise<CollectionDto[]> =>
    (await fetchStoreJson<CollectionDto[]>("/api/v1/store/collections", {
      revalidate: REVALIDATE_SECONDS,
      tags: [STORE_CACHE_TAGS.collections],
    })) ?? []
);

export async function fetchStoreProductsForSitemap(
  size = 100
): Promise<ProductDto[]> {
  const res = await fetchStoreProducts({ size });
  return res?.items ?? [];
}
