"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Grid2X2, Link2, List, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  areListingStatesEqual,
  buildListingHref,
  parseListingSearchParams,
  type ListingSort,
  type ListingUrlState,
} from "./listing-url";

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
  initialUrlState,
  onReady,
}: {
  search?: boolean;
  forcedCategory?: string;
  initialProducts?: StoreProductListResponse | null;
  initialCategories?: CategoryDto[];
  initialUrlState?: ListingUrlState;
  onReady?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlState = useMemo(
    () => parseListingSearchParams(searchParams, forcedCategory),
    [searchParams, forcedCategory]
  );

  const activeCategory = urlState.category;
  const sort = urlState.sort;
  const maxPrice = urlState.maxPrice;
  const attrs = urlState.attrs;
  const listView = urlState.view === "list";
  const page = urlState.page;

  const [searchInput, setSearchInput] = useState(urlState.q);
  const [copiedLink, setCopiedLink] = useState(false);
  const prevUrlQRef = useRef(urlState.q);

  useEffect(() => {
    if (prevUrlQRef.current !== urlState.q) {
      prevUrlQRef.current = urlState.q;
      setSearchInput(urlState.q);
    }
  }, [urlState.q]);

  const commitUrlState = useCallback(
    (
      patch: Partial<ListingUrlState>,
      options?: { mode?: "push" | "replace"; targetPathname?: string }
    ) => {
      const cleanedAttrs: Record<string, string> = {};
      const nextAttrsRaw = patch.attrs !== undefined ? patch.attrs : urlState.attrs;
      for (const [k, v] of Object.entries(nextAttrsRaw)) {
        const trimmedK = k.trim();
        const trimmedV = v.trim();
        if (trimmedK && trimmedV) {
          cleanedAttrs[trimmedK] = trimmedV;
        }
      }

      const nextState: ListingUrlState = {
        ...urlState,
        ...patch,
        attrs: cleanedAttrs,
      };

      let targetPath = options?.targetPathname ?? pathname;
      let targetForcedCategory = forcedCategory;
      if (!options?.targetPathname && forcedCategory && nextState.category !== forcedCategory) {
        if (nextState.category) {
          targetPath = `/store/category/${encodeURIComponent(nextState.category)}`;
          targetForcedCategory = nextState.category;
        } else {
          targetPath = "/store/shop";
          targetForcedCategory = undefined;
        }
      } else if (options?.targetPathname === "/store/shop") {
        targetForcedCategory = undefined;
      }

      const nextHref = buildListingHref(targetPath, nextState, {
        forcedCategory: targetForcedCategory,
      });
      const currentRawQuery = searchParams.toString();
      const currentHref = currentRawQuery ? `${pathname}?${currentRawQuery}` : pathname;
      if (nextHref === currentHref) {
        return;
      }

      if (options?.mode === "replace") {
        router.replace(nextHref, { scroll: false });
      } else {
        router.push(nextHref, { scroll: false });
      }
    },
    [urlState, pathname, forcedCategory, searchParams, router]
  );

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === urlState.q) return;
    const timer = window.setTimeout(() => {
      commitUrlState({ q: trimmed, page: 1 }, { mode: "replace" });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, urlState.q, commitUrlState]);

  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => storeApi.listCategories(),
    initialData: initialCategories,
    staleTime: 60_000,
  });

  const matchesInitialSsrState =
    Boolean(initialProducts) &&
    Boolean(initialUrlState) &&
    areListingStatesEqual(urlState, initialUrlState!);

  const productsQuery = useQuery({
    queryKey: [
      "store-products",
      urlState.q,
      activeCategory,
      maxPrice,
      sort,
      attrs,
      page,
    ],
    queryFn: () =>
      storeApi.listProducts({
        q: urlState.q || undefined,
        category: activeCategory || undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort,
        page: page - 1,
        size: PAGE_SIZE,
        attrs,
      }),
    initialData: matchesInitialSsrState ? initialProducts ?? undefined : undefined,
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
  const totalPages = data?.totalPages || 0;

  useEffect(() => {
    if (!productsQuery.isPlaceholderData && data && totalPages > 0 && page > totalPages) {
      commitUrlState({ page: totalPages }, { mode: "replace" });
    }
  }, [productsQuery.isPlaceholderData, data, totalPages, page, commitUrlState]);

  const activeCategoryObj = categories.find(
    (c) =>
      c.slug.toLowerCase() === activeCategory.toLowerCase() ||
      c.name.toLowerCase() === activeCategory.toLowerCase()
  );

  const maxPriceItems = useMemo(() => {
    if (!maxPrice || MAX_PRICE_ITEMS.some((i) => i.value === maxPrice)) {
      return MAX_PRICE_ITEMS;
    }
    return [...MAX_PRICE_ITEMS, { value: maxPrice, label: `Under $${maxPrice}` }];
  }, [maxPrice]);

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
    setSearchInput("");
    commitUrlState(
      {
        q: "",
        category: "",
        maxPrice: "",
        sort: "featured",
        attrs: {},
        page: 1,
      },
      {
        mode: "push",
        targetPathname: forcedCategory ? "/store/shop" : pathname,
      }
    );
  }

  async function handleCopyShareLink() {
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* Clipboard permission unavailable */
    }
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitUrlState({ q: searchInput.trim(), page: 1 }, { mode: "replace" });
              }
            }}
          />
        </label>
        <Select
          items={SORT_ITEMS}
          value={sort}
          onValueChange={(next) => {
            if (!next) return;
            commitUrlState({ sort: next as ListingSort, page: 1 }, { mode: "push" });
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
          onClick={() => commitUrlState({ view: "grid" }, { mode: "replace" })}
        >
          <Grid2X2 size={16} />
        </IconButton>
        <IconButton
          label="List view"
          aria-pressed={listView}
          className={listView ? "active" : ""}
          onClick={() => commitUrlState({ view: "list" }, { mode: "replace" })}
        >
          <List size={16} />
        </IconButton>
        <IconButton
          label={copiedLink ? "Link copied" : "Copy shareable link"}
          title={copiedLink ? "Link copied" : "Copy shareable link"}
          onClick={handleCopyShareLink}
        >
          {copiedLink ? <Check size={16} /> : <Link2 size={16} />}
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
                  commitUrlState(
                    { category: next ?? "", attrs: {}, page: 1 },
                    { mode: "push" }
                  );
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
                items={maxPriceItems}
                value={maxPrice}
                onValueChange={(next) => {
                  commitUrlState({ maxPrice: next ?? "", page: 1 }, { mode: "push" });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {maxPriceItems.map((item) => (
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
                      const val = (next ?? "").trim();
                      const nextAttrs = { ...attrs };
                      if (val) {
                        nextAttrs[facet.code] = val;
                      } else {
                        delete nextAttrs[facet.code];
                      }
                      commitUrlState({ attrs: nextAttrs, page: 1 }, { mode: "push" });
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
          {activeChips.length > 0 || urlState.q || sort !== "featured" ? (
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
                      commitUrlState({ category: "", attrs: {}, page: 1 }, { mode: "push" });
                    } else if (chip.key === "__price") {
                      commitUrlState({ maxPrice: "", page: 1 }, { mode: "push" });
                    } else {
                      const nextAttrs = { ...attrs };
                      delete nextAttrs[chip.key];
                      commitUrlState({ attrs: nextAttrs, page: 1 }, { mode: "push" });
                    }
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
                onPageChange={(nextPage) => {
                  commitUrlState({ page: nextPage }, { mode: "push" });
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
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
