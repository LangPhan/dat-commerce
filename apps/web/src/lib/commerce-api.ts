import type { FontUploadResponse } from "@/types/api-cms-ai";
import { apiFetch } from "@/lib/api-client";
import type {
  AdjustStockRequest,
  AnalyticsSummaryDto,
  AttributeDefinitionDto,
  CartResponse,
  CategoryDto,
  CheckoutRequest,
  CollectionDto,
  CreateAttributeRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateProductTypeRequest,
  CreatePromotionRequest,
  DeleteAttributeResponse,
  InventoryLevelDto,
  InventoryOverviewResponse,
  MediaAssetResponse,
  OrderDto,
  ProductDto,
  ProductTypeDto,
  PromotionDto,
  StoreProductListResponse,
  TypeAttributeBindingRequest,
  UpdateAttributeRequest,
  UpdateCategoryRequest,
  UpdateOrderStatusRequest,
  UpdateProductRequest,
  UpdateProductTypeRequest,
  UpdatePromotionRequest,
  UpdateVariantRequest,
  UpsertCollectionRequest,
  VariantDto,
  VariantInput,
} from "@/types/api-commerce";

const CART_SESSION_KEY = "dc_cart_session_token";

function getStoredCartSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(CART_SESSION_KEY);
  } catch {
    return null;
  }
}

function setStoredCartSession(token: string | null | undefined) {
  if (typeof window === "undefined" || !token) return;
  try {
    window.sessionStorage.setItem(CART_SESSION_KEY, token);
  } catch {
    // Ignore storage restriction
  }
}

export function clearStoredCartSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CART_SESSION_KEY);
  } catch {
    // Ignore
  }
}

function cartHeaders(): Record<string, string> | undefined {
  const token = getStoredCartSession();
  return token ? { "X-Cart-Session": token } : undefined;
}

export function getCartSessionHeaders(): Record<string, string> | undefined {
  return cartHeaders();
}

export function syncCartSessionToken(token: string | null | undefined) {
  setStoredCartSession(token);
}

