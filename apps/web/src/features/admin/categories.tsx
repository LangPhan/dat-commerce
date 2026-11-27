"use client";

import { revalidateStorefrontCache } from "@/lib/revalidate-store";
import { STORE_CACHE_TAGS } from "@/lib/store-cache-tags";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormDialog, FormDialogRow } from "@/components/ui/form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type CategoryRow = CategoryDto & {
  depth: number;
  parentName: string;
  defaultTypeName: string;
};

export function CategoryManager({ notify }: { notify: (message: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");

  const [query, setQuery] = useState("");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setModalDraft(null);
      queryClient.invalidateQueries({ queryKey: ["store-categories"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.categories, STORE_CACHE_TAGS.catalog], paths: ["/", "/store/categories", "/store/shop"] }).catch(() => undefined);
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
      queryClient.invalidateQueries({ queryKey: ["store-categories"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.categories, STORE_CACHE_TAGS.catalog], paths: ["/", "/store/categories", "/store/shop"] }).catch(() => undefined);
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
      queryClient.invalidateQueries({ queryKey: ["store-categories"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.categories, STORE_CACHE_TAGS.catalog], paths: ["/", "/store/categories", "/store/shop"] }).catch(() => undefined);
      notify("Category removed");
    },
    onError: (err) => {
      setConfirmDelete(null);
      notify(err instanceof ApiError ? err.message : "Failed to delete category");
    },
  });

  const categories: CategoryDto[] = useMemo(
    () => categoriesQuery.data || [],
    [categoriesQuery.data]
  );
  const productTypes: ProductTypeDto[] = useMemo(
    () => typesQuery.data || [],
    [typesQuery.data]
  );

  const rows: CategoryRow[] = useMemo(() => {
    const byId = new Map<string, CategoryDto>();
    const childrenByParent = new Map<string | null, CategoryDto[]>();
    for (const c of categories) {
      byId.set(c.id, c);
      const pKey = c.parentId || null;
      const bucket = childrenByParent.get(pKey);
      if (bucket) bucket.push(c);
      else childrenByParent.set(pKey, [c]);
    }
    const typeById = new Map(productTypes.map((pt) => [pt.id, pt.name]));
    const ordered: CategoryRow[] = [];
    const seen = new Set<string>();

    function visit(parentId: string | null, depth: number) {
      const children = childrenByParent.get(parentId);
      if (!children) return;
      for (const item of children) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        ordered.push({
          ...item,
          depth,
          parentName: item.parentId ? byId.get(item.parentId)?.name || "—" : "Top-level",
          defaultTypeName: item.defaultProductTypeId
            ? typeById.get(item.defaultProductTypeId) || "—"
            : "—",
        });
        visit(item.id, depth + 1);
      }
    }

    visit(null, 0);
    for (const item of categories) {
      if (!seen.has(item.id)) {
        ordered.push({
          ...item,
          depth: 0,
          parentName: item.parentId ? byId.get(item.parentId)?.name || "—" : "Top-level",
          defaultTypeName: item.defaultProductTypeId
            ? typeById.get(item.defaultProductTypeId) || "—"
            : "—",
        });
      }
    }

    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.defaultTypeName.toLowerCase().includes(q)
    );
  }, [categories, productTypes, query]);

  const parentOptions = categories.filter((c) => c.id !== modalDraft?.id);
  const selectedDefaultType = modalDraft?.defaultProductTypeId
    ? productTypes.find((pt) => pt.id === modalDraft.defaultProductTypeId)
    : undefined;

  function openCreate() {
    setError("");
    setModalDraft({
      name: "",
      slug: "",
      parentId: "",
      description: "",
      seoDescription: "",
      imageUrl: "/media/terrain-fallback.jpg",
      defaultProductTypeId: productTypes[0]?.id || "",
    });
  }

  function openEdit(cat: CategoryDto) {
    setError("");
    setModalDraft({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId || "",
      description: cat.description || "",
      seoDescription: cat.seoDescription || "",
      imageUrl: cat.imageUrl || "/media/terrain-fallback.jpg",
      defaultProductTypeId: cat.defaultProductTypeId || "",
    });
  }

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      id: "name",
      header: "Category",
      cell: (cat) => (
        <div className="inline-label" style={{ paddingLeft: `${cat.depth * 18}px` }}>
          <Folder size={14} className="muted" />
          <div>
            {canWrite ? (
              <button
                type="button"
                className="text-button"
                onClick={() => openEdit(cat)}
              >
                {cat.name}
              </button>
            ) : (
              <strong>{cat.name}</strong>
            )}
            {cat.description ? (
              <span className="muted" style={{ display: "block", fontSize: 11.5 }}>
                {cat.description}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "slug",
      header: "Slug",
      cell: (cat) => <code>{cat.slug}</code>,
    },
    {
      id: "parent",
      header: "Hierarchy",
      cell: (cat) => <span className="muted">{cat.parentName}</span>,
    },
    {
      id: "defaultType",
      header: "Default type",
      cell: (cat) =>
        cat.defaultTypeName !== "—" ? (
          <Badge tone="accent">{cat.defaultTypeName}</Badge>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      id: "count",
      header: "Products",
      cell: (cat) => <Badge>{cat.productCount}</Badge>,
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Actions",
            align: "right" as const,
            cell: (cat: CategoryRow) => (
              <div className="button-row" style={{ justifyContent: "flex-end" }}>
                <IconButton label={`Edit ${cat.name}`} onClick={() => openEdit(cat)}>
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  label={`Delete ${cat.name}`}
                  onClick={() => setConfirmDelete(cat)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ),
          },
        ]
      : []),
  ];

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
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} /> Add category
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(cat) => cat.id}
        isLoading={categoriesQuery.isLoading}
        pageSize={10}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search category name, slug, or product type…"
        searchAriaLabel="Search categories"
        emptyState={
          <Empty
            title="No categories match"
            text="Create a category or clear your search query."
          />
        }
      />

      {modalDraft ? (
        <FormDialog
          open
          onOpenChange={(nextOpen) => !nextOpen && setModalDraft(null)}
          size="lg"
          title={modalDraft.id ? `Edit ${modalDraft.name}` : "New category"}
          description="Configure category metadata, hierarchy parent, and default product type binding."
          submitLabel={modalDraft.id ? "Save category" : "Create category"}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          error={error}
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (!modalDraft.name.trim()) {
              setError("Category name is required.");
              return;
            }
            if (modalDraft.id) {
              updateMutation.mutate({ id: modalDraft.id, form: modalDraft });
            } else {
              createMutation.mutate(modalDraft);
            }
          }}
        >
          <FormDialogRow>
            <label>
              Name
              <input
                required
                value={modalDraft.name}
                placeholder="Trail Packs"
                onChange={(e) => {
                  const name = e.target.value;
                  setModalDraft((prev) =>
                    prev
                      ? { ...prev, name, slug: prev.id ? prev.slug : slugify(name) }
                      : null
                  );
                }}
              />
            </label>
            <label>
              Slug
              <input
                required={Boolean(modalDraft.id)}
                value={modalDraft.slug}
                placeholder="trail-packs"
                onChange={(e) =>
                  setModalDraft((prev) =>
                    prev ? { ...prev, slug: slugify(e.target.value) } : null
                  )
                }
              />
            </label>
          </FormDialogRow>

          <FormDialogRow>
            <label>
              Parent category
              <Select
                items={[
                  { value: "", label: "Top-level root" },
                  ...parentOptions.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={modalDraft.parentId}
                onValueChange={(next) =>
                  setModalDraft((prev) =>
                    prev ? { ...prev, parentId: next ?? "" } : null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Top-level root</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Default product type
              <Select
                items={[
                  { value: "", label: "None" },
                  ...productTypes.map((pt) => ({ value: pt.id, label: pt.name })),
                ]}
                value={modalDraft.defaultProductTypeId}
                onValueChange={(next) =>
                  setModalDraft((prev) =>
                    prev ? { ...prev, defaultProductTypeId: next ?? "" } : null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {productTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </FormDialogRow>

          <label>
            Category image URL
            <input
              value={modalDraft.imageUrl}
              placeholder="/media/terrain-fallback.jpg"
              onChange={(e) =>
                setModalDraft((prev) =>
                  prev ? { ...prev, imageUrl: e.target.value } : null
                )
              }
            />
          </label>

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

          <label>
            SEO meta description
            <textarea
              rows={2}
              value={modalDraft.seoDescription}
              onChange={(e) =>
                setModalDraft((prev) =>
                  prev ? { ...prev, seoDescription: e.target.value } : null
                )
              }
            />
          </label>

          {selectedDefaultType?.attributes?.length ? (
            <div className="panel" style={{ padding: 12, boxShadow: "none" }}>
              <strong style={{ fontSize: 12.5 }}>
                Bound attributes via {selectedDefaultType.name}
              </strong>
              <div className="button-row" style={{ marginTop: 8 }}>
                {selectedDefaultType.attributes.map((attr) => (
                  <Badge key={attr.attributeDefinitionId} tone="accent">
                    {attr.name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </FormDialog>
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
