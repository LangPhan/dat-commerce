"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { isV2Content } from "@/features/builder/migration";
import { PageRenderer } from "@/features/builder/renderer/PageRenderer";
import { dtoToPresetDefinition } from "@/features/motion/presets";
import { cmsStoreApi } from "@/lib/cms-ai-api";
import { apiBlocksToEditorBlocks } from "@/lib/cms-schema";
import { storeApi } from "@/lib/commerce-api";
import type { AnimationPresetDto, StorePageResponse } from "@/types/api-cms-ai";
import type { CategoryDto, ProductDto } from "@/types/api-commerce";
import type { Block } from "@/types/editor";
import { StoreBlock } from "../blocks";
import { useStorefront } from "../storefront-context";

export function CmsPageView({
  slug,
  initialPage,
  initialCatalog,
  initialCategories,
  initialPresets,
  fallbackBlocks,
}: {
  slug: string;
  initialPage?: StorePageResponse | null;
  initialCatalog?: ProductDto[];
  initialCategories?: CategoryDto[];
  initialPresets?: AnimationPresetDto[];
  fallbackBlocks?: Block[];
}) {
  const queryClient = useQueryClient();
  const { theme, quickAddToCart, notify } = useStorefront();

  const cmsPageQuery = useQuery({
    queryKey: ["store-cms-page", slug],
    queryFn: () => cmsStoreApi.getPage(slug),
    initialData: initialPage ?? undefined,
    staleTime: initialPage ? 30_000 : 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const prevInitialPageVerRef = useRef(initialPage?.versionNumber);
  useEffect(() => {
    if (initialPage && initialPage.versionNumber !== prevInitialPageVerRef.current) {
      prevInitialPageVerRef.current = initialPage.versionNumber;
      queryClient.setQueryData(["store-cms-page", slug], initialPage);
    }
  }, [initialPage, slug, queryClient]);

  const catalogQuery = useQuery({
    queryKey: ["store-home-catalog"],
    queryFn: () => storeApi.listProducts({ size: 24 }),
    initialData: initialCatalog
      ? { items: initialCatalog, page: 0, size: 24, totalElements: initialCatalog.length, totalPages: 1, facets: [] }
      : undefined,
    staleTime: 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => storeApi.listCategories(),
    initialData: initialCategories,
    staleTime: 60_000,
  });

  const presetsQuery = useQuery({
    queryKey: ["store-animation-presets"],
    queryFn: () => cmsStoreApi.listAnimationPresets(),
    initialData: initialPresets,
    staleTime: 60_000,
    retry: false,
  });

  const customPresets = useMemo(
    () => (presetsQuery.data || []).map(dtoToPresetDefinition),
    [presetsQuery.data]
  );

  const catalog = catalogQuery.data?.items || [];
  const categories = categoriesQuery.data || [];

  if (cmsPageQuery.isLoading && !fallbackBlocks) {
    return (
      <div className="store-container">
        <Skeleton rows={4} />
      </div>
    );
  }

  if (cmsPageQuery.data) {
    if (isV2Content(cmsPageQuery.data.content)) {
      return (
        <PageRenderer
          mode="live"
          nodes={cmsPageQuery.data.content.nodes}
          typography={theme?.tokens?.typography}
          globalMotion={theme?.tokens?.motion}
          customPresets={customPresets}
          catalog={catalog}
          categories={categories}
          onAddToCart={quickAddToCart}
          onNotify={notify}
        />
      );
    }

    const blocks = apiBlocksToEditorBlocks(cmsPageQuery.data.content);
    return (
      <>
        {blocks
          .filter((block) => block.visible)
          .map((block) => (
            <StoreBlock
              key={block.id}
              block={block}
              catalog={catalog}
              categories={categories}
            />
          ))}
      </>
    );
  }

  if (fallbackBlocks?.length) {
    return (
      <>
        {fallbackBlocks
          .filter((block) => block.visible)
          .map((block) => (
            <StoreBlock
              key={block.id}
              block={block}
              catalog={catalog}
              categories={categories}
            />
          ))}
      </>
    );
  }

  return (
    <div className="store-container">
      <h1>Page not found</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        The page you requested does not exist or has moved.
      </p>
      <Link className="btn primary" href="/">
        Return home
      </Link>
    </div>
  );
}