export const adminCatalogApi = {
  listProductTypes: () =>
    apiFetch<ProductTypeDto[]>("/api/v1/admin/product-types"),
  getProductType: (typeId: string) =>
    apiFetch<ProductTypeDto>(`/api/v1/admin/product-types/${typeId}`),
  createProductType: (body: CreateProductTypeRequest) =>
    apiFetch<ProductTypeDto>("/api/v1/admin/product-types", {
      method: "POST",
      body,
    }),
  updateProductType: (typeId: string, body: UpdateProductTypeRequest) =>
    apiFetch<ProductTypeDto>(`/api/v1/admin/product-types/${typeId}`, {
      method: "PATCH",
      body,
    }),
  bindTypeAttribute: (typeId: string, body: TypeAttributeBindingRequest) =>
    apiFetch<ProductTypeDto>(`/api/v1/admin/product-types/${typeId}/attributes`, {
      method: "POST",
      body,
    }),

  listAttributes: (includeArchived = false) =>
    apiFetch<AttributeDefinitionDto[]>(
      `/api/v1/admin/attributes?includeArchived=${includeArchived ? "true" : "false"}`
    ),
  createAttribute: (body: CreateAttributeRequest) =>
    apiFetch<AttributeDefinitionDto>("/api/v1/admin/attributes", {
      method: "POST",
      body,
    }),
  updateAttribute: (attributeId: string, body: UpdateAttributeRequest) =>
    apiFetch<AttributeDefinitionDto>(`/api/v1/admin/attributes/${attributeId}`, {
      method: "PATCH",
      body,
    }),
  deleteAttribute: (attributeId: string) =>
    apiFetch<DeleteAttributeResponse>(`/api/v1/admin/attributes/${attributeId}`, {
      method: "DELETE",
    }),

  listCategories: () => apiFetch<CategoryDto[]>("/api/v1/admin/categories"),
  createCategory: (body: CreateCategoryRequest) =>
    apiFetch<CategoryDto>("/api/v1/admin/categories", {
      method: "POST",
      body,
    }),
  updateCategory: (categoryId: string, body: UpdateCategoryRequest) =>
    apiFetch<CategoryDto>(`/api/v1/admin/categories/${categoryId}`, {
      method: "PATCH",
      body,
    }),
  deleteCategory: (categoryId: string) =>
    apiFetch<void>(`/api/v1/admin/categories/${categoryId}`, {
      method: "DELETE",
    }),

  listCollections: () => apiFetch<CollectionDto[]>("/api/v1/admin/collections"),
  createCollection: (body: UpsertCollectionRequest) =>
    apiFetch<CollectionDto>("/api/v1/admin/collections", {
      method: "POST",
      body,
    }),
  updateCollection: (collectionId: string, body: UpsertCollectionRequest) =>
    apiFetch<CollectionDto>(`/api/v1/admin/collections/${collectionId}`, {
      method: "PATCH",
      body,
    }),
  deleteCollection: (collectionId: string) =>
    apiFetch<void>(`/api/v1/admin/collections/${collectionId}`, {
      method: "DELETE",
    }),

  listProducts: (params?: { q?: string; categoryId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.categoryId) qs.set("categoryId", params.categoryId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<ProductDto[]>(`/api/v1/admin/products${suffix}`);
  },
  getProduct: (productId: string) =>
    apiFetch<ProductDto>(`/api/v1/admin/products/${productId}`),
  createProduct: (body: CreateProductRequest) =>
    apiFetch<ProductDto>("/api/v1/admin/products", {
      method: "POST",
      body,
    }),
  updateProduct: (productId: string, body: UpdateProductRequest) =>
    apiFetch<ProductDto>(`/api/v1/admin/products/${productId}`, {
      method: "PATCH",
      body,
    }),
  deleteProduct: (productId: string) =>
    apiFetch<void>(`/api/v1/admin/products/${productId}`, {
      method: "DELETE",
    }),
  addVariant: (productId: string, body: VariantInput) =>
    apiFetch<VariantDto>(`/api/v1/admin/products/${productId}/variants`, {
      method: "POST",
      body,
    }),
  updateVariant: (variantId: string, body: UpdateVariantRequest) =>
    apiFetch<VariantDto>(`/api/v1/admin/variants/${variantId}`, {
      method: "PATCH",
      body,
    }),
};

export const adminMediaApi = {
  list: () => apiFetch<MediaAssetResponse[]>("/api/v1/admin/media"),
  upload: (file: File, altText?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (altText) {
      form.append("altText", altText);
    }
    return apiFetch<MediaAssetResponse>("/api/v1/admin/media", {
      method: "POST",
      body: form,
    });
  },
  uploadFont: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<FontUploadResponse>("/api/v1/admin/media/fonts", {
      method: "POST",
      body: form,
    });
  },
  remove: (mediaId: string) =>
    apiFetch<void>(`/api/v1/admin/media/${mediaId}`, {
      method: "DELETE",
    }),
};

export const adminInventoryApi = {
  overview: () => apiFetch<InventoryOverviewResponse>("/api/v1/admin/inventory"),
  adjust: (body: AdjustStockRequest) =>
    apiFetch<InventoryLevelDto>("/api/v1/admin/inventory/adjustments", {
      method: "POST",
      body,
    }),
};

export const adminPromotionApi = {
  list: () => apiFetch<PromotionDto[]>("/api/v1/admin/promotions"),
  create: (body: CreatePromotionRequest) =>
    apiFetch<PromotionDto>("/api/v1/admin/promotions", {
      method: "POST",
      body,
    }),
  update: (promotionId: string, body: UpdatePromotionRequest) =>
    apiFetch<PromotionDto>(`/api/v1/admin/promotions/${promotionId}`, {
      method: "PATCH",
      body,
    }),
};

