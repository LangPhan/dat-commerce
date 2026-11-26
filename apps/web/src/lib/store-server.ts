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

const SERVER_FETCH_TIMEOUT_MS = 2500;
const REVALIDATE_SECONDS = 60;

async function fetchStoreJson<T>(path: string): Promise<T | null> {
  const baseUrl = getApiInternalUrl();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
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

export function fetchStorePage(slug: string): Promise<StorePageResponse | null> {
  return fetchStoreJson<StorePageResponse>(
    `/api/v1/store/pages/${encodeURIComponent(slug)}`
  );
}

export async function fetchStorePublishedPages(): Promise<StorePageSummaryDto[]> {
  return (await fetchStoreJson<StorePageSummaryDto[]>("/api/v1/store/pages")) ?? [];
}

export function fetchStoreTheme(): Promise<ThemeVersionDto | null> {
  return fetchStoreJson<ThemeVersionDto>("/api/v1/store/theme");
}

export function fetchStoreNavigation(
  menuKey = "main"
): Promise<NavigationMenuDto | null> {
  return fetchStoreJson<NavigationMenuDto>(
    `/api/v1/store/navigation/${encodeURIComponent(menuKey)}`
  );
}

export async function fetchStoreAnimationPresets(): Promise<AnimationPresetDto[]> {
  return (
    (await fetchStoreJson<AnimationPresetDto[]>("/api/v1/store/animation-presets")) ??
    []
  );
}

export function fetchStoreProduct(
  idOrSlug: string
): Promise<ProductDto | null> {
  return fetchStoreJson<ProductDto>(
    `/api/v1/store/products/${encodeURIComponent(idOrSlug)}`
  );
}

export async function fetchStoreProducts(params?: {
  size?: number;
  category?: string;
  q?: string;
}): Promise<StoreProductListResponse | null> {
  const qs = new URLSearchParams();
  if (params?.size) qs.set("size", String(params.size));
  if (params?.category) qs.set("category", params.category);
  if (params?.q) qs.set("q", params.q);
  const query = qs.toString();
  return fetchStoreJson<StoreProductListResponse>(
    `/api/v1/store/products${query ? `?${query}` : ""}`
  );
}

export async function fetchStoreCategories(): Promise<CategoryDto[]> {
  return (await fetchStoreJson<CategoryDto[]>("/api/v1/store/categories")) ?? [];
}

export async function fetchStoreCollections(): Promise<CollectionDto[]> {
  return (
    (await fetchStoreJson<CollectionDto[]>("/api/v1/store/collections")) ?? []
  );
}

export async function fetchStoreProductsForSitemap(
  size = 100
): Promise<ProductDto[]> {
  const res = await fetchStoreProducts({ size });
  return res?.items ?? [];
}
