"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { cmsStoreApi } from "@/lib/cms-ai-api";
import { apiBlocksToEditorBlocks } from "@/lib/cms-schema";
import { storeApi } from "@/lib/commerce-api";
import { pageTemplates } from "@/mocks/pages";
import type { StorePageResponse } from "@/types/api-cms-ai";
import type { CollectionDto, ProductDto } from "@/types/api-commerce";
import { ProductCard, StoreBlock } from "../blocks";

export function CollectionsView({
  collectionSlug,
  initialPage,
  initialCollections,
  initialCatalog,
}: {
  collectionSlug?: string;
  initialPage?: StorePageResponse | null;
  initialCollections?: CollectionDto[];
  initialCatalog?: ProductDto[];
}) {
  const cmsPageQuery = useQuery({
    queryKey: ["store-cms-page", "collections"],
    queryFn: () => cmsStoreApi.getPage("collections"),
    enabled: !collectionSlug,
    initialData: initialPage ?? undefined,
    staleTime: 60_000,
    retry: false,
  });

  const collectionsQuery = useQuery({
    queryKey: ["store-collections"],
    queryFn: () => storeApi.listCollections(),
    initialData: initialCollections,
    staleTime: 60_000,
  });

  const catalogQuery = useQuery({
    queryKey: ["store-home-catalog"],
    queryFn: () => storeApi.listProducts({ size: 24 }),
    initialData: initialCatalog
      ? { items: initialCatalog, page: 0, size: 24, totalElements: initialCatalog.length, totalPages: 1, facets: [] }
      : undefined,
    staleTime: 60_000,
  });

  const collections = collectionsQuery.data || [];
  const catalog = catalogQuery.data?.items || [];
  const filteredCollections = collectionSlug
    ? collections.filter((c) => c.slug === collectionSlug || c.id === collectionSlug)
    : collections;

  const colHeaderBlocks =
    !collectionSlug && cmsPageQuery.data
      ? apiBlocksToEditorBlocks(cmsPageQuery.data.content)
      : !collectionSlug
        ? pageTemplates["Collections page"] || []
        : [];

  return (
    <>
      {colHeaderBlocks
        .filter((block) => block.visible)
        .map((block) => (
          <StoreBlock
            key={block.id}
            block={block}
            catalog={catalog}
            categories={[]}
          />
        ))}
      {collectionsQuery.isLoading ? (
        <div className="store-container">
          <Skeleton rows={4} />
        </div>
      ) : filteredCollections.length ? (
        filteredCollections.map((collection) => {
          const productIdSet = new Set(collection.productIds);
          return (
            <div className="store-container" key={collection.id}>
              <div className="store-section-head">
                <div>
                  <h1>{collection.name}</h1>
                  {collection.description ? (
                    <p className="muted">{collection.description}</p>
                  ) : null}
                </div>
                <Link href="/store/shop">
                  Shop all <ArrowRight size={14} />
                </Link>
              </div>
              <div className="store-products">
                {catalog.flatMap((product) =>
                  productIdSet.has(product.id)
                    ? [<ProductCard key={product.id} product={product} />]
                    : []
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="store-container">
          <Empty
            title="Collection not found"
            text="Explore our full catalog for available releases."
            action={
              <Link className="btn primary" href="/store/shop">
                Shop all products
              </Link>
            }
          />
        </div>
      )}
    </>
  );
}