export const adminOrderApi = {
  list: (status?: string) => {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<OrderDto[]>(`/api/v1/admin/orders${suffix}`);
  },
  get: (orderId: string) => apiFetch<OrderDto>(`/api/v1/admin/orders/${orderId}`),
  updateStatus: (orderId: string, body: UpdateOrderStatusRequest) =>
    apiFetch<OrderDto>(`/api/v1/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body,
    }),
  cancel: (orderId: string, reason?: string) =>
    apiFetch<OrderDto>(`/api/v1/admin/orders/${orderId}/cancel`, {
      method: "POST",
      body: reason ? { reason } : {},
    }),
};

export const adminAnalyticsApi = {
  summary: () => apiFetch<AnalyticsSummaryDto>("/api/v1/admin/analytics/summary"),
};

export type StoreListProductsParams = {
  q?: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
  sort?: string;
  page?: number;
  size?: number;
  attrs?: Record<string, string>;
};

export const storeApi = {
  listProducts: (params?: StoreListProductsParams) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.category) qs.set("category", params.category);
    if (params?.brand) qs.set("brand", params.brand);
    if (params?.maxPrice !== undefined && Number.isFinite(params.maxPrice)) {
      qs.set("maxPrice", String(params.maxPrice));
    }
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.page !== undefined) qs.set("page", String(params.page));
    if (params?.size !== undefined) qs.set("size", String(params.size));
    if (params?.attrs) {
      for (const [code, val] of Object.entries(params.attrs)) {
        if (val) {
          qs.set(`attr.${code}`, val);
        }
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<StoreProductListResponse>(`/api/v1/store/products${suffix}`, {
      skipAuthRefresh: true,
    });
  },
  getProduct: (idOrSlug: string) =>
    apiFetch<ProductDto>(`/api/v1/store/products/${encodeURIComponent(idOrSlug)}`, {
      skipAuthRefresh: true,
    }),
  listCategories: () =>
    apiFetch<CategoryDto[]>("/api/v1/store/categories", {
      skipAuthRefresh: true,
    }),
  listCollections: () =>
    apiFetch<CollectionDto[]>("/api/v1/store/collections", {
      skipAuthRefresh: true,
    }),
  getCart: async () => {
    const cart = await apiFetch<CartResponse>("/api/v1/store/cart", {
      headers: cartHeaders(),
      skipAuthRefresh: true,
    });
    setStoredCartSession(cart.sessionToken);
    return cart;
  },
  addCartItem: async (variantId: string, quantity: number) => {
    const cart = await apiFetch<CartResponse>("/api/v1/store/cart/items", {
      method: "POST",
      headers: cartHeaders(),
      body: { variantId, quantity },
      skipAuthRefresh: true,
    });
    setStoredCartSession(cart.sessionToken);
    return cart;
  },
  updateCartItem: async (variantId: string, quantity: number) => {
    const cart = await apiFetch<CartResponse>(`/api/v1/store/cart/items/${variantId}`, {
      method: "PATCH",
      headers: cartHeaders(),
      body: { quantity },
      skipAuthRefresh: true,
    });
    setStoredCartSession(cart.sessionToken);
    return cart;
  },
  removeCartItem: async (variantId: string) => {
    const cart = await apiFetch<CartResponse>(`/api/v1/store/cart/items/${variantId}`, {
      method: "DELETE",
      headers: cartHeaders(),
      skipAuthRefresh: true,
    });
    setStoredCartSession(cart.sessionToken);
    return cart;
  },
  applyPromotion: async (code: string) => {
    const cart = await apiFetch<CartResponse>("/api/v1/store/cart/promotion", {
      method: "POST",
      headers: cartHeaders(),
      body: { code },
      skipAuthRefresh: true,
    });
    setStoredCartSession(cart.sessionToken);
    return cart;
  },
  checkout: async (body: CheckoutRequest, idempotencyKey: string) => {
    const order = await apiFetch<OrderDto>("/api/v1/store/checkout", {
      method: "POST",
      headers: cartHeaders(),
      idempotencyKey,
      body,
      skipAuthRefresh: true,
    });
    return order;
  },
  getOrder: (orderNumber: string) =>
    apiFetch<OrderDto>(`/api/v1/store/orders/${encodeURIComponent(orderNumber)}`, {
      skipAuthRefresh: true,
    }),
};
