"use client";
import Link from "next/link";
import { ArrowRight, Play, Star } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/dialog";
import { cn, usd } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { initialCategories, initialProducts } from "@/mocks/catalog";
import type { Category, Product } from "@/types/commerce";
import type { Block } from "@/types/editor";

export function ProductCard({ product }: { product: Product }) {
  const isLow = product.stock > 0 && product.stock <= 5;
  return (
    <Link className="product-card" href={`/store/product/${product.id}`}>
      <div className="product-card-img-wrap">
        <img src={product.image} alt={product.name} />
        {isLow ? (
          <span className="product-card-badge">Only {product.stock} left</span>
        ) : product.compareAtPrice && product.compareAtPrice > product.price ? (
          <span className="product-card-badge">Sale</span>
        ) : null}
      </div>
      <div className="product-card-meta">
        <strong>{product.name}</strong>
        <span>{usd(product.price)}</span>
      </div>
      <div className="product-card-sub">
        <span>
          {product.brand} · {product.category}
        </span>
        <span className="product-card-rating">
          <Star size={11} fill="currentColor" aria-hidden="true" />
          {product.rating.toFixed(1)}
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
  catalog = initialProducts,
}: {
  block: Block;
  catalog?: Product[];
}) {
  const [categories] = useStored<Category[]>("categories", initialCategories);
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
        {layout === "split" ? (
          <img src={image} alt={heading} />
        ) : null}
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
    const list =
      type === "Best Sellers"
        ? [...catalog].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        : [...catalog].reverse();
    const count = columns === 3 ? 3 : columns === 2 ? 2 : 4;

    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div className="store-section-head">
          <div>
            {kicker ? (
              <div
                className="hero-kicker"
                style={{ color: tone === "ink" ? "#b7c4ff" : "var(--accent-text)", marginBottom: 6 }}
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
          {list.slice(0, count).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    );
  }

  if (type === "Featured Categories") {
    const topCats = categories.filter((c) => !c.parent).slice(0, columns === 3 ? 3 : 4);
    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div className="store-section-head">
          <div>
            {kicker ? (
              <div
                className="hero-kicker"
                style={{ color: tone === "ink" ? "#b7c4ff" : "var(--accent-text)", marginBottom: 6 }}
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
        <div className={cn("store-products", colsClass)}>
          {topCats.map((category) => {
            const match = catalog.find((p) => p.category === category.name);
            const count = catalog.filter((p) => p.category === category.name).length;
            return (
              <Link
                className="category-card"
                key={category.id}
                href={`/store/shop?category=${encodeURIComponent(category.name)}`}
              >
                <img src={category.image || match?.image || image} alt={category.name} />
                <strong>{category.name}</strong>
                <ArrowRight size={15} />
                <small>{count} {count === 1 ? "product" : "products"}</small>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  if (type === "Image Gallery") {
    const galleryItems = items.length
      ? items
      : catalog.slice(0, 4).map((p) => ({
          id: p.id,
          title: p.name,
          body: p.category,
          image: p.image,
        }));

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
      : [{ id: "t-default", title: "Maya Rivera", subtitle: "Verified Buyer", body: copy }];
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
      : [{ id: "faq-1", title: copy || "What is your return policy?", body: "Returns are accepted within 30 days of delivery." }];
    return (
      <section className={cn("store-section", toneClass, spacingClass)}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {kicker ? (
            <div className="hero-kicker" style={{ color: "var(--accent-text)", marginBottom: 6 }}>
              {kicker}
            </div>
          ) : null}
          <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: "clamp(24px,3vw,36px)", fontWeight: 500 }}>
            {heading}
          </h2>
          {copy ? <p className="muted" style={{ marginTop: 6 }}>{copy}</p> : null}
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
          <Modal
            title={heading}
            description={copy}
            close={() => setVideoOpen(false)}
          >
            <div className="form-stack">
              <img
                src={image}
                alt={heading}
                style={{ width: "100%", borderRadius: 8, aspectRatio: "16 / 9", objectFit: "cover" }}
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
