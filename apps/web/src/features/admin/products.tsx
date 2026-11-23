"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import {
  Empty,
  FileUploader,
  ImageGallery,
  Pagination,
} from "@/components/ui/data-display";
import { Switch } from "@/components/ui/input";
import { newId, slugify, usd } from "@/lib/format";
import type {
  Attribute,
  Category,
  Product,
  ProductVariant,
} from "@/types/commerce";

const PAGE_SIZE = 7;

const blankProduct: Product = {
  id: "",
  name: "",
  category: "",
  brand: "Terrain",
  price: 0,
  stock: 0,
  image: "",
  gallery: [],
  description: "",
  attributes: {},
  variants: [],
  rating: 4.8,
  seoTitle: "",
  seo: "",
  salesCount: 0,
};

export function Catalog({
  products,
  save,
  categories,
  attributes,
  notify,
  route,
}: {
  products: Product[];
  save: (next: Product[]) => void;
  categories: Category[];
  attributes: Attribute[];
  notify: (message: string) => void;
  route: string[];
}) {
  const [view, id, subView] = route;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDialog, setBulkDialog] = useState<"delete" | "price" | "category" | null>(null);
  const [bulkPercent, setBulkPercent] = useState(10);
  const [bulkCategory, setBulkCategory] = useState(categories[0]?.name || "");
  const [page, setPage] = useState(1);

  const product = products.find((item) => item.id === id);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (stockFilter === "low" && !(item.stock > 0 && item.stock <= 5)) return false;
      if (stockFilter === "out" && item.stock !== 0) return false;
      if (stockFilter === "in" && item.stock <= 5) return false;
      if (!q) return true;
      return [item.name, item.category, item.brand, ...Object.values(item.attributes)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [categoryFilter, products, query, stockFilter]);

  if (id === "new" || (product && subView === "edit")) {
    return (
      <ProductForm
        key={product?.id || "new"}
        initial={product || blankProduct}
        categories={categories}
        attributes={attributes}
        cancel={() => router.push(product ? `/admin/products/${product.id}` : "/admin/products")}
        submit={(next) => {
          const final: Product = {
            ...next,
            id: next.id || slugify(next.name) + "-" + newId().slice(0, 4),
            image: next.image || next.gallery?.[0] || "/media/terrain-fallback.jpg",
            gallery: next.gallery?.length
              ? next.gallery
              : [next.image || "/media/terrain-fallback.jpg"],
            createdAt: next.createdAt || new Date().toISOString().slice(0, 10),
          };
          save(
            next.id
              ? products.map((item) => (item.id === next.id ? final : item))
              : [final, ...products]
          );
          notify(next.id ? "Product updated" : "Product created");
          router.push("/admin/products/" + final.id);
        }}
      />
    );
  }

  if (product) {
    const gallery = product.gallery?.length ? product.gallery : [product.image];
    return (
      <>
        <div className="admin-title">
          <div>
            <h1>{product.name}</h1>
            <p>
              {product.category} · {product.brand} · Rating {product.rating.toFixed(1)}
            </p>
          </div>
          <div className="button-row">
            <Link className="btn" href={`/store/product/${id}`} target="_blank">
              View in storefront
            </Link>
            <Link className="btn primary" href={`/admin/products/${id}/edit`}>
              Edit product
            </Link>
          </div>
        </div>

        <div className="admin-product-view">
          <div className="panel">
            <ImageGallery images={gallery} alt={product.name} />
          </div>
          <div className="form-stack">
            <div className="panel">
              <h2>Product overview</h2>
              <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                {product.description}
              </p>
              <dl>
                <div>
                  <dt>Price</dt>
                  <dd>
                    <strong>{usd(product.price)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Inventory</dt>
                  <dd>{product.stock} units</dd>
                </div>
                {Object.entries(product.attributes).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                <div>
                  <dt>SEO meta description</dt>
                  <dd style={{ maxWidth: 260, textAlign: "right" }}>
                    {product.seo || "—"}
                  </dd>
                </div>
              </dl>
            </div>

            {product.variants?.length ? (
              <div className="admin-table-panel table-scroll">
                <div className="section-title">
                  <h2>Variants ({product.variants.length})</h2>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Option</th>
                      <th>Price</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <code>{v.sku}</code>
                        </td>
                        <td>{v.label}</td>
                        <td>{usd(v.price)}</td>
                        <td>{v.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayed = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{view === "inventory" ? "Inventory" : "Products"}</h1>
          <p>
            {view === "inventory"
              ? "Adjust available stock levels across all SKUs."
              : "Manage multi-category items, dynamic specifications, variants, and SEO."}
          </p>
        </div>
        <Link className="btn primary" href="/admin/products/new">
          <Plus size={15} /> New product
        </Link>
      </div>

      <div className="admin-table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              placeholder="Search products, brands, specs…"
              aria-label="Search products"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <select
            aria-label="Filter category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter stock status"
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All stock states</option>
            <option value="in">In stock (&gt; 5)</option>
            <option value="low">Low stock (1–5)</option>
            <option value="out">Out of stock (0)</option>
          </select>
        </div>

        {selected.length > 0 ? (
          <div className="bulk-bar">
            <strong>{selected.length} selected</strong>
            <Button size="sm" onClick={() => setBulkDialog("price")}>
              Adjust price %
            </Button>
            <Button size="sm" onClick={() => setBulkDialog("category")}>
              Assign category
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDialog("delete")}
            >
              <Trash2 size={13} /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        ) : null}

        {displayed.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select displayed products"
                      checked={
                        displayed.length > 0 &&
                        displayed.every((item) => selected.includes(item.id))
                      }
                      onChange={(e) => {
                        const ids = displayed.map((i) => i.id);
                        setSelected(
                          e.target.checked
                            ? Array.from(new Set([...selected, ...ids]))
                            : selected.filter((idVal) => !ids.includes(idVal))
                        );
                      }}
                    />
                  </th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Price</th>
                  <th>Available</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((item) => {
                  const statusLabel =
                    item.stock > 5
                      ? "In stock"
                      : item.stock > 0
                        ? "Low stock"
                        : "Out of stock";
                  return (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={"Select " + item.name}
                          checked={selected.includes(item.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, item.id]
                                : selected.filter((v) => v !== item.id)
                            )
                          }
                        />
                      </td>
                      <td>
                        <Link
                          className="row-product"
                          href={`/admin/products/${item.id}`}
                        >
                          <img src={item.image} alt="" />
                          <div>
                            <strong>{item.name}</strong>
                            <span
                              className="muted"
                              style={{ display: "block", fontSize: 11 }}
                            >
                              {item.variants?.length || 1}{" "}
                              {(item.variants?.length || 1) === 1
                                ? "variant"
                                : "variants"}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <Badge>{item.category}</Badge>
                      </td>
                      <td>{item.brand}</td>
                      <td>{usd(item.price)}</td>
                      <td>
                        {view === "inventory" ? (
                          <input
                            aria-label={"Stock for " + item.name}
                            className="stock-input"
                            min={0}
                            type="number"
                            value={item.stock}
                            onChange={(e) =>
                              save(
                                products.map((p) =>
                                  p.id === item.id
                                    ? { ...p, stock: Math.max(0, Number(e.target.value) || 0) }
                                    : p
                                )
                              )
                            }
                          />
                        ) : (
                          `${item.stock} units`
                        )}
                      </td>
                      <td>
                        <StatusBadge status={statusLabel} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No products match"
            text="Try clearing the search query or switching category/stock filters."
          />
        )}

        <div className="table-footer">
          <Pagination
            page={safePage}
            totalItems={visible.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      {bulkDialog === "delete" ? (
        <ConfirmDialog
          title={`Delete ${selected.length} products?`}
          description="Selected products will be permanently removed from your catalog and storefront."
          confirmLabel="Delete products"
          destructive
          summary={
            <div>
              <strong>Affected products:</strong>{" "}
              {products
                .filter((p) => selected.includes(p.id))
                .map((p) => p.name)
                .join(", ")}
            </div>
          }
          onCancel={() => setBulkDialog(null)}
          onConfirm={() => {
            save(products.filter((item) => !selected.includes(item.id)));
            setSelected([]);
            setBulkDialog(null);
            notify("Selected products deleted");
          }}
        />
      ) : null}

      {bulkDialog === "price" ? (
        <Modal
          title="Bulk price adjustment"
          description={`Apply a percentage adjustment across ${selected.length} selected products.`}
          close={() => setBulkDialog(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const mult = 1 + bulkPercent / 100;
              save(
                products.map((p) =>
                  selected.includes(p.id)
                    ? { ...p, price: Math.max(1, Math.round(p.price * mult * 100) / 100) }
                    : p
                )
              );
              setBulkDialog(null);
              setSelected([]);
              notify(`Adjusted prices by ${bulkPercent > 0 ? "+" : ""}${bulkPercent}%`);
            }}
          >
            <label>
              Percentage change (use negative to discount)
              <input
                type="number"
                step="0.5"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(Number(e.target.value))}
                required
              />
            </label>
            <div className="change-summary">
              {products
                .filter((p) => selected.includes(p.id))
                .slice(0, 4)
                .map((p) => (
                  <small key={p.id}>
                    {p.name}: {usd(p.price)} →{" "}
                    <strong>{usd(Math.max(1, Math.round(p.price * (1 + bulkPercent / 100) * 100) / 100))}</strong>
                  </small>
                ))}
            </div>
            <div className="modal-actions">
              <Button onClick={() => setBulkDialog(null)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Apply price update
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {bulkDialog === "category" ? (
        <Modal
          title="Assign category"
          description={`Move ${selected.length} selected products to a category.`}
          close={() => setBulkDialog(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save(
                products.map((p) =>
                  selected.includes(p.id) ? { ...p, category: bulkCategory } : p
                )
              );
              setBulkDialog(null);
              setSelected([]);
              notify(`Moved products to ${bulkCategory}`);
            }}
          >
            <label>
              Target category
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <Button onClick={() => setBulkDialog(null)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Confirm assignment
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function ProductForm({
  initial,
  categories,
  attributes,
  cancel,
  submit,
}: {
  initial: Product;
  categories: Category[];
  attributes: Attribute[];
  cancel: () => void;
  submit: (product: Product) => void;
}) {
  const [item, setItem] = useState<Product>({
    ...initial,
    category: initial.category || categories[0]?.name || "",
    gallery: initial.gallery?.length
      ? initial.gallery
      : initial.image
        ? [initial.image]
        : [],
    variants: initial.variants || [],
  });
  const [imageUrlInput, setImageUrlInput] = useState("");

  const update = (change: Partial<Product>) =>
    setItem((current) => ({ ...current, ...change }));

  const dynamic = attributes
    .filter(
      (attr) =>
        attr.productType === item.category || attr.productType === "All products"
    )
    .sort((a, b) => a.order - b.order);

  const attrNames = Array.from(
    new Set([...dynamic.map((a) => a.name), ...Object.keys(item.attributes)])
  );

  function addVariant() {
    const next: ProductVariant = {
      id: newId(),
      sku: `${(item.name || "SKU").slice(0, 4).toUpperCase()}-${(item.variants?.length || 0) + 1}`,
      label: "New variant",
      price: item.price || 99,
      stock: 10,
    };
    update({ variants: [...(item.variants || []), next] });
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{initial.id ? `Edit ${initial.name}` : "New product"}</h1>
          <p>Configure catalog details, product-type attributes, variants, and SEO.</p>
        </div>
      </div>

      <form
        className="admin-form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          submit(item);
        }}
      >
        <div className="form-stack">
          <section className="panel form-stack">
            <h2>Product details</h2>
            <label>
              Product name
              <input
                required
                value={item.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>

            <div className="form-pair">
              <label>
                Product type / Category
                <select
                  required
                  value={item.category}
                  onChange={(e) =>
                    update({ category: e.target.value, attributes: {} })
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Brand
                <input
                  required
                  value={item.brand}
                  onChange={(e) => update({ brand: e.target.value })}
                />
              </label>
            </div>

            <label>
              Description
              <textarea
                rows={4}
                required
                value={item.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <div>
              <Button
                size="sm"
                onClick={() =>
                  update({
                    description: `${item.name || "This product"} by ${item.brand} is purpose-built for ${item.category.toLowerCase()} performance.${Object.entries(
                      item.attributes
                    )
                      .filter(([, val]) => val)
                      .map(([key, val]) => ` ${key}: ${val}.`)
                      .join("")}`,
                  })
                }
              >
                <Sparkles size={13} /> Generate description
              </Button>
            </div>

            <div className="form-pair">
              <label>
                Price ($)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => update({ price: Number(e.target.value) })}
                />
              </label>
              <label>
                Base inventory
                <input
                  required
                  type="number"
                  min="0"
                  value={item.stock}
                  onChange={(e) => update({ stock: Number(e.target.value) })}
                />
              </label>
            </div>
          </section>

          <section className="panel form-stack">
            <div className="section-title" style={{ padding: 0 }}>
              <h2>Dynamic attributes ({item.category})</h2>
              <Link href="/admin/attributes">Manage schema</Link>
            </div>
            {attrNames.length ? (
              <div className="form-pair">
                {attrNames.map((name) => (
                  <AttributeInput
                    key={name}
                    name={name}
                    attribute={dynamic.find((a) => a.name === name)}
                    value={item.attributes[name] || ""}
                    update={(val) =>
                      update({ attributes: { ...item.attributes, [name]: val } })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12.5 }}>
                No custom attributes mapped to {item.category} yet.
              </p>
            )}
          </section>

          <section className="panel form-stack">
            <div className="section-title" style={{ padding: 0 }}>
              <h2>Variants ({item.variants?.length || 0})</h2>
              <Button size="sm" onClick={addVariant}>
                <Plus size={13} /> Add variant
              </Button>
            </div>
            {item.variants?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Option label</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {item.variants.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <input
                            aria-label="Variant SKU"
                            value={v.sku}
                            style={{ maxWidth: 110 }}
                            onChange={(e) =>
                              update({
                                variants: item.variants?.map((row) =>
                                  row.id === v.id ? { ...row, sku: e.target.value } : row
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Variant option label"
                            value={v.label}
                            onChange={(e) =>
                              update({
                                variants: item.variants?.map((row) =>
                                  row.id === v.id ? { ...row, label: e.target.value } : row
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Variant price"
                            type="number"
                            min={0}
                            step="0.01"
                            style={{ maxWidth: 90 }}
                            value={v.price}
                            onChange={(e) =>
                              update({
                                variants: item.variants?.map((row) =>
                                  row.id === v.id
                                    ? { ...row, price: Number(e.target.value) }
                                    : row
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Variant stock"
                            type="number"
                            min={0}
                            style={{ maxWidth: 74 }}
                            value={v.stock}
                            onChange={(e) =>
                              update({
                                variants: item.variants?.map((row) =>
                                  row.id === v.id
                                    ? { ...row, stock: Number(e.target.value) }
                                    : row
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Remove variant"
                            onClick={() =>
                              update({
                                variants: item.variants?.filter((row) => row.id !== v.id),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12.5 }}>
                Single default SKU. Add variants for sizes, storage tiers, or colorways.
              </p>
            )}
          </section>

          <section className="panel form-stack">
            <div className="section-title" style={{ padding: 0 }}>
              <h2>Search engine listing (SEO)</h2>
              <Button
                size="sm"
                onClick={() =>
                  update({
                    seoTitle: `${item.name || "Product"} | ${item.brand} ${item.category}`,
                    seo: `Shop ${item.name || "this item"} by ${item.brand}. ${item.description.slice(0, 110)}`,
                  })
                }
              >
                <Sparkles size={13} /> Generate SEO
              </Button>
            </div>
            <label>
              SEO title
              <input
                maxLength={70}
                value={item.seoTitle || ""}
                placeholder={`${item.name || "Product name"} | Terrain`}
                onChange={(e) => update({ seoTitle: e.target.value })}
              />
            </label>
            <label>
              Meta description ({(item.seo || "").length}/160)
              <textarea
                rows={2}
                maxLength={160}
                value={item.seo || ""}
                onChange={(e) => update({ seo: e.target.value })}
              />
            </label>
            <div className="seo-preview">
              <span className="seo-preview-url">
                https://terrain.example/store/product/{slugify(item.name || "product")}
              </span>
              <span className="seo-preview-title">
                {item.seoTitle || `${item.name || "Product title"} | ${item.brand}`}
              </span>
              <span className="seo-preview-desc">
                {item.seo || item.description || "Search snippet preview appears here."}
              </span>
            </div>
          </section>

          <div className="button-row">
            <Button onClick={cancel}>Cancel</Button>
            <Button type="submit" variant="primary">
              Save product
            </Button>
          </div>
        </div>

        <aside className="panel form-stack">
          <h2>Media gallery</h2>
          <ImageGallery
            images={item.gallery || []}
            alt={item.name || "Product preview"}
            onSelectPrimary={(url) => update({ image: url })}
            onRemove={(url) => {
              const next = (item.gallery || []).filter((g) => g !== url);
              update({
                gallery: next,
                image: item.image === url ? next[0] || "" : item.image,
              });
            }}
          />
          <FileUploader
            label="Drop product image or click to upload"
            onUpload={(dataUrl) =>
              update({
                image: item.image || dataUrl,
                gallery: [...(item.gallery || []), dataUrl],
              })
            }
          />
          <div className="button-row">
            <input
              aria-label="Add image URL"
              placeholder="Paste image URL (/media/shoe-olive.jpg)"
              style={{ flex: 1 }}
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!imageUrlInput.trim()) return;
                const url = imageUrlInput.trim();
                update({
                  image: item.image || url,
                  gallery: [...(item.gallery || []), url],
                });
                setImageUrlInput("");
              }}
            >
              Add
            </Button>
          </div>
        </aside>
      </form>
    </>
  );
}

function AttributeInput({
  name,
  attribute,
  value,
  update,
}: {
  name: string;
  attribute?: Attribute;
  value: string;
  update: (value: string) => void;
}) {
  const options =
    attribute?.options
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean) || [];

  if (attribute?.type === "Boolean") {
    return (
      <div className="ui-field">
        <span className="ui-field-label">{name}</span>
        <Switch
          checked={value === "Yes" || value === "true"}
          onCheckedChange={(checked) => update(checked ? "Yes" : "No")}
          label={value === "Yes" || value === "true" ? "Yes" : "No"}
        />
      </div>
    );
  }

  if (attribute?.type === "Select" && options.length) {
    return (
      <label>
        {name}
        <select
          value={value}
          required={attribute.required}
          onChange={(e) => update(e.target.value)}
        >
          <option value="">Choose…</option>
          {options.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }

  if (attribute?.type === "Multi-select" && options.length) {
    const activeSet = new Set(value.split(" / ").filter(Boolean));
    return (
      <div className="ui-field">
        <span className="ui-field-label">{name}</span>
        <div className="button-row">
          {options.map((opt) => {
            const on = activeSet.has(opt);
            return (
              <button
                key={opt}
                type="button"
                className={"variant-pill " + (on ? "active" : "")}
                onClick={() => {
                  const next = new Set(activeSet);
                  if (on) next.delete(opt);
                  else next.add(opt);
                  update(Array.from(next).join(" / "));
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const inputType =
    attribute?.type === "Number"
      ? "number"
      : attribute?.type === "Date"
        ? "date"
        : "text";

  return (
    <label>
      {name}
      {attribute?.unit ? ` (${attribute.unit})` : ""}
      <input
        type={inputType}
        required={attribute?.required}
        value={value}
        pattern={inputType === "text" ? attribute?.validation || undefined : undefined}
        placeholder={attribute?.type === "Color" ? "e.g. Moss, Titanium, Slate" : undefined}
        onChange={(e) => update(e.target.value)}
      />
    </label>
  );
}
