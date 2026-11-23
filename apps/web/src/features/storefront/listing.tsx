"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Grid2X2, List, Search, X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Pagination, Skeleton } from "@/components/ui/data-display";
import { ApiError } from "@/lib/api-client";
import { storeApi } from "@/lib/commerce-api";
import { ProductCard } from "./blocks";

const PAGE_SIZE = 6;

export function Listing({
  search = false,
  forcedCategory,
}: {
  search?: boolean;
  forcedCategory?: string;
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

  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => storeApi.listCategories(),
  });

  const productsQuery = useQuery({
    queryKey: [
      "store-products",
      activeQuery,
      activeCategory,
      maxPrice,
      sort,
      attrs,
      page,
    ],
    queryFn: () =>
      storeApi.listProducts({
        q: activeQuery.trim() || undefined,
        category: activeCategory || undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort,
        page: page - 1,
        size: PAGE_SIZE,
        attrs,
      }),
  });

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
    ...Object.entries(attrs)
      .filter(([, val]) => Boolean(val))
      .map(([code, val]) => {
        const facet = facets.find((f) => f.code === code);
        return { key: code, label: `${facet?.name || code}: ${val}` };
      }),
  ];

  function clearFilters() {
    setCategoryOverride("");
    setQueryOverride("");
    setMaxPrice("");
    setAttrs({});
    setPage(1);
  }

  return (
    <div className="store-container">
      <div className="crumb">
        <Link href="/store">Home</Link> / {search ? "Search" : "Shop"}
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
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="featured">Featured</option>
          <option value="low">Price: Low to High</option>
          <option value="high">Price: High to Low</option>
          <option value="rating">Top Rated</option>
          <option value="newest">Newest</option>
        </select>
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
          <strong style={{ fontSize: 13 }}>Filters</strong>
          <label>
            Category
            <select
              value={activeCategory}
              onChange={(e) => {
                setCategoryOverride(e.target.value);
                setAttrs({});
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Max price
            <select
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Any price</option>
              <option value="150">Under $150</option>
              <option value="300">Under $300</option>
              <option value="1000">Under $1,000</option>
              <option value="2000">Under $2,000</option>
            </select>
          </label>

          {facets.map((facet) => (
            <label key={facet.code}>
              {facet.name}
              {facet.unit ? ` (${facet.unit})` : ""}
              <select
                value={attrs[facet.code] || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setAttrs((prev) => ({ ...prev, [facet.code]: val }));
                  setPage(1);
                }}
              >
                <option value="">Any</option>
                {facet.values.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {activeChips.length > 0 ? (
            <Button size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
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
                className={
                  "store-products listing-products " + (listView ? "list-view" : "")
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
