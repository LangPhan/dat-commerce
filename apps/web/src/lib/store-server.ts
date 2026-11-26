import type { StorePageResponse } from "@/types/api-cms-ai";
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

export function fetchStoreProduct(
  idOrSlug: string
): Promise<ProductDto | null> {
  return fetchStoreJson<ProductDto>(
    `/api/v1/store/products/${encodeURIComponent(idOrSlug)}`
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
  const res = await fetchStoreJson<StoreProductListResponse>(
    `/api/v1/store/products?size=${size}`
  );
  return res?.items ?? [];
}
