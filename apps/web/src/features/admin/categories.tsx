"use client";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, Folder, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/data-display";
import { newId } from "@/lib/format";
import type { Attribute, Category, Product } from "@/types/commerce";

export function CategoryManager({
  categories,
  save,
  products,
  updateProducts,
  attributes,
  notify,
}: {
  categories: Category[];
  save: (next: Category[]) => void;
  products: Product[];
  updateProducts: (next: Product[]) => void;
  attributes: Attribute[];
  notify: (message: string) => void;
}) {
  const [current, setCurrent] = useState(categories[0]?.id || "");
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [editor, setEditor] = useState<Category | null>(null);
  const [assign, setAssign] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const selected =
    categories.find((category) => category.id === current) || categories[0];
  const assigned = selected
    ? products.filter((product) => product.category === selected.name)
    : [];
  const matchingAttrs = selected
    ? attributes.filter(
        (attr) =>
          attr.productType === "All products" ||
          attr.productType === selected.name
      )
    : [];

  function renderTree(parent: string, depth = 0): React.ReactNode {
    if (depth > categories.length) return null;
    return categories
      .filter((item) => item.parent === parent)
      .map((item) => {
        const children = categories.filter((c) => c.parent === item.id);
        const isCollapsed = collapsedIds.includes(item.id);
        const count = products.filter((p) => p.category === item.name).length;

        return (
          <div key={item.id}>
            <button
              type="button"
              className={"category-node " + (selected?.id === item.id ? "active" : "")}
              style={{ paddingLeft: 10 + depth * 18 }}
              onClick={() => setCurrent(item.id)}
            >
              {children.length ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsedIds((prev) =>
                      isCollapsed
                        ? prev.filter((idVal) => idVal !== item.id)
                        : [...prev, item.id]
                    );
                  }}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </span>
              ) : (
                <Folder size={13} />
              )}
              <span>{item.name}</span>
              <small>{count}</small>
            </button>
            {!isCollapsed ? renderTree(item.id, depth + 1) : null}
          </div>
        );
      });
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Categories</h1>
          <p>Organize hierarchical categories, assigned products, and attribute schemas.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setError("");
            setEditor({ id: "", name: "", parent: "", description: "", seoDescription: "", image: "" });
          }}
        >
          <Plus size={15} /> New category
        </Button>
      </div>

      <div className="admin-split">
        <aside className="panel">
          <h2 style={{ marginBottom: 8 }}>Category tree</h2>
          {renderTree("")}
        </aside>

        {selected ? (
          <section className="panel category-detail form-stack">
            <div className="section-title" style={{ padding: 0 }}>
              <div>
                <h2>{selected.name}</h2>
                {selected.parent ? (
                  <span className="muted" style={{ fontSize: 12 }}>
                    Parent: {categories.find((c) => c.id === selected.parent)?.name}
                  </span>
                ) : null}
              </div>
              <div className="button-row">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditor(selected);
                    setError("");
                  }}
                >
                  Edit category
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Delete category"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            {selected.image ? <img src={selected.image} alt={selected.name} /> : null}
            <p>{selected.description || "No storefront description yet."}</p>
            {selected.seoDescription ? (
              <div className="seo-preview">
                <span className="seo-preview-url">Category SEO summary</span>
                <span className="seo-preview-desc">{selected.seoDescription}</span>
              </div>
            ) : null}

            <div className="section-title">
              <h3>Assigned products ({assigned.length})</h3>
              <Button
                size="sm"
                onClick={() => setAssign(assigned.map((p) => p.id))}
              >
                Assign products
              </Button>
            </div>
            {assigned.length ? (
              <div>
                {assigned.map((product) => (
                  <Link
                    className="dash-product"
                    href={`/admin/products/${product.id}`}
                    key={product.id}
                  >
                    <img src={product.image} alt="" />
                    <strong>{product.name}</strong>
                    <small>{product.stock} in stock</small>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12.5 }}>
                No products assigned to {selected.name} yet.
              </p>
            )}

            <div className="section-title">
              <h3>Attribute configuration ({matchingAttrs.length})</h3>
              <Link href="/admin/attributes">
                Configure attributes <ArrowRight size={13} />
              </Link>
            </div>
            <div className="button-row">
              {matchingAttrs.length ? (
                matchingAttrs.map((attr) => (
                  <Badge key={attr.id} tone="accent">
                    {attr.name} · {attr.type}
                  </Badge>
                ))
              ) : (
                <span className="muted" style={{ fontSize: 12.5 }}>
                  No attributes configured for this product type.
                </span>
              )}
            </div>
          </section>
        ) : (
          <Empty
            title="No categories"
            text="Create a category to organize products and dynamic filters."
          />
        )}
      </div>

      {editor ? (
        <Modal
          title={editor.id ? "Edit category" : "New category"}
          description="Set hierarchy, imagery, and storefront SEO copy."
          close={() => setEditor(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const cleanName = editor.name.trim();
              if (
                categories.some(
                  (item) =>
                    item.name.toLowerCase() === cleanName.toLowerCase() &&
                    item.id !== editor.id
                )
              ) {
                setError("A category with this name already exists.");
                return;
              }
              const next: Category = {
                ...editor,
                name: cleanName,
                id: editor.id || newId(),
              };
              if (editor.id) {
                let parent = next.parent;
                while (parent) {
                  if (parent === editor.id) {
                    setError("Choose a parent outside this category's descendants.");
                    return;
                  }
                  parent = categories.find((item) => item.id === parent)?.parent || "";
                }
                const old = categories.find((item) => item.id === editor.id);
                if (old && old.name !== next.name) {
                  updateProducts(
                    products.map((item) =>
                      item.category === old.name ? { ...item, category: next.name } : item
                    )
                  );
                }
              }
              save(
                editor.id
                  ? categories.map((item) => (item.id === editor.id ? next : item))
                  : [...categories, next]
              );
              setCurrent(next.id);
              setEditor(null);
              notify("Category saved");
            }}
          >
            <label>
              Name
              <input
                required
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            <label>
              Parent category
              <select
                value={editor.parent}
                onChange={(e) => setEditor({ ...editor, parent: e.target.value })}
              >
                <option value="">Top-level category</option>
                {categories
                  .filter((item) => item.id !== editor.id)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Image URL
              <input
                value={editor.image}
                placeholder="/media/shoe-olive.jpg"
                onChange={(e) => setEditor({ ...editor, image: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                rows={2}
                value={editor.description}
                onChange={(e) =>
                  setEditor({ ...editor, description: e.target.value })
                }
              />
            </label>
            <label>
              SEO description
              <textarea
                rows={2}
                value={editor.seoDescription || ""}
                onChange={(e) =>
                  setEditor({ ...editor, seoDescription: e.target.value })
                }
              />
            </label>
            <div>
              <Button
                size="sm"
                onClick={() =>
                  setEditor({
                    ...editor,
                    seoDescription: `Explore ${editor.name || "our"} essentials crafted for durability, precision specs, and fast delivery on Terrain Supply.`,
                  })
                }
              >
                <Sparkles size={13} /> Generate SEO description
              </Button>
            </div>
            {error ? (
              <p role="alert" className="danger">
                {error}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Save category
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {assign && selected ? (
        <Modal
          title={`Assign products to ${selected.name}`}
          description="Checked products move into this category; unchecked items from this category become Uncategorized."
          close={() => setAssign(null)}
        >
          <div className="form-stack" style={{ maxHeight: "45dvh", overflow: "auto" }}>
            {products.map((product) => (
              <label className="check-label" key={product.id}>
                <input
                  type="checkbox"
                  checked={assign.includes(product.id)}
                  onChange={(e) =>
                    setAssign(
                      e.target.checked
                        ? [...assign, product.id]
                        : assign.filter((idVal) => idVal !== product.id)
                    )
                  }
                />
                <span>
                  {product.name} <small className="muted">({product.category})</small>
                </span>
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <Button onClick={() => setAssign(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                updateProducts(
                  products.map((item) =>
                    assign.includes(item.id)
                      ? { ...item, category: selected.name }
                      : item.category === selected.name
                        ? { ...item, category: "Uncategorized" }
                        : item
                  )
                );
                setAssign(null);
                notify("Product assignments saved");
              }}
            >
              Save assignments
            </Button>
          </div>
        </Modal>
      ) : null}

      {confirmDelete && selected ? (
        <ConfirmDialog
          title={`Delete category "${selected.name}"?`}
          description="Products currently in this category will remain in your catalog as Uncategorized."
          confirmLabel="Delete category"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            save(
              categories
                .filter((c) => c.id !== selected.id)
                .map((c) => (c.parent === selected.id ? { ...c, parent: "" } : c))
            );
            updateProducts(
              products.map((p) =>
                p.category === selected.name ? { ...p, category: "Uncategorized" } : p
              )
            );
            setConfirmDelete(false);
            setCurrent("");
            notify("Category deleted");
          }}
        />
      ) : null}
    </>
  );
}
