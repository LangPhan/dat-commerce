export type AttributeDataType =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "ENUM"
  | "MULTI_SELECT";

export type VariantOptionDefRequest = {
  code: string;
  name: string;
  sortOrder?: number;
};

export type TypeAttributeBindingRequest = {
  attributeDefinitionId: string;
  displayOrder?: number;
  requiredOverride?: boolean | null;
};

export type CreateProductTypeRequest = {
  code: string;
  name: string;
  description?: string;
  attributes?: TypeAttributeBindingRequest[];
  variantOptions?: VariantOptionDefRequest[];
};

export type UpdateProductTypeRequest = {
  name?: string;
  description?: string;
  attributes?: TypeAttributeBindingRequest[];
  variantOptions?: VariantOptionDefRequest[];
};

export type AttributeOptionDto = {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
};

export type AttributeOptionRequest = {
  value: string;
  label: string;
  sortOrder?: number;
};

export type TypeAttributeDto = {
  attributeDefinitionId: string;
  code: string;
  name: string;
  dataType: AttributeDataType | string;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  unit?: string | null;
  validationRules: Record<string, unknown>;
  options: AttributeOptionDto[];
  displayOrder: number;
  requiredOverride?: boolean | null;
  archived: boolean;
};

export type VariantOptionDefDto = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type ProductTypeDto = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  attributes: TypeAttributeDto[];
  variantOptions: VariantOptionDefDto[];
  updatedAt: string;
};

export type CreateAttributeRequest = {
  code: string;
  name: string;
  dataType: AttributeDataType;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  unit?: string;
  validationRules?: Record<string, unknown>;
  options?: AttributeOptionRequest[];
};

export type UpdateAttributeRequest = {
  name?: string;
  required?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  unit?: string;
  validationRules?: Record<string, unknown>;
  options?: AttributeOptionRequest[];
  archived?: boolean;
};

export type AttributeDefinitionDto = {
  id: string;
  code: string;
  name: string;
  dataType: AttributeDataType | string;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  unit?: string | null;
  validationRules: Record<string, unknown>;
  options: AttributeOptionDto[];
  archivedAt?: string | null;
  updatedAt: string;
};

export type DeleteAttributeResponse = {
  id: string;
  archived: boolean;
  archivedAt?: string | null;
};

export type CreateCategoryRequest = {
  name: string;
  slug?: string;
  parentId?: string | null;
  description?: string;
  seoDescription?: string;
  imageUrl?: string;
  defaultProductTypeId?: string | null;
};

export type UpdateCategoryRequest = {
  name?: string;
  slug?: string;
  parentId?: string | null;
  clearParent?: boolean;
  description?: string;
  seoDescription?: string;
  imageUrl?: string;
  defaultProductTypeId?: string | null;
};

export type CategoryDto = {
  id: string;
  parentId?: string | null;
  slug: string;
  name: string;
  description?: string | null;
  seoDescription?: string | null;
  imageUrl?: string | null;
  defaultProductTypeId?: string | null;
  productCount: number;
  updatedAt: string;
};

export type UpsertCollectionRequest = {
  name: string;
  slug?: string;
  description?: string;
  productIds?: string[];
};

export type CollectionDto = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  productIds: string[];
  updatedAt: string;
};

export type VariantInput = {
  id?: string;
  sku: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  options?: Record<string, string>;
  status?: string;
};

export type UpdateVariantRequest = {
  sku?: string;
  title?: string;
  price?: number;
  compareAtPrice?: number | null;
  status?: string;
  options?: Record<string, string>;
};

export type ProductImageInput = {
  mediaAssetId?: string | null;
  url: string;
  altText?: string;
};

export type CreateProductRequest = {
  productTypeId: string;
  name: string;
  slug?: string;
  brand?: string;
  description?: string;
  status?: string;
  primaryImageUrl?: string;
  images?: ProductImageInput[];
  seoTitle?: string;
  seoDescription?: string;
  categoryIds?: string[];
  attributes?: Record<string, unknown>;
  variants: VariantInput[];
};

export type UpdateProductRequest = {
  productTypeId?: string;
  confirmDropIncompatibleAttributes?: boolean;
  name?: string;
  slug?: string;
  brand?: string;
  description?: string;
  status?: string;
  primaryImageUrl?: string;
  images?: ProductImageInput[];
  seoTitle?: string;
  seoDescription?: string;
  categoryIds?: string[];
  attributes?: Record<string, unknown>;
  expectedVersion?: number;
};

export type VariantDto = {
  id: string;
  sku: string;
  title: string;
  status: string;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  availableStock: number;
  options: Record<string, string>;
  version: number;
};

export type ProductAttributeDto = {
  definitionId: string;
  code: string;
  name: string;
  dataType: AttributeDataType | string;
  unit?: string | null;
  value: unknown;
  displayValue: string;
  filterable: boolean;
  searchable: boolean;
};

