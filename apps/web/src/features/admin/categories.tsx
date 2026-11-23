"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { adminCatalogApi } from "@/lib/commerce-api";
import { slugify } from "@/lib/format";
import type { CategoryDto, ProductTypeDto } from "@/types/api-commerce";

type CategoryForm = {
  id?: string;
  name: string;
  slug: string;
  parentId: string;
  description: string;
  seoDescription: string;
  imageUrl: string;
  defaultProductTypeId: string;
};

export function CategoryManager({ notify }: { notify: (message: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");

  const [selectedId, setSelectedId] = useState<string>("");
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [modalDraft, setModalDraft] = useState<CategoryForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CategoryDto | null>(null);
  const [error, setError] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminCatalogApi.listCategories(),
  });

  const typesQuery = useQuery({
    queryKey: ["admin-product-types"],
    queryFn: () => adminCatalogApi.listProductTypes(),
  });

  const createMutation = useMutation({
    mutationFn: (form: CategoryForm) =>
      adminCatalogApi.createCategory({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        parentId: form.parentId || null,
        description: form.description.trim() || undefined,
        seoDescription: form.seoDescription.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        defaultProductTypeId: form.defaultProductTypeId || null,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setModalDraft(null);
      setSelectedId(created.id);
      notify("Category created");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to create category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: CategoryForm }) =>
      adminCatalogApi.updateCategory(id, {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        parentId: form.parentId || null,
        clearParent: !form.parentId,
        description: form.description.trim(),
        seoDescription: form.seoDescription.trim(),
        imageUrl: form.imageUrl.trim() || undefined,
        defaultProductTypeId: form.defaultProductTypeId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setModalDraft(null);
      notify("Category saved");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to update category"),
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => adminCatalogApi.deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setConfirmDelete(null);
      setSelectedId("");
      notify("Category removed");
    },
    onError: (err) => {
      setConfirmDelete(null);
      notify(err instanceof ApiError ? err.message : "Failed to delete category");
    },
  });

  const categories: CategoryDto[] = categoriesQuery.data || [];
  const productTypes: ProductTypeDto[] = typesQuery.data || [];
  const selected = categories.find((c) => c.id === selectedId) || categories[0];

  const defaultTypeForSelected = selected?.defaultProductTypeId
    ? productTypes.find((pt) => pt.id === selected.defaultProductTypeId)
    : undefined;

  function renderTree(parentId: string | null, depth = 0): React.ReactNode {
    if (depth > categories.length + 1) return null;
    return categories
      .filter((item) => (item.parentId || null) === parentId)
      .map((item) => {
        const children = categories.filter((c) => (c.parentId || null) === item.id);
        const isCollapsed = collapsedIds.includes(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              className={"category-node " + (selected?.id === item.id ? "active" : "")}
              style={{ paddingLeft: 10 + depth * 18 }}
              onClick={() => setSelectedId(item.id)}
            >
              {children.length ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsedIds((prev) =>
                      isCollapsed
                        ? prev.filter((v) => v !== item.id)
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
              <small>{item.productCount}</small>
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
          <p>
            Organize catalog hierarchy, SEO copy, and default product type bindings.
          </p>
        </div>
        {canWrite ? (
          <Button
            variant="primary"
            onClick={() => {
              setError("");
              setModalDraft({
                name: "",
                slug: "",
                parentId: selected?.id || "",
                description: "",
                seoDescription: "",
                imageUrl: "/media/terrain-fallback.jpg",
                defaultProductTypeId: productTypes[0]?.id || "",
              });
            }}
          >
            <Plus size={15} /> Add category
          </Button>
        ) : null}
      </div>

      {categoriesQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : !categories.length ? (
        <Empty
          title="No categories yet"
          text="Create your first category to structure the storefront catalog."
        />
      ) : (
        <div className="admin-split">
          <div className="panel">{renderTree(null)}</div>

          {selected ? (
            <form
              key={selected.id}
              className="panel category-detail form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canWrite) return;
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: selected.id,
                  form: {
                    name: String(fd.get("name") || ""),
                    slug: String(fd.get("slug") || ""),
                    parentId: String(fd.get("parentId") || ""),
                    description: String(fd.get("description") || ""),
                    seoDescription: String(fd.get("seoDescription") || ""),
                    imageUrl: String(fd.get("imageUrl") || ""),
                    defaultProductTypeId: String(fd.get("defaultProductTypeId") || ""),
                  },
                });
              }}
            >
              <div className="section-title">
                <h2>{selected.name}</h2>
                <Badge tone="accent">{selected.productCount} products</Badge>
              </div>

              <div className="form-pair">
                <label>
                  Name
                  <input
                    name="name"
                    required
                    disabled={!canWrite}
                    defaultValue={selected.name}
                  />
                </label>
                <label>
                  Slug
                  <input
                    name="slug"
                    required
                    disabled={!canWrite}
                    defaultValue={selected.slug}
                  />
                </label>
              </div>

              <div className="form-pair">
                <label>
                  Parent category
                  <select
                    name="parentId"
                    disabled={!canWrite}
                    defaultValue={selected.parentId || ""}
                  >
                    <option value="">Top-level root</option>
                    {categories
                      .filter((c) => c.id !== selected.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Default product type
                  <select
                    name="defaultProductTypeId"
                    disabled={!canWrite}
                    defaultValue={selected.defaultProductTypeId || ""}
                  >
                    <option value="">None</option>
                    {productTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Category image URL
                <input
                  name="imageUrl"
                  disabled={!canWrite}
                  defaultValue={selected.imageUrl || ""}
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  rows={2}
                  disabled={!canWrite}
                  defaultValue={selected.description || ""}
                />
              </label>

              <label>
                SEO meta description
                <textarea
                  name="seoDescription"
                  rows={2}
                  disabled={!canWrite}
                  defaultValue={selected.seoDescription || ""}
                />
              </label>

              {defaultTypeForSelected ? (
                <div className="panel" style={{ padding: 12 }}>
                  <strong style={{ fontSize: 12.5 }}>
                    Bound attributes via {defaultTypeForSelected.name}
                  </strong>
                  <div className="button-row" style={{ marginTop: 8 }}>
                    {defaultTypeForSelected.attributes.map((attr) => (
                      <Badge key={attr.attributeDefinitionId} tone="accent">
                        {attr.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {canWrite ? (
                <div className="button-row">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={updateMutation.isPending}
                  >
                    Save category
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmDelete(selected)}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              ) : null}
            </form>
          ) : null}
        </div>
      )}

      {modalDraft ? (
        <Modal
          title="New category"
          description="Create a storefront category node and optionally link a default product type."
          close={() => setModalDraft(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (!modalDraft.name.trim()) {
                setError("Category name is required.");
                return;
              }
              createMutation.mutate(modalDraft);
            }}
          >
            <div className="form-pair">
              <label>
                Name
                <input
                  required
                  value={modalDraft.name}
                  placeholder="Trail Packs"
                  onChange={(e) => {
                    const name = e.target.value;
                    setModalDraft((prev) =>
                      prev ? { ...prev, name, slug: slugify(name) } : null
                    );
                  }}
                />
              </label>
              <label>
                Slug
                <input
                  value={modalDraft.slug}
                  placeholder="trail-packs"
                  onChange={(e) =>
                    setModalDraft((prev) =>
                      prev ? { ...prev, slug: slugify(e.target.value) } : null
                    )
                  }
                />
              </label>
            </div>

            <div className="form-pair">
              <label>
                Parent
                <select
                  value={modalDraft.parentId}
                  onChange={(e) =>
                    setModalDraft((prev) =>
                      prev ? { ...prev, parentId: e.target.value } : null
                    )
                  }
                >
                  <option value="">Top-level root</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Default product type
                <select
                  value={modalDraft.defaultProductTypeId}
                  onChange={(e) =>
                    setModalDraft((prev) =>
                      prev ? { ...prev, defaultProductTypeId: e.target.value } : null
                    )
                  }
                >
                  <option value="">None</option>
                  {productTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Description
              <textarea
                rows={2}
                value={modalDraft.description}
                onChange={(e) =>
                  setModalDraft((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
              />
            </label>

            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="modal-actions">
              <Button onClick={() => setModalDraft(null)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createMutation.isPending}
              >
                Create category
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${confirmDelete.name}?`}
          description="Product links to this category will be unlinked cleanly."
          confirmLabel="Delete category"
          destructive
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        />
      ) : null}
    </>
  );
}
