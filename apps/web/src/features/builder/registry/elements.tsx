"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  Info,
  Layers,
  Mountain,
  Package,
  Play,
  Quote,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Modal } from "@/components/ui/dialog";
import { TextMotionContent } from "@/features/motion/TextMotionRenderer";
import { resolveElementMotionForViewport } from "@/features/motion/resolve";
import type {
  AnimationPresetDefinition,
  GlobalMotionSettings,
  NormalizedGlobalMotion,
} from "@/features/motion/types";
import { ProductCard, type StoreCategoryItem, type StoreProductItem } from "@/features/storefront/blocks";
import { cn, usd } from "@/lib/format";
import { initialCategories, initialProducts } from "@/mocks/catalog";
import type { CategoryDto, ProductDto } from "@/types/api-commerce";
import type { Product } from "@/types/commerce";
import {
  sanitizeHtmlSubset,
  sanitizeMediaUrl,
  sanitizeUrl,
} from "../sanitizers";
import type {
  ElementItemData,
  ElementNode,
  FormFieldData,
  ViewportMode,
} from "../types";

export const BUILDER_ICON_MAP: Record<string, LucideIcon> = {
  "arrow-right": ArrowRight,
  award: Award,
  check: Check,
  compass: Compass,
  flame: Flame,
  info: Info,
  layers: Layers,
  mountain: Mountain,
  package: Package,
  quote: Quote,
  shield: Shield,
  "shopping-bag": ShoppingBag,
  sparkles: Sparkles,
  star: Star,
  truck: Truck,
  zap: Zap,
};

export type BuilderRenderContext = {
  mode: "edit" | "live";
  viewport: ViewportMode;
  globalMotion?: GlobalMotionSettings | NormalizedGlobalMotion | null;
  customPresets?: AnimationPresetDefinition[];
  motionReplayNonceByNodeId?: Record<string, number>;
  catalog: StoreProductItem[];
  categories: StoreCategoryItem[];
  onAddToCart?: (product: StoreProductItem) => void;
  onNotify?: (message: string) => void;
  renderChildren?: (containerNode: ElementNode) => ReactNode;
};

type NormalizedProductInfo = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryLabel: string;
  categoryKey: string;
  image: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  rating: number;
  salesCount: number;
  description: string;
};

function isApiProd(item: StoreProductItem): item is ProductDto {
  return "minPrice" in item;
}

function isApiCat(item: StoreCategoryItem): item is CategoryDto {
  return "productCount" in item;
}

function toProdInfo(item: StoreProductItem): NormalizedProductInfo {
  if (isApiProd(item)) {
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      brand: item.brand || "Terrain",
      categoryLabel: item.categories[0]?.name || item.productTypeName,
      categoryKey: item.categories[0]?.slug || item.categories[0]?.name || "",
      image: item.primaryImageUrl || "/media/terrain-fallback.jpg",
      price: Number(item.minPrice),
      compareAtPrice:
        item.compareAtPrice !== undefined && item.compareAtPrice !== null
          ? Number(item.compareAtPrice)
          : undefined,
      stock: item.totalStock,
      rating: Number(item.rating || 4.8),
      salesCount: item.reviewCount || 0,
      description: item.description || "",
    };
  }
  const p = item as Product;
  return {
    id: p.id,
    slug: p.id,
    name: p.name,
    brand: p.brand,
    categoryLabel: p.category,
    categoryKey: p.category,
    image: p.image,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    rating: p.rating,
    salesCount: p.salesCount || 0,
    description: p.description || "",
  };
}

function resolveProduct(
  catalog: StoreProductItem[],
  slugOrId: unknown
): { raw: StoreProductItem; info: NormalizedProductInfo } | null {
  const list = catalog.length ? catalog : initialProducts;
  if (!list.length) return null;
  const target = typeof slugOrId === "string" ? slugOrId.trim() : "";
  if (target) {
    const matched = list.find((item) => {
      const info = toProdInfo(item);
      return info.slug === target || info.id === target;
    });
    if (matched) return { raw: matched, info: toProdInfo(matched) };
  }
  return { raw: list[0], info: toProdInfo(list[0]) };
}

