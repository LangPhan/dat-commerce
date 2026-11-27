"use client";

import { useQuery } from "@tanstack/react-query";
import { storeApi } from "@/lib/commerce-api";
import type { ProductDto } from "@/types/api-commerce";
import { ProductCard } from "../blocks";
import { ProductDetail } from "../product-detail";
import { useStorefront } from "../storefront-context";

export function ProductPageView({
  idOrSlug,
  initialProduct,
  initialRelated,
}: {
  idOrSlug: string;
  initialProduct?: ProductDto | null;
  initialRelated?: ProductDto[];
}) {
  const { wishlistSet, toggleWishlist, addToCart, addingToCart } = useStorefront();

  const hasInitialRelated = Boolean(initialRelated && initialRelated.length > 0);
  const relatedQuery = useQuery({
    queryKey: ["store-related-products", idOrSlug],
    queryFn: () => storeApi.listProducts({ size: 5 }),
    enabled: !hasInitialRelated,
    staleTime: 60_000,
  });

  const relatedSource = hasInitialRelated
    ? initialRelated!
    : relatedQuery.data?.items || [];
  const related = relatedSource
    .filter((p) => p.id !== idOrSlug && p.slug !== idOrSlug)
    .slice(0, 4);

  const isWished =
    wishlistSet.has(idOrSlug) ||
    (initialProduct ? wishlistSet.has(initialProduct.id) : false);

  return (
    <>
      <ProductDetail
        key={idOrSlug}
        idOrSlug={idOrSlug}
        initialProduct={initialProduct}
        onAddToCart={(variantId, qty, buyNow) =>
          addToCart({ variantId, qty, buyNow })
        }
        adding={addingToCart}
        wished={isWished}
        toggleWishlist={toggleWishlist}
      />
      {related.length ? (
        <div className="store-container" style={{ paddingTop: 0 }}>
          <h2>Related products</h2>
          <div className="store-products">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
