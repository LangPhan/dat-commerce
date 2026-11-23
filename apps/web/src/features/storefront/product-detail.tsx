"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Heart, Minus, Plus, ShoppingBag, Star } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { Tabs } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import { storeApi } from "@/lib/commerce-api";
import { cn, newId, usd } from "@/lib/format";
import type { ProductDto, VariantDto } from "@/types/api-commerce";
import type { ProductReview } from "@/types/commerce";

function ProductDetailInner({
  product,
  onAddToCart,
  adding,
  wished,
  toggleWishlist,
}: {
  product: ProductDto;
  onAddToCart: (variantId: string, qty: number, buyNow?: boolean) => void;
  adding: boolean;
  wished: boolean;
  toggleWishlist: () => void;
}) {
  const gallery = product.images.length
    ? product.images.map((i) => i.url)
    : [product.primaryImageUrl || "/media/terrain-fallback.jpg"];

  const [activeImage, setActiveImage] = useState(gallery[0]);
  const [zoom, setZoom] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id || ""
  );
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("description");
  const [localReviews, setLocalReviews] = useState<ProductReview[]>([
    {
      id: "r-default",
      author: "Morgan T.",
      rating: 5,
      date: "2026-11-12",
      title: "Built to last",
      comment: "Well made, accurate specs, and reliable right out of the box.",
      verified: true,
    },
  ]);
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const selectedVariant: VariantDto | undefined =
    product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];
  const effectiveStock = selectedVariant?.availableStock ?? 0;
  const effectivePrice = Number(selectedVariant?.price ?? product.minPrice);
  const compareAt = selectedVariant?.compareAtPrice
    ? Number(selectedVariant.compareAtPrice)
    : product.compareAtPrice
      ? Number(product.compareAtPrice)
      : undefined;
  const primaryCat = product.categories[0];

  return (
    <div className="store-container">
      <div className="crumb">
        <Link href="/store">Home</Link> /{" "}
        {primaryCat ? (
          <Link href={`/store/shop?category=${encodeURIComponent(primaryCat.slug)}`}>
            {primaryCat.name}
          </Link>
        ) : (
          <Link href="/store/shop">Shop</Link>
        )}{" "}
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
          <p className="detail-kicker">
            {product.brand || "Terrain"} · {primaryCat?.name || product.productTypeName}
          </p>
          <h1>{product.name}</h1>

          <div className="detail-rating">
            <span className="inline-label">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={13}
                  fill={i < Math.round(Number(product.rating || 4.8)) ? "currentColor" : "none"}
                />
              ))}
              <strong>{Number(product.rating || 4.8).toFixed(1)}</strong>
            </span>
            <a href="#reviews" className="muted">
              {localReviews.length} {localReviews.length === 1 ? "review" : "reviews"}
            </a>
            {selectedVariant ? (
              <span className="muted">
                SKU <code>{selectedVariant.sku}</code>
              </span>
            ) : null}
          </div>

          <div className="detail-price-row">
            <p className="detail-price">{usd(effectivePrice)}</p>
            {compareAt && compareAt > effectivePrice ? (
              <span className="detail-compare">{usd(compareAt)}</span>
            ) : null}
          </div>

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
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={cn(
                    "variant-pill",
                    selectedVariant?.id === variant.id && "active"
                  )}
                  onClick={() => {
                    setSelectedVariantId(variant.id);
                    setQuantity(1);
                  }}
                >
                  {variant.title}
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
              disabled={!selectedVariant || effectiveStock <= 0 || adding}
              onClick={() =>
                selectedVariant && onAddToCart(selectedVariant.id, quantity, false)
              }
            >
              <ShoppingBag size={16} /> Add to cart
            </Button>
            <Button
              size="lg"
              disabled={!selectedVariant || effectiveStock <= 0 || adding}
              onClick={() =>
                selectedVariant && onAddToCart(selectedVariant.id, quantity, true)
              }
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
              {product.attributes.map((attr) => {
                const rawDisplay =
                  attr.displayValue ||
                  (attr.value !== null && attr.value !== undefined
                    ? String(attr.value)
                    : "—");
                const formatted =
                  attr.unit &&
                  rawDisplay !== "—" &&
                  !rawDisplay.toLowerCase().endsWith(attr.unit.toLowerCase())
                    ? `${rawDisplay} ${attr.unit}`
                    : rawDisplay;
                return (
                  <div key={attr.definitionId}>
                    <dt>{attr.name}</dt>
                    <dd>{formatted}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </div>

      <section
        id="reviews"
        style={{ marginTop: 42, paddingTop: 24, borderTop: "1px solid var(--border)" }}
      >
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
                  placeholder="Sam K."
                />
              </label>
              <label>
                Rating
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                >
                  <option value={5}>5 stars — Exceptional</option>
                  <option value={4}>4 stars — Strong</option>
                  <option value={3}>3 stars — Solid</option>
                </select>
              </label>
              <label>
                Headline
                <input
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="First impressions"
                />
              </label>
              <label>
                Review
                <textarea
                  required
                  rows={3}
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  placeholder="Share fit, battery, or material feedback…"
                />
              </label>
              <Button variant="primary" type="submit">
                Submit review
              </Button>
            </form>
          </div>

          <div className="form-stack">
            {localReviews.map((review) => (
              <article key={review.id} className="review-card">
                <div className="review-head">
                  <strong>{review.title}</strong>
                  <span className="inline-label">
                    {Array.from({ length: review.rating }, (_, i) => (
                      <Star key={i} size={12} fill="currentColor" />
                    ))}
                  </span>
                </div>
                <p style={{ fontSize: 13.5 }}>{review.comment}</p>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                  {review.author} · {review.date}
                  {review.verified ? (
                    <span className="inline-label" style={{ marginLeft: 8, color: "var(--success)" }}>
                      <Check size={11} /> Verified purchase
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ProductDetail({
  idOrSlug,
  onAddToCart,
  adding,
  wished,
  toggleWishlist,
}: {
  idOrSlug: string;
  onAddToCart: (variantId: string, qty: number, buyNow?: boolean) => void;
  adding: boolean;
  wished: boolean;
  toggleWishlist: (productId: string) => void;
}) {
  const productQuery = useQuery({
    queryKey: ["store-product", idOrSlug],
    queryFn: () => storeApi.getProduct(idOrSlug),
  });

  if (productQuery.isLoading) {
    return (
      <div className="store-container">
        <Skeleton rows={5} />
      </div>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <div className="store-container">
        <Empty
          title="Product not found"
          text={
            productQuery.error instanceof ApiError
              ? productQuery.error.message
              : "This item may no longer be available."
          }
          action={
            <Link className="btn primary" href="/store/shop">
              Browse catalog
            </Link>
          }
        />
      </div>
    );
  }

  const product = productQuery.data;
  return (
    <ProductDetailInner
      key={product.id}
      product={product}
      onAddToCart={onAddToCart}
      adding={adding}
      wished={wished}
      toggleWishlist={() => toggleWishlist(product.id)}
    />
  );
}