export type ProductImageDto = {
  id: string;
  mediaAssetId?: string | null;
  url: string;
  altText?: string | null;
  sortOrder: number;
};

export type CategoryRefDto = {
  id: string;
  slug: string;
  name: string;
};

export type ProductDto = {
  id: string;
  productTypeId: string;
  productTypeName: string;
  productTypeCode: string;
  slug: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  status: string;
  primaryImageUrl?: string | null;
  images: ProductImageDto[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  rating: number;
  reviewCount: number;
  minPrice: number;
  maxPrice: number;
  compareAtPrice?: number | null;
  totalStock: number;
  categories: CategoryRefDto[];
  attributes: ProductAttributeDto[];
  variants: VariantDto[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FacetDto = {
  code: string;
  name: string;
  dataType: AttributeDataType | string;
  unit?: string | null;
  values: string[];
};

export type StoreProductListResponse = {
  items: ProductDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  facets: FacetDto[];
};

export type MediaAssetResponse = {
  id: string;
  storageKey: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  altText?: string | null;
  createdAt: string;
};

export type LocationDto = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
};

export type InventoryLevelDto = {
  id: string;
  variantId: string;
  sku: string;
  stockLocationId: string;
  locationName: string;
  stockedQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  version: number;
  updatedAt: string;
};

export type AdjustmentDto = {
  id: string;
  inventoryLevelId: string;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  actorEmail: string;
  createdAt: string;
};

export type InventoryOverviewResponse = {
  locations: LocationDto[];
  levels: InventoryLevelDto[];
  recentAdjustments: AdjustmentDto[];
};

export type AdjustStockRequest = {
  variantId: string;
  stockLocationId?: string;
  delta: number;
  reason: string;
};

export type PromotionType = "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
export type PromotionScopeType = "ORDER" | "CATEGORY" | "PRODUCT";
export type PromotionStatus = "DRAFT" | "ACTIVE" | "PAUSED";

export type PromotionDto = {
  id: string;
  code: string;
  name: string;
  type: PromotionType | string;
  value: number;
  scopeType: PromotionScopeType | string;
  startsAt: string;
  endsAt: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  usedCount: number;
  stackable: boolean;
  status: PromotionStatus | string;
  targetIds: string[];
  updatedAt: string;
};

export type CreatePromotionRequest = {
  code: string;
  name: string;
  type: PromotionType;
  value: number;
  scopeType?: PromotionScopeType;
  startsAt: string;
  endsAt: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  stackable?: boolean;
  status?: PromotionStatus;
  targetIds?: string[];
};

export type UpdatePromotionRequest = {
  name?: string;
  type?: PromotionType;
  value?: number;
  scopeType?: PromotionScopeType;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  status?: PromotionStatus;
  targetIds?: string[];
};

export type CartLineDto = {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantTitle: string;
  sku: string;
  imageUrl?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availableStock: number;
};

export type CartResponse = {
  id: string;
  sessionToken: string;
  currency: string;
  promotionCode?: string | null;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  freeShippingThreshold: number;
  grandTotal: number;
  items: CartLineDto[];
};

export type OrderItemDto = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type AddressDto = {
  fullName: string;
  line1: string;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
};

export type OrderEventDto = {
  kind: string;
  label: string;
  detail: string;
  createdAt: string;
};

export type OrderDto = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  promotionCode?: string | null;
  trackingNumber?: string | null;
  version: number;
  createdAt: string;
  items: OrderItemDto[];
  shippingAddress?: AddressDto | null;
  events: OrderEventDto[];
};

export type CheckoutRequest = {
  customerName: string;
  customerEmail: string;
  address: {
    line1: string;
    city: string;
    state?: string;
    postalCode: string;
    country?: string;
  };
  shippingMethod?: "standard" | "express";
  promotionCode?: string;
  paymentToken?: string;
};

export type UpdateOrderStatusRequest = {
  status: string;
  trackingNumber?: string;
};

export type CancelOrderRequest = {
  reason?: string;
};

export type DailyPoint = {
  label: string;
  amount: number;
  orders: number;
};

export type CategoryBreakdownDto = {
  category: string;
  share: number;
  revenue: number;
};

export type TopProductDto = {
  productId: string;
  name: string;
  imageUrl?: string | null;
  price: number;
  unitsSold: number;
  revenue: number;
};

export type LowStockDto = {
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  imageUrl?: string | null;
  availableStock: number;
};

export type AnalyticsSummaryDto = {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  productCount: number;
  lowStockCount: number;
  revenueSeries: DailyPoint[];
  categoryBreakdown: CategoryBreakdownDto[];
  topProducts: TopProductDto[];
  lowStockItems: LowStockDto[];
};