function strProp(props: Record<string, unknown>, key: string, fallback = ""): string {
  const v = props[key];
  return typeof v === "string" ? v : v !== undefined && v !== null ? String(v) : fallback;
}

function numProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const n = Number(props[key]);
  return Number.isFinite(n) ? n : fallback;
}

function boolProp(props: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = props[key];
  if (typeof v === "boolean") return v;
  return fallback;
}

function itemsProp(props: Record<string, unknown>, key = "items"): ElementItemData[] {
  const raw = props[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => Boolean(it && typeof it === "object"))
    .map((it, idx) => ({
      id: typeof it.id === "string" ? it.id : `item-${idx}`,
      title: typeof it.title === "string" ? it.title : "",
      subtitle: typeof it.subtitle === "string" ? it.subtitle : undefined,
      body: typeof it.body === "string" ? it.body : undefined,
      image: typeof it.image === "string" ? it.image : undefined,
      url: typeof it.url === "string" ? it.url : undefined,
      icon: typeof it.icon === "string" ? it.icon : undefined,
    }));
}

function InteractiveVideo({
  title,
  caption,
  posterUrl,
  videoUrl,
  actionLabel,
  mode,
}: {
  title: string;
  caption: string;
  posterUrl: string;
  videoUrl: string;
  actionLabel: string;
  mode: "edit" | "live";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="bldr-video-card">
        <img src={sanitizeMediaUrl(posterUrl)} alt={title || "Video poster"} />
        <div className="bldr-video-overlay">
          {title ? <h3>{title}</h3> : null}
          {caption ? <p>{caption}</p> : null}
          <button
            type="button"
            className="bldr-play-btn"
            onClick={(e) => {
              if (mode === "edit") e.stopPropagation();
              setOpen(true);
            }}
          >
            <Play size={16} />
            <span>{actionLabel || "Play video"}</span>
          </button>
        </div>
      </div>
      {open ? (
        <Modal
          close={() => setOpen(false)}
          title={title || "Product film preview"}
          footer={
            <button
              type="button"
              className="btn primary"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          }
        >
          {videoUrl && sanitizeUrl(videoUrl, "") ? (
            <div className="bldr-video-frame">
              <p className="muted" style={{ marginBottom: 8 }}>
                Video source: <code>{sanitizeUrl(videoUrl)}</code>
              </p>
              <img
                src={sanitizeMediaUrl(posterUrl)}
                alt={title}
                style={{ width: "100%", borderRadius: 10 }}
              />
            </div>
          ) : (
            <img
              src={sanitizeMediaUrl(posterUrl)}
              alt={title}
              style={{ width: "100%", borderRadius: 10 }}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
}

function InteractiveTabs({
  items,
  mode,
}: {
  items: ElementItemData[];
  mode: "edit" | "live";
}) {
  const [active, setActive] = useState(0);
  const current = items[active] || items[0];
  if (!items.length) {
    return <p className="muted">Add tabs in the Inspector.</p>;
  }
  return (
    <div className="bldr-tabs">
      <div className="bldr-tabs-bar" role="tablist">
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-builder-part={idx === active ? "tab_active" : "tab"}
            aria-selected={idx === active}
            className={cn("bldr-tab-btn", idx === active && "active")}
            onClick={(e) => {
              void e;
              void mode;
              setActive(idx);
            }}
          >
            {item.title || `Tab ${idx + 1}`}
          </button>
        ))}
      </div>
      {current ? (
        <div className="bldr-tab-panel" data-builder-part="panel" role="tabpanel">
          {current.body}
        </div>
      ) : null}
    </div>
  );
}

function InteractiveAccordion({
  items,
  mode,
}: {
  items: ElementItemData[];
  mode: "edit" | "live";
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  if (!items.length) {
    return <p className="muted">Add accordion items in the Inspector.</p>;
  }
  return (
    <div className="bldr-accordion">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={item.id} className="bldr-acc-item" data-builder-part="item">
            <button
              type="button"
              className="bldr-acc-trigger"
              data-builder-part="trigger"
              aria-expanded={isOpen}
              onClick={(e) => {
                void e;
                void mode;
                setOpenIndex(isOpen ? null : idx);
              }}
            >
              <span>{item.title || `Question ${idx + 1}`}</span>
              <span>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen ? (
              <div className="bldr-acc-body" data-builder-part="body">
                {item.body}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function InteractiveCarousel({
  slides,
  mode,
}: {
  slides: ElementItemData[];
  mode: "edit" | "live";
}) {
  const [idx, setIdx] = useState(0);
  if (!slides.length) {
    return <p className="muted">Add slides in the Inspector.</p>;
  }
  const safeIdx = idx % slides.length;
  const slide = slides[safeIdx];
  return (
    <div className="bldr-carousel">
      <div className="bldr-carousel-media" data-builder-part="media">
        <img
          src={sanitizeMediaUrl(slide.image)}
          alt={slide.title || "Carousel slide"}
          data-builder-part="image"
        />
        <div className="bldr-carousel-caption" data-builder-part="caption">
          {slide.title ? <strong data-builder-part="title">{slide.title}</strong> : null}
          {slide.body ? <p data-builder-part="body">{slide.body}</p> : null}
        </div>
      </div>
      {slides.length > 1 ? (
        <div className="bldr-carousel-nav">
          <button
            type="button"
            aria-label="Previous slide"
            data-builder-part="nav_btn"
            onClick={(e) => {
              void e;
              void mode;
              setIdx((prev) => (prev - 1 + slides.length) % slides.length);
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {safeIdx + 1} / {slides.length}
          </span>
          <button
            type="button"
            aria-label="Next slide"
            data-builder-part="nav_btn"
            onClick={(e) => {
              void e;
              void mode;
              setIdx((prev) => (prev + 1) % slides.length);
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function InteractiveCountdown({
  heading,
  targetIso,
}: {
  heading: string;
  targetIso: string;
}) {
  const [remaining, setRemaining] = useState({
    days: 14,
    hours: 6,
    minutes: 42,
    seconds: 19,
  });

  useEffect(() => {
    const compute = () => {
      const targetMs = Date.parse(targetIso);
      if (!Number.isFinite(targetMs)) return;
      const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setRemaining({
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
      });
    };
    compute();
    const timer = window.setInterval(compute, 1000);
    return () => window.clearInterval(timer);
  }, [targetIso]);

  return (
    <div className="bldr-countdown">
      {heading ? (
        <strong className="bldr-countdown-title" data-builder-part="heading">
          {heading}
        </strong>
      ) : null}
      <div className="bldr-countdown-grid">
        {[
          ["Days", remaining.days],
          ["Hours", remaining.hours],
          ["Mins", remaining.minutes],
          ["Secs", remaining.seconds],
        ].map(([label, val]) => (
          <div key={String(label)} className="bldr-countdown-cell" data-builder-part="cell">
            <strong data-builder-part="value">{String(val).padStart(2, "0")}</strong>
            <span data-builder-part="label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InteractiveForm({
  heading,
  submitLabel,
  successMessage,
  fields,
  mode,
}: {
  heading: string;
  submitLabel: string;
  successMessage: string;
  fields: FormFieldData[];
  mode: "edit" | "live";
}) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      className="bldr-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (mode !== "edit") {
          setSubmitted(true);
        }
      }}
    >
      {heading ? <h3 data-builder-part="heading">{heading}</h3> : null}
      {submitted ? (
        <p role="status" className="bldr-form-success">
          <Check size={15} /> {successMessage || "Submitted!"}
        </p>
      ) : (
        <>
          <div className="bldr-form-fields">
            {fields.map((field) => (
              <label key={field.id} data-builder-part="field">
                <span data-builder-part="label">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    data-builder-part="input"
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                ) : (
                  <input
                    type={field.type === "email" ? "email" : "text"}
                    data-builder-part="input"
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="btn primary"
            data-builder-part="submit"
            onClick={(e) => {
              if (mode === "edit") {
                e.preventDefault();
              }
            }}
          >
            {submitLabel || "Submit"}
          </button>
        </>
      )}
    </form>
  );
}

export type BuilderNodeAttrs = {
  "data-builder-node"?: string;
  "data-builder-type"?: string;
  "data-typography-preset"?: string;
  className?: string;
} & Record<string, string | undefined>;

export function renderElementContent(
  node: ElementNode,
  ctx: BuilderRenderContext,
  compiledStyle: CSSProperties,
  nodeAttrs?: BuilderNodeAttrs
): ReactNode {
  const props = node.props || {};
  const isEdit = ctx.mode === "edit";
  const catalog = ctx.catalog.length ? ctx.catalog : initialProducts;
  const categories = ctx.categories.length ? ctx.categories : initialCategories;
  const { className: extraClassName, ...domAttrs } = nodeAttrs || {};

  const stopLinkInEdit = (e: React.MouseEvent<HTMLElement>) => {
    if (isEdit) {
      e.preventDefault();
    }
  };

  switch (node.type) {
    case "section":
    case "container":
    case "grid":
    case "flex":
    case "columns":
    case "column": {
      const Tag =
        node.type === "section"
          ? ((strProp(props, "tag", "section") as "section" | "div" | "article" | "aside") ||
              "section")
          : "div";
      const ratio = strProp(props, "ratio", "equal");
      const childrenEl = ctx.renderChildren?.(node);
      const hasChildren = Boolean(node.children && node.children.length > 0);
      return (
        <Tag
          className={cn(
            "bldr-container-inner",
            `bldr-type-${node.type}`,
            extraClassName
          )}
          {...domAttrs}
          {...(node.type === "columns" ? { "data-columns-ratio": ratio } : {})}
          style={compiledStyle}
        >
          {hasChildren ? (
            childrenEl
          ) : isEdit ? (
            <div className="bldr-empty-drop">
              Drop elements into <strong>{node.label}</strong>
            </div>
          ) : null}
        </Tag>
      );
    }

    case "spacer":
      return (
        <div
          className={cn("bldr-spacer", isEdit && "bldr-spacer-edit", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
          aria-hidden="true"
        />
      );

    case "heading": {
      const tag = strProp(props, "tag", "h2");
      const text = strProp(props, "text", "Heading");
      const href = strProp(props, "href", "");
      const safeHref = href ? sanitizeUrl(href, "") : "";
      const HeadingTag =
        tag === "h1" ||
        tag === "h3" ||
        tag === "h4" ||
        tag === "h5" ||
        tag === "h6" ||
        tag === "p"
          ? tag
          : "h2";
      const resolvedHeadingTextMotion = node.motion
        ? resolveElementMotionForViewport(
            node.motion,
            ctx.viewport,
            ctx.customPresets,
            ctx.globalMotion
          ).text
        : undefined;
      const inner = (
        <HeadingTag
          className={cn("bldr-heading", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          {resolvedHeadingTextMotion?.enabled ? (
            <TextMotionContent
              text={text}
              config={resolvedHeadingTextMotion}
              globalMotion={ctx.globalMotion}
              replayNonce={ctx.motionReplayNonceByNodeId?.[node.id] || 0}
            />
          ) : (
            text
          )}
        </HeadingTag>
      );
      return safeHref ? (
        <Link href={safeHref} onClick={stopLinkInEdit} className="bldr-inline-link">
          {inner}
        </Link>
      ) : (
        inner
      );
    }

    case "text_editor": {
      const bodyText = strProp(props, "text", "");
      const resolvedBodyTextMotion = node.motion
        ? resolveElementMotionForViewport(
            node.motion,
            ctx.viewport,
            ctx.customPresets,
            ctx.globalMotion
          ).text
        : undefined;
      return (
        <div
          className={cn("bldr-text", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          {resolvedBodyTextMotion?.enabled ? (
            <TextMotionContent
              text={bodyText}
              config={resolvedBodyTextMotion}
              globalMotion={ctx.globalMotion}
              replayNonce={ctx.motionReplayNonceByNodeId?.[node.id] || 0}
            />
          ) : (
            bodyText
          )}
        </div>
      );
    }

    case "image": {
      const src = sanitizeMediaUrl(props.src);
      const alt = strProp(props, "alt", "Image");
      const caption = strProp(props, "caption", "");
      const href = strProp(props, "href", "");
      const safeHref = href ? sanitizeUrl(href, "") : "";
      const fig = (
        <figure className="bldr-figure" style={{ margin: 0 }}>
          <img
            src={src}
            alt={alt}
            className={cn("bldr-image", extraClassName)}
            {...domAttrs}
            style={compiledStyle}
          />
          {caption ? <figcaption className="bldr-figcaption">{caption}</figcaption> : null}
        </figure>
      );
      return safeHref ? (
        <Link href={safeHref} onClick={stopLinkInEdit}>
          {fig}
        </Link>
      ) : (
        fig
      );
    }

    case "video":
      return (
        <div className={extraClassName} {...domAttrs} style={compiledStyle}>
          <InteractiveVideo
            title={strProp(props, "title", "Studio Film")}
            caption={strProp(props, "caption", "")}
            posterUrl={strProp(props, "posterUrl", "/media/terrain-fallback.jpg")}
            videoUrl={strProp(props, "videoUrl", "")}
            actionLabel={strProp(props, "actionLabel", "Play film")}
            mode={ctx.mode}
          />
        </div>
      );

    case "button": {
      const label = strProp(props, "label", "Learn more");
      const href = sanitizeUrl(props.href, "/store/shop");
      const variant = strProp(props, "variant", "primary");
      const iconKey = strProp(props, "icon", "");
      const IconComp = BUILDER_ICON_MAP[iconKey];
      return (
        <Link
          href={href}
          onClick={stopLinkInEdit}
          className={cn("bldr-button", `variant-${variant}`, extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          <span>{label}</span>
          {IconComp ? <IconComp size={15} /> : null}
        </Link>
      );
    }

    case "icon": {
      const iconKey = strProp(props, "icon", "compass");
      const IconComp = BUILDER_ICON_MAP[iconKey] || Compass;
      const caption = strProp(props, "caption", "");
      const size = Math.max(12, Math.min(80, numProp(props, "size", 28)));
      return (
        <div
          className={cn("bldr-icon-box", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          <IconComp size={size} />
          {caption ? <span>{caption}</span> : null}
        </div>
      );
    }

    case "divider":
      return (
        <hr
          className={cn("bldr-divider", extraClassName)}
          {...domAttrs}
          style={{
            borderTopWidth: strProp(props, "thickness", "1px"),
            borderTopStyle:
              (strProp(props, "style", "solid") as "solid" | "dashed" | "dotted") ||
              "solid",
            ...compiledStyle,
          }}
        />
      );

    case "icon_list": {
      const items = itemsProp(props, "items");
      const layout = strProp(props, "layout", "list");
      const cols = Math.max(2, Math.min(4, numProp(props, "columns", 3)));
      return (
        <div
          className={cn("bldr-icon-list", layout === "grid" && "is-grid", extraClassName)}
          {...domAttrs}
          style={{
            ...(layout === "grid"
              ? ({ "--bldr-cols": String(cols) } as CSSProperties)
              : {}),
            ...compiledStyle,
          }}
        >
          {items.map((item) => {
            const IconComp = BUILDER_ICON_MAP[item.icon || "check"] || Check;
            return (
              <div key={item.id} className="bldr-icon-list-item" data-builder-part="item">
                <span className="bldr-icon-list-badge" data-builder-part="badge">
                  <IconComp size={14} />
                </span>
                <div>
                  <strong data-builder-part="title">{item.title}</strong>
                  {item.subtitle ? (
                    <small className="muted" data-builder-part="subtitle">
                      {" "}· {item.subtitle}
                    </small>
                  ) : null}
                  {item.body ? <p data-builder-part="body">{item.body}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case "image_gallery": {
      const items = itemsProp(props, "items");
      const cols = Math.max(2, Math.min(4, numProp(props, "columns", 3)));
      return (
        <div
          className={cn("bldr-gallery", extraClassName)}
          {...domAttrs}
          style={{
            ...({ "--bldr-cols": String(cols) } as CSSProperties),
            ...compiledStyle,
          }}
        >
          {items.map((item) => (
            <div key={item.id} className="bldr-gallery-card" data-builder-part="card">
              <img
                src={sanitizeMediaUrl(item.image)}
                alt={item.title || "Gallery photo"}
                data-builder-part="image"
              />
              {item.title || item.body ? (
                <div className="bldr-gallery-meta">
                  {item.title ? <strong data-builder-part="title">{item.title}</strong> : null}
                  {item.body ? <span data-builder-part="body">{item.body}</span> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      );
    }

    case "product_card": {
      const resolved = resolveProduct(catalog, props.productSlug);
      if (!resolved) {
        return <p className="muted">No products available.</p>;
      }
      return (
        <div
          className={extraClassName}
          {...domAttrs}
          style={compiledStyle}
          onClickCapture={(e) => {
            if (isEdit) e.preventDefault();
          }}
        >
          <ProductCard product={resolved.raw} />
        </div>
      );
    }

    case "product_grid": {
      const limit = Math.max(2, Math.min(12, numProp(props, "limit", 8)));
      const cols = Math.max(2, Math.min(4, numProp(props, "columns", 4)));
      const catSlug = strProp(props, "categorySlug", "").toLowerCase();
      const sortBy = strProp(props, "sortBy", "newest");
      let normalized = catalog.map((raw) => ({ raw, info: toProdInfo(raw) }));
      if (catSlug) {
        normalized = normalized.filter((item) =>
          item.info.categoryKey.toLowerCase().includes(catSlug)
        );
      }
      if (sortBy === "best_sellers") {
        normalized.sort((a, b) => b.info.salesCount - a.info.salesCount);
      } else if (sortBy === "price_asc") {
        normalized.sort((a, b) => a.info.price - b.info.price);
      }
      const shown = normalized.slice(0, limit);
      const actionLabel = strProp(props, "actionLabel", "");
      const actionUrl = sanitizeUrl(props.actionUrl, "/store/shop");
      return (
        <div className={extraClassName} {...domAttrs} style={compiledStyle}>
          <div
            className="bldr-product-grid"
            style={{ "--bldr-cols": String(cols) } as CSSProperties}
            onClickCapture={(e) => {
              if (isEdit) e.preventDefault();
            }}
          >
            {shown.map(({ raw, info }) => (
              <ProductCard
                key={info.id}
                product={raw}
              />
            ))}
          </div>
          {actionLabel ? (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <Link
                href={actionUrl}
                onClick={stopLinkInEdit}
                className="bldr-inline-action"
                data-builder-part="action"
              >
                {actionLabel} <ArrowRight size={14} />
              </Link>
            </div>
          ) : null}
        </div>
      );
    }

    case "product_carousel": {
      const limit = Math.max(3, Math.min(12, numProp(props, "limit", 6)));
      const catSlug = strProp(props, "categorySlug", "").toLowerCase();
      let list = [...catalog];
      if (catSlug) {
        list = list.filter((p) =>
          toProdInfo(p).categoryKey.toLowerCase().includes(catSlug)
        );
      }
      const shown = list.slice(0, limit);
      return (
        <div
          className={cn("bldr-product-carousel", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
          onClickCapture={(e) => {
            if (isEdit) e.preventDefault();
          }}
        >
          {shown.map((product) => (
            <div key={toProdInfo(product).id} className="bldr-product-carousel-item">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      );
    }

    case "category_grid": {
      const limit = Math.max(2, Math.min(12, numProp(props, "limit", 6)));
      const cols = Math.max(2, Math.min(4, numProp(props, "columns", 3)));
      const shown = categories.slice(0, limit);
      let countByCategory: Map<string, number> | null = null;
      if (shown.some((cat) => !isApiCat(cat))) {
        countByCategory = new Map<string, number>();
        for (const p of catalog) {
          const key = toProdInfo(p).categoryKey;
          countByCategory.set(key, (countByCategory.get(key) || 0) + 1);
        }
      }
      return (
        <div
          className={cn("bldr-category-grid", extraClassName)}
          {...domAttrs}
          style={{
            ...({ "--bldr-cols": String(cols) } as CSSProperties),
            ...compiledStyle,
          }}
        >
          {shown.map((cat) => {
            const c = isApiCat(cat)
              ? {
                  id: cat.id,
                  name: cat.name,
                  desc: cat.description || "",
                  count: cat.productCount,
                  slug: cat.slug,
                  image: cat.imageUrl || "/media/terrain-fallback.jpg",
                }
              : {
                  id: cat.id,
                  name: cat.name,
                  desc: cat.description,
                  count: countByCategory?.get(cat.name) ?? 0,
                  slug: cat.name,
                  image: cat.image,
                };
            return (
              <Link
                key={c.id}
                href={`/store/category/${encodeURIComponent(c.slug)}`}
                onClick={stopLinkInEdit}
                className="bldr-category-card"
                data-builder-part="card"
              >
                <img
                  src={sanitizeMediaUrl(c.image)}
                  alt={c.name}
                  data-builder-part="image"
                />
                <div className="bldr-category-meta">
                  <strong data-builder-part="title">{c.name}</strong>
                  <span data-builder-part="count">{c.count} products</span>
                </div>
              </Link>
            );
          })}
        </div>
      );
    }

    case "featured_product": {
      const resolved = resolveProduct(catalog, props.productSlug);
      if (!resolved) return <p className="muted">No products available.</p>;
      const { raw, info } = resolved;
      return (
        <div
          className={cn("bldr-featured-product", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          <img
            src={sanitizeMediaUrl(info.image)}
            alt={info.name}
            className="bldr-featured-img"
            data-builder-part="image"
          />
          <div className="bldr-featured-body">
            <span className="bldr-kicker" data-builder-part="kicker">
              {strProp(props, "kicker", "FEATURED")}
            </span>
            <h3 data-builder-part="title">{info.name}</h3>
            <p className="muted" data-builder-part="description">
              {info.description || `${info.brand} · ${info.categoryLabel}`}
            </p>
            <div className="bldr-featured-price-row" data-builder-part="price">
              <strong>{usd(info.price)}</strong>
              {info.compareAtPrice && info.compareAtPrice > info.price ? (
                <del className="muted">{usd(info.compareAtPrice)}</del>
              ) : null}
            </div>
            <div className="button-row">
              <button
                type="button"
                className="btn primary"
                data-builder-part="button"
                onClick={(e) => {
                  if (isEdit) {
                    e.preventDefault();
                    ctx.onNotify?.(`Preview cart action for "${info.name}"`);
                    return;
                  }
                  ctx.onAddToCart?.(raw);
                }}
              >
                <ShoppingBag size={14} /> {strProp(props, "ctaLabel", "Add to cart")}
              </button>
              <Link
                href={`/store/product/${encodeURIComponent(info.slug)}`}
                onClick={stopLinkInEdit}
                className="btn"
              >
                View specs
              </Link>
            </div>
          </div>
        </div>
      );
    }

    case "price": {
      const resolved = resolveProduct(catalog, props.productSlug);
      const amount = resolved
        ? resolved.info.price
        : Number(strProp(props, "amount", "189")) || 189;
      const compareAt = resolved?.info.compareAtPrice
        ? resolved.info.compareAtPrice
        : Number(strProp(props, "compareAt", "0")) || 0;
      return (
        <div
          className={cn("bldr-price-tag", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          <strong>{usd(amount)}</strong>
          {compareAt > amount ? (
            <del className="bldr-compare-price">{usd(compareAt)}</del>
          ) : null}
        </div>
      );
    }

    case "add_to_cart": {
      const resolved = resolveProduct(catalog, props.productSlug);
      const label = strProp(props, "label", "Add to cart");
      return (
        <button
          type="button"
          className={cn("btn primary bldr-add-cart-btn", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
          onClick={(e) => {
            if (isEdit) {
              e.preventDefault();
              ctx.onNotify?.(
                resolved
                  ? `Preview: Added ${resolved.info.name} to cart`
                  : "Bind a product in the Inspector"
              );
              return;
            }
            if (resolved) ctx.onAddToCart?.(resolved.raw);
          }}
        >
          <ShoppingBag size={14} />
          <span data-builder-part="button">{label}</span>
        </button>
      );
    }

    case "product_info": {
      const resolved = resolveProduct(catalog, props.productSlug);
      if (!resolved) return <p className="muted">Select a product in the Inspector.</p>;
      const { info } = resolved;
      return (
        <div
          className={cn("bldr-product-info", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          <div className="bldr-product-info-head">
            <span className="muted" data-builder-part="meta">
              {info.brand} · {info.categoryLabel}
            </span>
            <span className="bldr-rating" data-builder-part="rating">
              <Star size={12} fill="currentColor" /> {info.rating.toFixed(1)}
            </span>
          </div>
          {boolProp(props, "showDescription", true) && info.description ? (
            <p data-builder-part="description">{info.description}</p>
          ) : null}
          {boolProp(props, "showStock", true) ? (
            <small className="bldr-stock-pill" data-builder-part="stock">
              {info.stock > 0 ? `${info.stock} in stock & ready to ship` : "Out of stock"}
            </small>
          ) : null}
        </div>
      );
    }

    case "promotion_banner":
      return (
        <div
          className={cn("bldr-promo-banner", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
        >
          <div>
            {strProp(props, "kicker") ? (
              <span className="bldr-kicker" data-builder-part="kicker">
                {strProp(props, "kicker")}
              </span>
            ) : null}
            <h3 data-builder-part="heading">{strProp(props, "heading", "Special Offer")}</h3>
            {strProp(props, "copy") ? (
              <p data-builder-part="copy">{strProp(props, "copy")}</p>
            ) : null}
          </div>
          {strProp(props, "actionLabel") ? (
            <Link
              href={sanitizeUrl(props.actionUrl, "/store/shop")}
              onClick={stopLinkInEdit}
              className="btn primary"
              data-builder-part="action"
            >
              {strProp(props, "actionLabel")} <ArrowRight size={14} />
            </Link>
          ) : null}
        </div>
      );

    case "tabs":
      return (
        <div className={extraClassName} {...domAttrs} style={compiledStyle}>
          <InteractiveTabs items={itemsProp(props, "items")} mode={ctx.mode} />
        </div>
      );

    case "accordion":
      return (
        <div className={extraClassName} {...domAttrs} style={compiledStyle}>
          <InteractiveAccordion items={itemsProp(props, "items")} mode={ctx.mode} />
        </div>
      );

    case "carousel":
      return (
        <div className={extraClassName} {...domAttrs} style={compiledStyle}>
          <InteractiveCarousel slides={itemsProp(props, "slides")} mode={ctx.mode} />
        </div>
      );

    case "countdown":
      return (
        <div className={extraClassName} {...domAttrs} style={compiledStyle}>
          <InteractiveCountdown
            heading={strProp(props, "heading", "Upcoming Release")}
            targetIso={strProp(props, "targetIso", "2027-01-01T00:00:00Z")}
          />
        </div>
      );

    case "form": {
      const rawFields = Array.isArray(props.fields) ? props.fields : [];
      const fields: FormFieldData[] = rawFields
        .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object"))
        .map((f, idx) => ({
          id: typeof f.id === "string" ? f.id : `f-${idx}`,
          label: typeof f.label === "string" ? f.label : `Field ${idx + 1}`,
          type:
            f.type === "email" || f.type === "textarea" ? f.type : "text",
          placeholder: typeof f.placeholder === "string" ? f.placeholder : "",
          required: Boolean(f.required),
        }));
      return (
        <div className={extraClassName} {...domAttrs} style={compiledStyle}>
          <InteractiveForm
            heading={strProp(props, "heading", "")}
            submitLabel={strProp(props, "submitLabel", "Submit")}
            successMessage={strProp(props, "successMessage", "Thank you!")}
            fields={fields}
            mode={ctx.mode}
          />
        </div>
      );
    }

    case "custom_html": {
      const cleanHtml = sanitizeHtmlSubset(strProp(props, "html", ""));
      return (
        <div
          className={cn("bldr-custom-html", extraClassName)}
          {...domAttrs}
          style={compiledStyle}
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
    }
  }
}
