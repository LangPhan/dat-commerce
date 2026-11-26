import { z } from "zod";
import type {
  ThemeFooterColumn,
  ThemeFooterConfig,
  ThemeFooterSocialLink,
  ThemeHeaderConfig,
} from "@/types/api-cms-ai";

export const DEFAULT_HEADER_CONFIG: Required<{
  announcement: Required<NonNullable<ThemeHeaderConfig["announcement"]>>;
  logo: Required<NonNullable<ThemeHeaderConfig["logo"]>>;
  layout: Required<NonNullable<ThemeHeaderConfig["layout"]>>;
  actions: Required<NonNullable<ThemeHeaderConfig["actions"]>>;
}> = {
  announcement: {
    enabled: true,
    text: "Free carbon-neutral shipping on orders over {freeShippingThreshold}",
    linkUrl: "",
    bgColor: "#1C271F",
    textColor: "#F3F5EF",
  },
  logo: {
    text: "TERRAIN",
    imageUrl: "",
    showIcon: true,
    heightPx: 28,
  },
  layout: {
    sticky: true,
    heightPx: 62,
    bgColor: "#FFFFFF",
    textColor: "#1C221E",
    borderColor: "#E3E7E0",
  },
  actions: {
    showSearch: true,
    showWishlist: true,
    showAccount: true,
    showCart: true,
  },
};

export const DEFAULT_FOOTER_CONFIG: Required<{
  brand: Required<NonNullable<ThemeFooterConfig["brand"]>>;
  columns: ThemeFooterColumn[];
  newsletter: Required<NonNullable<ThemeFooterConfig["newsletter"]>>;
  socialLinks: ThemeFooterSocialLink[];
  bottomBar: Required<NonNullable<ThemeFooterConfig["bottomBar"]>>;
  style: Required<NonNullable<ThemeFooterConfig["style"]>>;
}> = {
  brand: {
    name: "Terrain Supply",
    logoImageUrl: "",
    showIcon: true,
    description:
      "Multi-category technical essentials and precision studio hardware, powered by Dat Commerce.",
  },
  columns: [
    {
      id: "shop",
      title: "Shop",
      links: [
        { id: "all-products", label: "All products", url: "/store/shop" },
        { id: "categories", label: "Categories", url: "/store/categories" },
        { id: "collections", label: "Collections", url: "/store/collections" },
        { id: "search", label: "Search catalog", url: "/store/search" },
      ],
    },
    {
      id: "customer",
      title: "Customer",
      links: [
        { id: "account", label: "Account", url: "/store/account" },
        { id: "history", label: "Order history", url: "/store/history" },
        { id: "wishlist", label: "Wishlist", url: "/store/wishlist" },
        { id: "cart", label: "Shopping cart", url: "/store/cart" },
      ],
    },
    {
      id: "platform",
      title: "Platform",
      links: [
        { id: "about", label: "About us", url: "/store/about" },
        { id: "contact", label: "Contact support", url: "/store/contact" },
        { id: "admin", label: "Merchant admin", url: "/admin" },
        { id: "editor", label: "Theme Editor", url: "/admin/editor" },
      ],
    },
  ],
  newsletter: {
    enabled: false,
    title: "Stay in the loop",
    placeholder: "you@example.com",
    buttonLabel: "Subscribe",
  },
  socialLinks: [],
  bottomBar: {
    copyrightText: "© {year} Terrain Supply. Powered by Dat Commerce.",
    contactEmail: "hello@datcommerce.local",
  },
  style: {
    bgColor: "#1C271F",
    textColor: "#F3F5EF",
    mutedColor: "#A6B7AA",
    borderColor: "#2D3D31",
  },
};

export function normalizeHeaderConfig(raw?: ThemeHeaderConfig | null) {
  return {
    announcement: {
      ...DEFAULT_HEADER_CONFIG.announcement,
      ...(raw?.announcement || {}),
    },
    logo: {
      ...DEFAULT_HEADER_CONFIG.logo,
      ...(raw?.logo || {}),
    },
    layout: {
      ...DEFAULT_HEADER_CONFIG.layout,
      ...(raw?.layout || {}),
    },
    actions: {
      ...DEFAULT_HEADER_CONFIG.actions,
      ...(raw?.actions || {}),
    },
  };
}

