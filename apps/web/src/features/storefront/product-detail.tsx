"use client";
import Link from "next/link";
import { Check, Heart, Minus, Plus, ShoppingBag, Star } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/overlay";
import { cn, newId, usd } from "@/lib/format";
import type { Product, ProductReview } from "@/types/commerce";

export function ProductDetail({
  product,
  add,
  wished,
  toggleWishlist,
}: {
  product: Product;
  add: (qty: number, variant: string, buyNow?: boolean) => void;
  wished: boolean;
  toggleWishlist: () => void;
}) {
  const gallery = product.gallery?.length ? product.gallery : [product.image];
  const variantOptions = product.variants?.length
    ? product.variants.map((v) => ({ label: v.label, price: v.price, stock: v.stock }))
    : (product.attributes.Size?.split(" / ") || ["Standard"]).map((label) => ({
        label,
        price: product.price,
        stock: product.stock,
      }));

  const [activeImage, setActiveImage] = useState(gallery[0]);
  const [zoom, setZoom] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(variantOptions[0]);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("description");
  const [localReviews, setLocalReviews] = useState<ProductReview[]>(
    product.reviews || [
      {
        id: "r-default",
        author: "Morgan T.",
        rating: 5,
        date: "2026-11-12",
        title: "Built to last",
        comment: "Well made, accurate sizing/specs, and comfortable right out of the box.",
        verified: true,
      },
    ]
  );

  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const effectiveStock = selectedVariant?.stock ?? product.stock;
  const effectivePrice = selectedVariant?.price ?? product.price;

  return (
    <div className="store-container">
      <div className="crumb">
        <Link href="/store">Home</Link> /{" "}
        <Link href={`/store/shop?category=${encodeURIComponent(product.category)}`}>
          {product.category}
        </Link>{" "}
        / <strong>{product.name}</strong>
      </div>

      <div className="product-detail">
        <div>
          <button
            type="button"
            className={cn("gallery-image", zoom && "zoomed")}
            onClick={() => setZoom((z) => !z)}
            aria-label={zoom ? "Zoom out product image" : "Zoom in product image"}
          >
            <img src={activeImage} alt={product.name} />
          </button>
          {gallery.length > 1 ? (
            <div className="detail-thumbs">
              {gallery.map((url, idx) => (
                <button
                  key={url + idx}
                  type="button"
                  className={cn(activeImage === url && "active")}
                  aria-label={`View image ${idx + 1}`}
                  onClick={() => setActiveImage(url)}
                >
                  <img src={url} alt={`${product.name} thumbnail ${idx + 1}`} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
            {product.brand} · {product.category}
          </span>
          <h1 style={{ marginTop: 4 }}>{product.name}</h1>

          <div className="rating">
            <Star size={15} fill="currentColor" aria-hidden="true" />
            <strong>{product.rating.toFixed(1)}</strong>
            <a href="#reviews">
              ({product.reviewCount || localReviews.length} reviews)
            </a>
          </div>

          <div className="button-row" style={{ margin: "12px 0" }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>{usd(effectivePrice)}</h2>
            {product.compareAtPrice && product.compareAtPrice > effectivePrice ? (
              <span className="muted" style={{ textDecoration: "line-through" }}>
                {usd(product.compareAtPrice)}
              </span>
            ) : null}
          </div>

          <p style={{ color: "var(--muted)", marginBottom: 14 }}>
            {product.description}
          </p>

          <p
            className={effectiveStock > 0 ? "success" : "danger"}
            style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}
          >
            {effectiveStock > 5
              ? `In stock (${effectiveStock} ready to ship)`
              : effectiveStock > 0
                ? `Low stock — only ${effectiveStock} left`
                : "Currently out of stock"}
          </p>

          <div>
            <span style={{ fontSize: 12, fontWeight: 620 }}>Configuration / Variant</span>
            <div className="variant-pills">
              {variantOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={cn(
                    "variant-pill",
                    selectedVariant?.label === opt.label && "active"
                  )}
                  onClick={() => {
                    setSelectedVariant(opt);
                    setQuantity(1);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="button-row" style={{ margin: "14px 0 20px" }}>
            <div className="qty-stepper" aria-label="Quantity selector">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= Math.max(1, effectiveStock)}
                onClick={() =>
                  setQuantity((q) => Math.min(Math.max(1, effectiveStock), q + 1))
                }
              >
                <Plus size={14} />
              </button>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={!effectiveStock}
              onClick={() => add(quantity, selectedVariant.label, false)}
            >
              <ShoppingBag size={16} /> Add to cart
            </Button>
            <Button
              size="lg"
              disabled={!effectiveStock}
              onClick={() => add(quantity, selectedVariant.label, true)}
            >
              Buy now
            </Button>
            <IconButton
              label={wished ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={wished}
              onClick={toggleWishlist}
            >
              <Heart size={18} fill={wished ? "currentColor" : "none"} />
            </IconButton>
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "description", label: "Overview" },
              { id: "specs", label: "Specifications" },
            ]}
          />

          {tab === "description" ? (
            <div style={{ paddingTop: 14, fontSize: 13.5, color: "var(--muted)" }}>
              <p>{product.description}</p>
              <ul style={{ marginTop: 10, paddingLeft: 18, display: "grid", gap: 4 }}>
                <li>30-day field trial & complimentary returns</li>
                <li>Carbon-neutral shipping on orders over $100</li>
                <li>2-year craftsmanship & hardware warranty</li>
              </ul>
            </div>
          ) : (
            <dl style={{ marginTop: 10 }}>
              {Object.entries(product.attributes).map(([name, val]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <section id="reviews" style={{ marginTop: 42, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
        <h2>Customer reviews ({localReviews.length})</h2>
        <div className="reviews-grid">
          <div className="panel form-stack">
            <h3>Write a review</h3>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reviewAuthor.trim() || !reviewBody.trim()) return;
                setLocalReviews((prev) => [
                  {
                    id: newId(),
                    author: reviewAuthor.trim(),
                    rating: reviewRating,
                    date: new Date().toISOString().slice(0, 10),
                    title: reviewTitle.trim() || "Verified experience",
                    comment: reviewBody.trim(),
                    verified: true,
                  },
                  ...prev,
                ]);
                setReviewAuthor("");
                setReviewTitle("");
                setReviewBody("");
              }}
            >
              <label>
                Your name
                <input
                  required
                  value={reviewAuthor}
                  onChange={(e) => setReviewAuthor(e.target.value)}
                  placeholder="Alex M."
                />
              </label>
              <div className="form-pair">
                <label>
                  Rating
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} stars
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Headline
                  <input
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Summary"
                  />
                </label>
              </div>
              <label>
                Review
                <textarea
                  required
                  rows={3}
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  placeholder="Share how this performed for you…"
                />
              </label>
              <div>
                <Button type="submit" variant="primary">
                  Submit review
                </Button>
              </div>
            </form>
          </div>

          <div>
            {localReviews.map((rev) => (
              <article key={rev.id} className="review-card">
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <strong>{rev.title}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {rev.date}
                  </span>
                </div>
                <div className="rating" style={{ margin: "4px 0" }}>
                  {Array.from({ length: rev.rating }, (_, i) => (
                    <Star key={i} size={12} fill="currentColor" />
                  ))}
                  <span className="muted" style={{ fontSize: 12 }}>
                    by {rev.author}
                  </span>
                  {rev.verified ? (
                    <span className="badge green">
                      <Check size={10} /> Verified
                    </span>
                  ) : null}
                </div>
                <p style={{ fontSize: 13.5, color: "var(--muted)" }}>{rev.comment}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
