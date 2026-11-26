"use client";

import { useQuery } from "@tanstack/react-query";
import { storeApi } from "@/lib/commerce-api";
import { initialBlocks } from "@/mocks/pages";
import type { CategoryDto, ProductDto } from "@/types/api-commerce";
import { StoreBlock } from "../blocks";

export function CategoriesIndexView({
  initialCategories,
  initialCatalog,
}: {
  initialCategories?: CategoryDto[];
  initialCatalog?: ProductDto[];
}) {
  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => storeApi.listCategories(),
    initialData: initialCategories,
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

  return (
    <div className="store-container">
      <h1>Shop by category</h1>
      <p className="muted">
        Browse every product line with dynamic specification filters.
      </p>
      <StoreBlock
        block={{ ...initialBlocks[1], columns: 4 }}
        catalog={catalogQuery.data?.items || []}
        categories={categoriesQuery.data || []}
      />
    </div>
  );
}
