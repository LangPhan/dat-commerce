export type AttributeType =
  | "Text"
  | "Number"
  | "Boolean"
  | "Date"
  | "Select"
  | "Multi-select"
  | "Color"
  | "Measurement";

export const attributeTypes: AttributeType[] = [
  "Text",
  "Number",
  "Boolean",
  "Date",
  "Select",
  "Multi-select",
  "Color",
  "Measurement",
];

export type Attribute = {
  id: string;
  name: string;
  code: string;
  type: AttributeType;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  order: number;
  validation: string;
  options: string;
  productType: string;
  unit?: string;
};

export type ProductVariant = {
  id: string;
  sku: string;
  label: string;
  price: number;
  stock: number;
};

export type ProductReview = {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified?: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  image: string;
  gallery?: string[];
  description: string;
  attributes: Record<string, string>;
  variants?: ProductVariant[];
  rating: number;
  reviewCount?: number;
  reviews?: ProductReview[];
  seo?: string;
  seoTitle?: string;
  salesCount?: number;
  createdAt?: string;
};

export type Category = {
  id: string;
  name: string;
  parent: string;
  description: string;
  image: string;
  seoDescription?: string;
};

export type Collection = {
  id: string;
  name: string;
  description?: string;
  products: string[];
};

export type OrderTimelineEvent = {
  label: string;
  detail: string;
  timestamp: string;
  kind: "placed" | "payment" | "fulfillment" | "note";
};

export type OrderItem = {
  name: string;
  sku?: string;
  qty: number;
  price: number;
};

export type Order = {
  id: string;
  customer: string;
  email: string;
  date: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  discountAmount?: number;
  payment: "Paid" | "Pending" | "Refunded" | string;
  fulfillment: "Unfulfilled" | "Processing" | "Shipped" | "Delivered" | string;
  tracking: string;
  shippingAddress?: string;
  items: OrderItem[];
  timeline?: OrderTimelineEvent[];
};

export type Discount = {
  id: string;
  name: string;
  code: string;
  type: "Percentage" | "Fixed amount";
  value: number;
  eligible: string;
  start: string;
  end: string;
  limit: number;
  used?: number;
  status: "Draft" | "Active" | "Paused";
};

export type StoreMenuLink = {
  id: string;
  label: string;
  url: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type MediaAsset = {
  id: string;
  name: string;
  url: string;
  category?: string;
};

export type CustomerProfile = {
  name: string;
  email: string;
  phone?: string;
  defaultAddress?: string;
};

export type CartItem = {
  id: string;
  variant: string;
  qty: number;
};

export type OrderReceipt = {
  id: string;
  email: string;
  total: number;
  date: string;
  items?: { name: string; variant: string; qty: number; price: number }[];
  discount?: number;
  shipping?: number;
};
