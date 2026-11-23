"use client";
import Link from "next/link";
import { Grid2X2, List, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Pagination } from "@/components/ui/data-display";
import { useStored } from "@/lib/storage";
import { initialAttributes, initialCategories } from "@/mocks/catalog";
import type { Attribute, Category, Product } from "@/types/commerce";
import { ProductCard } from "./blocks";

const PAGE_SIZE = 6;

export function Listing({
  catalog,
  search,
}: {
  catalog: Product[];
  search: boolean;
}) {
  const [categoryList] = useStored<Category[]>("categories", initialCategories);
  const [attributeDefs] = useStored<Attribute[]>("attributes", initialAttributes);

  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [listView, setListView] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCategory(params.get("category") || "");
    setQuery(params.get("q") || "");
  }, []);

  const categoryProducts = useMemo(
    () => catalog.filter((p) => !category || p.category === category),
    [catalog, category]
  );

  // Dynamic filter facets driven by category + attribute configuration
  const filterFields = useMemo(() => {
    const relevantDefs = attributeDefs.filter(
      (attr) =>
        attr.filterable &&
        (attr.productType === "All products" ||
          !category ||
          attr.productType === category)
    );
    const keysFromProducts = Array.from(
      new Set(categoryProducts.flatMap((p) => Object.keys(p.attributes)))
    );
    const orderedKeys = Array.from(
      new Set([
        ...relevantDefs.sort((a, b) => a.order - b.order).map((d) => d.name),
        ...keysFromProducts,
      ])
    ).filter((name) => {
      const def = attributeDefs.find(
        (a) => a.name === name && (a.productType === category || a.productType === "All products")
      );
      if (def && !def.filterable) return false;
      const values = new Set(
        categoryProducts.flatMap((p) =>
          p.attributes[name] ? p.attributes[name].split(" / ") : []
        )
      );
      return values.size > 0;
    });
    return orderedKeys;
  }, [attributeDefs, category, categoryProducts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ceiling = maxPrice ? Number(maxPrice) : Infinity;

    const filtered = categoryProducts.filter((product) => {
      if (product.price > ceiling) return false;

      if (q) {
        const searchableAttrText = Object.entries(product.attributes)
          .filter(([name]) => {
            const def = attributeDefs.find((a) => a.name === name);
            return def ? def.searchable !== false : true;
          })
          .map(([, val]) => val)
          .join(" ");

        const haystack = [
          product.name,
          product.category,
          product.brand,
          product.description,
          searchableAttrText,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return Object.entries(filters).every(([key, val]) => {
        if (!val) return true;
        const raw = product.attributes[key] || "";
        return raw.split(" / ").includes(val);
      });
    });

    const sorted = [...filtered];
    if (sort === "low") sorted.sort((a, b) => a.price - b.price);
    if (sort === "high") sorted.sort((a, b) => b.price - a.price);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "newest")
      sorted.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return sorted;
  }, [attributeDefs, categoryProducts, filters, maxPrice, query, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeChips = [
    ...(category ? [{ key: "__category", label: `Category: ${category}` }] : []),
    ...(maxPrice ? [{ key: "__price", label: `Max $${maxPrice}` }] : []),
    ...Object.entries(filters)
      .filter(([, val]) => Boolean(val))
      .map(([key, val]) => ({ key, label: `${key}: ${val}` })),
  ];

  const categoryNames = Array.from(
    new Set([
      ...categoryList.map((c) => c.name),
      ...catalog.map((p) => p.category),
    ])
  );

  return (
    <div className="store-container">
      <div className="crumb">
        <Link href="/store">Home</Link> / {search ? "Search" : "Shop"}
        {category ? ` / ${category}` : ""}
      </div>
      <h1>{category || (search ? "Search the catalog" : "Shop all products")}</h1>
      <p className="muted">
        {categoryList.find((c) => c.name === category)?.description ||
          "Explore multi-category technical gear, studio laptops, and unlocked phones."}
      </p>

      <div className="listing-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search products"
            placeholder="Search by product, brand, CPU, size, material…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
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
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setFilters({});
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
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

          {filterFields.map((fieldName) => {
            const options = Array.from(
              new Set(
                categoryProducts.flatMap((p) =>
                  p.attributes[fieldName] ? p.attributes[fieldName].split(" / ") : []
                )
              )
            );
            return (
              <label key={fieldName}>
                {fieldName}
                <select
                  value={filters[fieldName] || ""}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, [fieldName]: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Any</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}

          {activeChips.length > 0 ? (
            <Button
              size="sm"
              onClick={() => {
                setCategory("");
                setMaxPrice("");
                setFilters({});
                setPage(1);
              }}
            >
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
                      setCategory("");
                      setFilters({});
                    } else if (chip.key === "__price") {
                      setMaxPrice("");
                    } else {
                      setFilters((prev) => ({ ...prev, [chip.key]: "" }));
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
            {visible.length} {visible.length === 1 ? "product" : "products"}
          </p>

          {paginated.length ? (
            <>
              <div
                className={
                  "store-products listing-products " + (listView ? "list-view" : "")
                }
              >
                {paginated.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                page={safePage}
                totalItems={visible.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          ) : (
            <Empty
              title="No matching products"
              text="Try adjusting your search query or clearing one of the active attribute filters."
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setMaxPrice("");
                    setFilters({});
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