export function normalizeFooterConfig(raw?: ThemeFooterConfig | null) {
  return {
    brand: {
      ...DEFAULT_FOOTER_CONFIG.brand,
      ...(raw?.brand || {}),
    },
    columns: Array.isArray(raw?.columns)
      ? raw.columns.slice(0, 4).map((col) => ({
          ...col,
          links: Array.isArray(col.links) ? col.links.slice(0, 10) : [],
        }))
      : DEFAULT_FOOTER_CONFIG.columns,
    newsletter: {
      ...DEFAULT_FOOTER_CONFIG.newsletter,
      ...(raw?.newsletter || {}),
    },
    socialLinks: Array.isArray(raw?.socialLinks)
      ? raw.socialLinks.slice(0, 8)
      : DEFAULT_FOOTER_CONFIG.socialLinks,
    bottomBar: {
      ...DEFAULT_FOOTER_CONFIG.bottomBar,
      ...(raw?.bottomBar || {}),
    },
    style: {
      ...DEFAULT_FOOTER_CONFIG.style,
      ...(raw?.style || {}),
    },
  };
}

export function formatAnnouncementText(
  template: string,
  formattedThreshold: string
): string {
  return (template || "").replace(/\{freeShippingThreshold\}/g, formattedThreshold);
}

export function formatCopyrightText(
  template: string,
  fallbackStoreName = "Terrain Supply"
): string {
  const year = String(new Date().getFullYear());
  const raw = (template || "").trim();
  if (!raw) {
    return `© ${year} ${fallbackStoreName}. Powered by Dat Commerce.`;
  }
  return raw.replace(/\{year\}/g, year);
}

const COLOR_OR_VAR_RE = /^(#[0-9A-Fa-f]{6}|var\(--[A-Za-z0-9_-]{2,48}\))$/;
const SAFE_OPTIONAL_URL_RE = /^(?:$|\/(?!\/).*|#[A-Za-z0-9_-]*|https:\/\/.*)$/;

export const themeHeaderSchema = z.object({
  announcement: z
    .object({
      enabled: z.boolean().optional(),
      text: z.string().max(160).optional(),
      linkUrl: z.string().regex(SAFE_OPTIONAL_URL_RE).optional(),
      bgColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
      textColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
    })
    .optional(),
  logo: z
    .object({
      text: z.string().max(60).optional(),
      imageUrl: z.string().regex(SAFE_OPTIONAL_URL_RE).optional(),
      showIcon: z.boolean().optional(),
      heightPx: z.number().int().min(18).max(56).optional(),
    })
    .optional(),
  layout: z
    .object({
      sticky: z.boolean().optional(),
      heightPx: z.number().int().min(48).max(104).optional(),
      bgColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
      textColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
      borderColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
    })
    .optional(),
  actions: z
    .object({
      showSearch: z.boolean().optional(),
      showWishlist: z.boolean().optional(),
      showAccount: z.boolean().optional(),
      showCart: z.boolean().optional(),
    })
    .optional(),
});

export const themeFooterSchema = z.object({
  brand: z
    .object({
      name: z.string().max(80).optional(),
      logoImageUrl: z.string().regex(SAFE_OPTIONAL_URL_RE).optional(),
      showIcon: z.boolean().optional(),
      description: z.string().max(280).optional(),
    })
    .optional(),
  columns: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        title: z.string().trim().min(1).max(40),
        links: z
          .array(
            z.object({
              id: z.string().min(1).max(40),
              label: z.string().trim().min(1).max(60),
              url: z.string().min(1).regex(SAFE_OPTIONAL_URL_RE),
            })
          )
          .max(10),
      })
    )
    .max(4)
    .optional(),
  newsletter: z
    .object({
      enabled: z.boolean().optional(),
      title: z.string().max(80).optional(),
      placeholder: z.string().max(80).optional(),
      buttonLabel: z.string().max(40).optional(),
    })
    .optional(),
  socialLinks: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        platform: z.enum(["instagram", "facebook", "x", "youtube", "tiktok", "linkedin"]),
        url: z.string().min(1).regex(SAFE_OPTIONAL_URL_RE),
      })
    )
    .max(8)
    .optional(),
  bottomBar: z
    .object({
      copyrightText: z.string().max(160).optional(),
      contactEmail: z.string().max(120).optional(),
    })
    .optional(),
  style: z
    .object({
      bgColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
      textColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
      mutedColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
      borderColor: z.string().regex(COLOR_OR_VAR_RE).optional(),
    })
    .optional(),
});
