"use client";

import Link from "next/link";
import { ArrowRight, Play, Star } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/dialog";
import { cn, usd } from "@/lib/format";
const EMPTY_PRODUCTS: StoreProductItem[] = [];
const EMPTY_CATEGORIES: StoreCategoryItem[] = [];

function getSalesCount(item: StoreProductItem): number {
  return isApiProduct(item) ? item.reviewCount || 0 : item.salesCount || 0;
}
import type { CategoryDto, ProductDto } from "@/types/api-commerce";
import type { Category, Product } from "@/types/commerce";
import type { Block } from "@/types/editor";

export type StoreProductItem = Product | ProductDto;
export type StoreCategoryItem = Category | CategoryDto;

function isApiProduct(item: StoreProductItem): item is ProductDto {
  return "minPrice" in item;
}

function isApiCategory(item: StoreCategoryItem): item is CategoryDto {
  return "productCount" in item;
}

function normalizeProduct(item: StoreProductItem) {
  if (isApiProduct(item)) {
    return {
      key: item.id,
      href: `/store/product/${encodeURIComponent(item.slug)}`,
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
    };
  }
  return {
    key: item.id,
    href: `/store/product/${encodeURIComponent(item.id)}`,
    name: item.name,
    brand: item.brand,
    categoryLabel: item.category,
    categoryKey: item.category,
    image: item.image,
    price: item.price,
    compareAtPrice: item.compareAtPrice,
    stock: item.stock,
    rating: item.rating,
    salesCount: item.salesCount || 0,
  };
}

export function ProductCard({ product }: { product: StoreProductItem }) {
  const p = normalizeProduct(product);
  const isLow = p.stock > 0 && p.stock <= 5;
  return (
    <Link className="product-card" data-builder-part="card" href={p.href}>
      <div className="product-card-img-wrap" data-builder-part="image_wrap">
        <img src={p.image} alt={p.name} data-builder-part="image" />
        {isLow ? (
          <span className="product-card-badge" data-builder-part="badge">
            Only {p.stock} left
          </span>
        ) : p.compareAtPrice && p.compareAtPrice > p.price ? (
          <span className="product-card-badge" data-builder-part="badge">
            Sale
          </span>
        ) : null}
      </div>
      <div className="product-card-meta">
        <strong data-builder-part="title">{p.name}</strong>
        <span data-builder-part="price">{usd(p.price)}</span>
      </div>
      <div className="product-card-sub">
        <span data-builder-part="subtitle">
          {p.brand} · {p.categoryLabel}
        </span>
        <span className="product-card-rating" data-builder-part="rating">
          <Star size={11} fill="currentColor" aria-hidden="true" />
          {p.rating.toFixed(1)}
        </span>
      </div>
    </Link>
  );
}

function NewsletterForm({ block }: { block: Block }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <form
      className="newsletter-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) setSubscribed(true);
      }}
    >
      {subscribed ? (
        <p role="status" style={{ fontWeight: 600 }}>
          Subscribed ({email}). Watch your inbox for our next field dispatch.
        </p>
      ) : (
        <>
          <input
            type="email"
            aria-label="Email address"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn primary" type="submit">
            {block.action || "Subscribe"}
          </button>
        </>
      )}
    </form>
  );
}

