"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Grid2X2, List, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Pagination, Skeleton } from "@/components/ui/data-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { storeApi } from "@/lib/commerce-api";
import type { CategoryDto, StoreProductListResponse } from "@/types/api-commerce";
import { ProductCard } from "./blocks";

const PAGE_SIZE = 6;
const SEARCH_DEBOUNCE_MS = 300;

const SORT_ITEMS = [
  { value: "featured", label: "Featured" },
  { value: "low", label: "Price: Low to High" },
  { value: "high", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "newest", label: "Newest" },
];

const MAX_PRICE_ITEMS = [
  { value: "", label: "Any price" },
  { value: "150", label: "Under $150" },
  { value: "300", label: "Under $300" },
  { value: "1000", label: "Under $1,000" },
  { value: "2000", label: "Under $2,000" },
];

export function Listing({
  search = false,
  forcedCategory,
  initialProducts,
  initialCategories,
  onReady,
}: {
  search?: boolean;
  forcedCategory?: string;
  initialProducts?: StoreProductListResponse | null;
  initialCategories?: CategoryDto[];
  onReady?: () => void;
}) {
  const searchParams = useSearchParams();
  const urlCategory = forcedCategory || searchParams.get("category") || "";
  const urlQuery = searchParams.get("q") || "";

  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [queryOverride, setQueryOverride] = useState<string | null>(null);
  const [sort, setSort] = useState("featured");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [listView, setListView] = useState(false);
  const [page, setPage] = useState(1);

  const activeCategory = categoryOverride !== null ? categoryOverride : urlCategory;
  const activeQuery = queryOverride !== null ? queryOverride : urlQuery;
  const [debouncedQuery, setDebouncedQuery] = useState(activeQuery);

  useEffect(() => {
    const trimmed = activeQuery.trim();
    if (trimmed === debouncedQuery.trim()) return;
    const timer = window.setTimeout(() => {
      setDebouncedQuery(activeQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeQuery, debouncedQuery]);

  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => storeApi.listCategories(),
    initialData: initialCategories,
    staleTime: 60_000,
  });

  const isDefaultFilterState =
    page === 1 &&
    sort === "featured" &&
    maxPrice === "" &&
    Object.keys(attrs).length === 0 &&
    debouncedQuery.trim() === urlQuery.trim() &&
    activeCategory === urlCategory;

  const productsQuery = useQuery({
    queryKey: [
      "store-products",
      debouncedQuery,
      activeCategory,
      maxPrice,
      sort,
      attrs,
      page,
    ],
    queryFn: () =>
      storeApi.listProducts({
        q: debouncedQuery.trim() || undefined,
        category: activeCategory || undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort,
        page: page - 1,
        size: PAGE_SIZE,
        attrs,
      }),
    initialData: isDefaultFilterState && initialProducts ? initialProducts : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const notifiedReadyRef = useRef(false);
  useEffect(() => {
    if (notifiedReadyRef.current) return;
    if (!productsQuery.isPending && !categoriesQuery.isPending) {
      notifiedReadyRef.current = true;
      onReady?.();
    }
  }, [productsQuery.isPending, categoriesQuery.isPending, onReady]);

  const categories = categoriesQuery.data || [];
  const data = productsQuery.data;
  const items = data?.items || [];
  const facets = data?.facets || [];
  const totalElements = data?.totalElements || 0;

  const activeCategoryObj = categories.find(
    (c) =>
      c.slug.toLowerCase() === activeCategory.toLowerCase() ||
      c.name.toLowerCase() === activeCategory.toLowerCase()
  );

  const activeChips = [
    ...(activeCategory
      ? [
          {
            key: "__category",
            label: `Category: ${activeCategoryObj?.name || activeCategory}`,
          },
        ]
      : []),
    ...(maxPrice ? [{ key: "__price", label: `Max $${maxPrice}` }] : []),
    ...(() => {
      const facetNameByCode = new Map(facets.map((f) => [f.code, f.name]));
      return Object.entries(attrs).flatMap(([code, val]) =>
        val
          ? [{ key: code, label: `${facetNameByCode.get(code) || code}: ${val}` }]
          : []
      );
    })(),
  ];

  function clearFilters() {
    setCategoryOverride("");
    setQueryOverride("");
    setDebouncedQuery("");
    setMaxPrice("");
    setAttrs({});
    setPage(1);
  }

  return (
    <div className="store-container">
      <div className="crumb">
        <Link href="/">Home</Link> / {search ? "Search" : "Shop"}
        {activeCategory ? ` / ${activeCategoryObj?.name || activeCategory}` : ""}
      </div>
      <h1>
        {activeCategoryObj?.name ||
          activeCategory ||
          (search ? "Search the catalog" : "Shop all products")}
      </h1>
      <p className="muted">
        {activeCategoryObj?.description ||
          "Explore multi-category technical gear, studio laptops, and unlocked phones."}
      </p>

      <div className="listing-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search products"
            placeholder="Search by product, brand, CPU, waterproof, material…"
            value={activeQuery}
            onChange={(e) => {
              setQueryOverride(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <Select
          items={SORT_ITEMS}
          value={sort}
          onValueChange={(next) => {
            if (!next) return;
            setSort(next);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Sort products">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <IconButton
          label="Grid view"
          aria-pressed={!listView}
          className={!listView ? "active" : ""}
          onClick={() => setListView(false)}
        >
          <Grid2X2 size={16} />
        </IconButton>
        <IconButton
          label="List view"
          aria-pressed={listView}
          className={listView ? "active" : ""}
          onClick={() => setListView(true)}
        >
          <List size={16} />
        </IconButton>
      </div>

      <div className="listing-grid">
        <aside className="filters" aria-label="Catalog filters">
          <div className="filters-header">
            <strong className="filters-title">Filters</strong>
          </div>
          <div className="filters-scroll">
          <label>
            Category
            <Select
              items={[
                { value: "", label: "All categories" },
                ...categories.map((cat) => ({ value: cat.slug, label: cat.name })),
              ]}
              value={activeCategory}
              onValueChange={(next) => {
                setCategoryOverride(next ?? "");
                setAttrs({});
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            Max price
            <Select
              items={MAX_PRICE_ITEMS}
              value={maxPrice}
              onValueChange={(next) => {
                setMaxPrice(next ?? "");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_PRICE_ITEMS.map((item) => (
                  <SelectItem key={item.value || "any"} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {facets.map((facet) => {
            const facetItems = [
              { value: "", label: "Any" },
              ...facet.values.map((val) => ({ value: val, label: val })),
            ];
            return (
              <label key={facet.code}>
                {facet.name}
                {facet.unit ? ` (${facet.unit})` : ""}
                <Select
                  items={facetItems}
                  value={attrs[facet.code] || ""}
                  onValueChange={(next) => {
                    const val = next ?? "";
                    setAttrs((prev) => ({ ...prev, [facet.code]: val }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {facetItems.map((item) => (
                      <SelectItem key={item.value || "any"} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            );
          })}

          </div>
          {activeChips.length > 0 ? (
            <div className="filters-footer">
              <Button size="sm" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          ) : null}
        </aside>

        <div>
          {activeChips.length > 0 ? (
            <div className="active-filter-chips">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="filter-chip"
                  onClick={() => {
                    if (chip.key === "__category") {
                      setCategoryOverride("");
                      setAttrs({});
                    } else if (chip.key === "__price") {
                      setMaxPrice("");
                    } else {
                      setAttrs((prev) => ({ ...prev, [chip.key]: "" }));
                    }
                    setPage(1);
                  }}
                >
                  <span>{chip.label}</span>
                  <X size={12} />
                </button>
              ))}
            </div>
          ) : null}

          <p className="muted" style={{ marginBottom: 12, fontSize: 12.5 }}>
            {totalElements} {totalElements === 1 ? "product" : "products"}
          </p>

          {productsQuery.isLoading ? (
            <Skeleton rows={4} />
          ) : productsQuery.isError ? (
            <Empty
              title="Could not load catalog"
              text={
                productsQuery.error instanceof ApiError
                  ? productsQuery.error.message
                  : "Unexpected storefront API error."
              }
            />
          ) : items.length ? (
            <>
              <div
                aria-busy={productsQuery.isPlaceholderData}
                className={
                  "store-products listing-products" +
                  (listView ? " list-view" : "") +
                  (productsQuery.isPlaceholderData ? " is-fetching" : "")
                }
              >
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                page={page}
                totalItems={totalElements}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          ) : (
            <Empty
              title="No matching products"
              text="Try adjusting your search query or clearing one of the active attribute filters."
              action={<Button onClick={clearFilters}>Reset filters</Button>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