export function StoreBlock({
  block,
  catalog = EMPTY_PRODUCTS,
  categories = EMPTY_CATEGORIES,
}: {
  block: Block;
  catalog?: StoreProductItem[];
  categories?: StoreCategoryItem[];
}) {
  const [videoOpen, setVideoOpen] = useState(false);

  const {
    type,
    kicker,
    heading,
    copy,
    action,
    actionUrl = "/store/shop",
    image,
    tone,
    layout,
    scale,
    spacing = "comfortable",
    columns = 4,
    items = [],
  } = block;

  const toneClass = `block-${tone}`;
  const layoutClass = `block-${layout}`;
  const scaleClass = `block-${scale}`;
  const spacingClass = `spacing-${spacing}`;
  const colsClass = columns === 2 ? "cols-2" : columns === 3 ? "cols-3" : "";

  if (type === "Hero" || type === "Collection Banner") {
    const HeadingTag = type === "Hero" ? "h1" : "h2";
    return (
      <section
        className={cn("store-hero", toneClass, layoutClass, scaleClass)}
        style={{
          backgroundImage: layout === "split" ? undefined : `url("${image}")`,
        }}
      >
        <div className="hero-copy">
          {kicker ? <div className="hero-kicker">{kicker}</div> : null}
          <HeadingTag>{heading}</HeadingTag>
          <p>{copy}</p>
          {action ? (
            <Link href={actionUrl || "/store/shop"} className="hero-link">
              {action}
              <ArrowRight size={15} />
            </Link>
          ) : null}
        </div>
        {layout === "split" ? <img src={image} alt={heading} /> : null}
      </section>
    );
  }

  if (type === "Image with Text") {
    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div className="store-split-editorial">
          <img src={image} alt={heading} />
          <div>
            {kicker ? (
              <div
                className="hero-kicker"
                style={{ color: tone === "ink" ? "#b7c4ff" : "var(--accent-text)" }}
              >
                {kicker}
              </div>
            ) : null}
            <h2>{heading}</h2>
            <p>{copy}</p>
            {action ? (
              <Link href={actionUrl || "/store/about"} className="btn primary">
                {action}
                <ArrowRight size={14} />
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (type === "Best Sellers" || type === "Product Grid") {
    const count = columns === 3 ? 3 : columns === 2 ? 2 : 4;
    const list =
      type === "Best Sellers"
        ? catalog.toSorted((a, b) => getSalesCount(b) - getSalesCount(a)).slice(0, count)
        : catalog.slice(-count).reverse();

    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div className="store-section-head">
          <div>
            {kicker ? (
              <div
                className="hero-kicker"
                style={{
                  color: tone === "ink" ? "#b7c4ff" : "var(--accent-text)",
                  marginBottom: 6,
                }}
              >
                {kicker}
              </div>
            ) : null}
            <h2>{heading}</h2>
            <p>{copy}</p>
          </div>
          <Link href={actionUrl || "/store/shop"}>
            {action || "View all"}
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className={cn("store-products", colsClass)}>
          {list.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    );
  }

  if (type === "Featured Categories") {
    const topCats = categories
      .filter((c) => (isApiCategory(c) ? !c.parentId : !c.parent))
      .slice(0, columns === 3 ? 3 : 4);
    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div className="store-section-head">
          <div>
            {kicker ? (
              <div
                className="hero-kicker"
                style={{
                  color: tone === "ink" ? "#b7c4ff" : "var(--accent-text)",
                  marginBottom: 6,
                }}
              >
                {kicker}
              </div>
            ) : null}
            <h2>{heading}</h2>
            <p>{copy}</p>
          </div>
          <Link href="/store/categories">
            {action || "Browse all"}
            <ArrowRight size={14} />
          </Link>
        </div>
        {(() => {
          const bySlug = new Map<string, string>();
          const byLabel = new Map<string, { image: string; count: number }>();
          for (const p of catalog) {
            const np = normalizeProduct(p);
            if (np.categoryKey && !bySlug.has(np.categoryKey)) {
              bySlug.set(np.categoryKey, np.image);
            }
            if (np.categoryLabel) {
              const existing = byLabel.get(np.categoryLabel);
              if (existing) {
                existing.count += 1;
              } else {
                byLabel.set(np.categoryLabel, { image: np.image, count: 1 });
              }
            }
          }
          return (
            <div className={cn("store-products", colsClass)}>
              {topCats.map((category) => {
                if (isApiCategory(category)) {
                  const imgUrl = category.imageUrl || bySlug.get(category.slug) || image;
                  return (
                    <Link
                      className="category-card"
                      key={category.id}
                      href={`/store/shop?category=${encodeURIComponent(category.slug)}`}
                    >
                      <img src={imgUrl} alt={category.name} />
                      <strong>{category.name}</strong>
                      <ArrowRight size={15} />
                      <small>
                        {category.productCount}{" "}
                        {category.productCount === 1 ? "product" : "products"}
                      </small>
                    </Link>
                  );
                }
                const stats = byLabel.get(category.name);
                const count = stats?.count ?? 0;
                return (
                  <Link
                    className="category-card"
                    key={category.id}
                    href={`/store/shop?category=${encodeURIComponent(category.name)}`}
                  >
                    <img src={category.image || stats?.image || image} alt={category.name} />
                    <strong>{category.name}</strong>
                    <ArrowRight size={15} />
                    <small>
                      {count} {count === 1 ? "product" : "products"}
                    </small>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </section>
    );
  }

  if (type === "Image Gallery") {
    const galleryItems = items.length
      ? items
      : catalog.slice(0, 4).map((item) => {
          const p = normalizeProduct(item);
          return {
            id: p.key,
            title: p.name,
            body: p.categoryLabel,
            image: p.image,
          };
        });

    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div className="store-section-head">
          <div>
            {kicker ? (
              <div
                className="hero-kicker"
                style={{ color: "var(--accent-text)", marginBottom: 6 }}
              >
                {kicker}
              </div>
            ) : null}
            <h2>{heading}</h2>
            <p>{copy}</p>
          </div>
        </div>
        <div className="gallery-mosaic">
          {galleryItems.map((tile) => (
            <figure key={tile.id} className="gallery-tile">
              <img src={tile.image || image} alt={tile.title} />
              <figcaption>
                <strong>{tile.title}</strong> — {tile.body}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    );
  }

  if (type === "Testimonials") {
    const quoteList = items.length
      ? items
      : [
          {
            id: "t-default",
            title: "Maya Rivera",
            subtitle: "Verified Buyer",
            body: copy,
          },
        ];
    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div className="store-section-head">
          <div>
            {kicker ? (
              <div
                className="hero-kicker"
                style={{ color: "var(--accent-text)", marginBottom: 6 }}
              >
                {kicker}
              </div>
            ) : null}
            <h2>{heading}</h2>
            <p>{copy}</p>
          </div>
        </div>
        <div className="testimonial-grid">
          {quoteList.map((item) => (
            <article key={item.id} className="testimonial-card">
              <div>
                <div className="testimonial-stars" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={13} fill="currentColor" />
                  ))}
                </div>
                <blockquote style={{ marginTop: 10 }}>“{item.body}”</blockquote>
              </div>
              <div className="testimonial-author">
                <strong>{item.title}</strong>
                {item.subtitle ? <span>{item.subtitle}</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (type === "FAQ") {
    const faqItems = items.length
      ? items
      : [
          {
            id: "faq-1",
            title: copy || "What is your return policy?",
            body: "Returns are accepted within 30 days of delivery.",
          },
        ];
    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {kicker ? (
            <div
              className="hero-kicker"
              style={{ color: "var(--accent-text)", marginBottom: 6 }}
            >
              {kicker}
            </div>
          ) : null}
          <h2
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "clamp(24px,3vw,36px)",
              fontWeight: 500,
            }}
          >
            {heading}
          </h2>
          {copy ? (
            <p className="muted" style={{ marginTop: 6 }}>
              {copy}
            </p>
          ) : null}
        </div>
        <div className="faq-list">
          {faqItems.map((item, idx) => (
            <details key={item.id} className="faq-item" open={idx === 0}>
              <summary>{item.title}</summary>
              <p>{item.body}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }

  if (type === "Logo Cloud") {
    const logos = items.length
      ? items
      : [
          { id: "l1", title: "GEAR PATROL", body: "Editor Pick" },
          { id: "l2", title: "MONOCLE", body: "Design Feature" },
          { id: "l3", title: "OUTSIDE", body: "Gear of the Year" },
        ];
    return (
      <section className={cn("store-text", toneClass)}>
        {kicker ? (
          <div className="hero-kicker" style={{ color: "var(--muted)", marginBottom: 8 }}>
            {kicker}
          </div>
        ) : null}
        <h2>{heading}</h2>
        <div className="logo-cloud-row">
          {logos.map((logo) => (
            <div key={logo.id} className="logo-cloud-item">
              <strong>{logo.title}</strong>
              <small>{logo.body}</small>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (type === "Video Section") {
    return (
      <section className={cn("store-text", toneClass)}>
        {kicker ? <div className="hero-kicker">{kicker}</div> : null}
        <h2>{heading}</h2>
        <p>{copy}</p>
        <div className="video-showcase">
          <img src={image} alt={heading} />
          <button
            type="button"
            className="video-play-btn"
            aria-label={`Play ${heading}`}
            onClick={() => setVideoOpen(true)}
          >
            <span className="video-play-pill">
              <Play size={15} fill="currentColor" />
              {action || "Watch film"}
            </span>
          </button>
        </div>
        {videoOpen ? (
          <Modal title={heading} description={copy} close={() => setVideoOpen(false)}>
            <div className="form-stack">
              <img
                src={image}
                alt={heading}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  aspectRatio: "16 / 9",
                  objectFit: "cover",
                }}
              />
              <p className="muted" style={{ fontSize: 13 }}>
                Studio & Field Documentary Preview — filmed in Portland and the North Cascades.
              </p>
            </div>
          </Modal>
        ) : null}
      </section>
    );
  }

  return (
    <section className={cn("store-text", toneClass)}>
      {kicker ? (
        <div
          className="hero-kicker"
          style={{
            color: tone === "light" ? "var(--accent-text)" : "#d6e3cc",
            marginBottom: 8,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <h2>{heading}</h2>
      <p>{copy}</p>
      {type === "Newsletter" ? <NewsletterForm block={block} /> : null}
      {(type === "Promotional Banner" || type === "Rich Text") && action ? (
        <Link className="hero-link" href={actionUrl || "/store/shop"}>
          {action}
          <ArrowRight size={14} />
        </Link>
      ) : null}
    </section>
  );
}
