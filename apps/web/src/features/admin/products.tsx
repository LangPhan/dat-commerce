"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Breadcrumbs,
  Empty,
  ImageGallery,
  Skeleton,
} from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  FormDialog,
  FormDialogRow,
  FormDialogSection,
} from "@/components/ui/form-dialog";
import { Tabs } from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  adminCatalogApi,
  adminInventoryApi,
  adminMediaApi,
} from "@/lib/commerce-api";
import { cn, formatDate, slugify, usdExact } from "@/lib/format";
import type {
  InventoryLevelDto,
  ProductDto,
  ProductTypeDto,
  AdjustmentDto,
  TypeAttributeDto,
  VariantDto,
  VariantInput,
} from "@/types/api-commerce";

const PRODUCT_STATUS_ITEMS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "ARCHIVED", label: "ARCHIVED" },
];

const VARIANT_STATUS_ITEMS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "ARCHIVED", label: "ARCHIVED" },
];

const PRODUCT_STATUS_FILTER_ITEMS = [
  { value: "", label: "All statuses" },
  ...PRODUCT_STATUS_ITEMS,
];

function formatAttributeInitialValues(product?: ProductDto): Record<string, unknown> {
  if (!product) return {};
  const map: Record<string, unknown> = {};
  for (const attr of product.attributes) {
    map[attr.code] = attr.value;
  }
  return map;
}

function ProductFormDialog({
  open,
  onOpenChange,
  existing,
  notify,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ProductDto;
  notify: (msg: string) => void;
  onSaved?: (saved: ProductDto) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canUploadMedia = hasPermission("media:write");

  const typesQuery = useQuery({
    queryKey: ["admin-product-types"],
    queryFn: () => adminCatalogApi.listProductTypes(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminCatalogApi.listCategories(),
  });
  const mediaQuery = useQuery({
    queryKey: ["admin-media"],
    queryFn: () => adminMediaApi.list(),
    enabled: canUploadMedia,
  });

  const productTypes = typesQuery.data || [];
  const categories = categoriesQuery.data || [];
  const mediaAssets = mediaQuery.data || [];

  const [selectedTypeId, setSelectedTypeId] = useState(existing?.productTypeId || "");
  const [name, setName] = useState(existing?.name || "");
  const [slug, setSlug] = useState(existing?.slug || "");
  const [brand, setBrand] = useState(existing?.brand || "Terrain");
  const [status, setStatus] = useState(existing?.status || "ACTIVE");
  const [description, setDescription] = useState(existing?.description || "");
  const [seoTitle, setSeoTitle] = useState(existing?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(existing?.seoDescription || "");
  const [categoryIds, setCategoryIds] = useState<string[]>(
    existing ? existing.categories.map((c) => c.id) : []
  );
  const [attrValues, setAttrValues] = useState<Record<string, unknown>>(
    formatAttributeInitialValues(existing)
  );
  const [images, setImages] = useState<
    { mediaAssetId?: string; url: string; altText?: string }[]
  >(
    existing?.images?.length
      ? existing.images.map((i) => ({
          mediaAssetId: i.mediaAssetId || undefined,
          url: i.url,
          altText: i.altText || undefined,
        }))
      : existing?.primaryImageUrl
        ? [{ url: existing.primaryImageUrl, altText: existing.name }]
        : [{ url: "/media/terrain-fallback.jpg", altText: "Product" }]
  );
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [variants, setVariants] = useState<VariantInput[]>(
    existing?.variants?.length
      ? existing.variants.map((v) => ({
          sku: v.sku,
          title: v.title,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? undefined,
          stock: v.availableStock,
          options: v.options,
          status: v.status,
        }))
      : [
          {
            sku: "",
            title: "Standard",
            price: 129,
            stock: 15,
            options: {},
            status: "ACTIVE",
          },
        ]
  );
  const [error, setError] = useState("");
  const [confirmTypeSwitch, setConfirmTypeSwitch] = useState(false);

  const effectiveTypeId = selectedTypeId || productTypes[0]?.id || "";
  const activeProductType: ProductTypeDto | undefined = productTypes.find(
    (pt) => pt.id === effectiveTypeId
  );

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminMediaApi.upload(file, name || file.name),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      setImages((curr) => [
        { mediaAssetId: asset.id, url: asset.url, altText: asset.altText || name },
        ...curr.filter((i) => i.url !== "/media/terrain-fallback.jpg"),
      ]);
      notify("Uploaded image to S3 storage");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to upload image"),
  });

  function buildAllowedAttributes(): Record<string, unknown> {
    const allowedCodes = new Set(
      (activeProductType?.attributes || []).map((a) => a.code)
    );
    const cleaned: Record<string, unknown> = {};
    for (const [code, val] of Object.entries(attrValues)) {
      if (!allowedCodes.has(code)) continue;
      if (val === undefined || val === null || val === "") continue;
      if (Array.isArray(val) && val.length === 0) continue;
      cleaned[code] = val;
    }
    return cleaned;
  }

  const createMutation = useMutation({
    mutationFn: () => {
      if (!effectiveTypeId) throw new Error("Choose a product type");
      return adminCatalogApi.createProduct({
        productTypeId: effectiveTypeId,
        name: name.trim(),
        slug: slug.trim() || undefined,
        brand: brand.trim() || "Terrain",
        description: description.trim(),
        status,
        primaryImageUrl: images[0]?.url || "/media/terrain-fallback.jpg",
        images: images.map((img) => ({
          mediaAssetId: img.mediaAssetId || undefined,
          url: img.url,
          altText: img.altText || name.trim(),
        })),
        seoTitle: seoTitle.trim() || undefined,
        seoDescription: seoDescription.trim() || undefined,
        categoryIds,
        attributes: buildAllowedAttributes(),
        variants: variants.map((v) => ({
          sku: v.sku.trim(),
          title: v.title.trim(),
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          stock: Number(v.stock),
          options: v.options || {},
          status: v.status || "ACTIVE",
        })),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      notify("Product created");
      onOpenChange(false);
      onSaved?.(created);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to create product"),
  });

  const updateMutation = useMutation({
    mutationFn: (confirmDropIncompatibleAttributes: boolean) => {
      if (!existing) throw new Error("Missing product");
      return adminCatalogApi.updateProduct(existing.id, {
        productTypeId: effectiveTypeId || existing.productTypeId,
        confirmDropIncompatibleAttributes,
        name: name.trim(),
        slug: slug.trim() || undefined,
        brand: brand.trim(),
        description: description.trim(),
        status,
        primaryImageUrl: images[0]?.url || "/media/terrain-fallback.jpg",
        images: images.map((img) => ({
          mediaAssetId: img.mediaAssetId || undefined,
          url: img.url,
          altText: img.altText || name.trim(),
        })),
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        categoryIds,
        attributes: buildAllowedAttributes(),
        expectedVersion: existing.version,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product", updated.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setConfirmTypeSwitch(false);
      notify("Product saved");
      onOpenChange(false);
      onSaved?.(updated);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409 && !confirmTypeSwitch) {
        setConfirmTypeSwitch(true);
        return;
      }
      setConfirmTypeSwitch(false);
      setError(err instanceof ApiError ? err.message : "Failed to save product");
    },
  });

  function renderTypedAttributeInput(attr: TypeAttributeDto) {
    const rawVal = attrValues[attr.code];
    const unitLabel = attr.unit ? ` (${attr.unit})` : "";
    const labelText = `${attr.name}${unitLabel}${attr.required ? " *" : ""}`;

    if (attr.dataType === "BOOLEAN") {
      const checked = rawVal === true || rawVal === "true";
      return (
        <label className="check-label" key={attr.attributeDefinitionId}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) =>
              setAttrValues((prev) => ({ ...prev, [attr.code]: e.target.checked }))
            }
          />
          {labelText}
        </label>
      );
    }

    if (attr.dataType === "ENUM") {
      const enumItems = [
        { value: "", label: `Select ${attr.name}…` },
        ...attr.options.map((opt) => ({ value: opt.value, label: opt.label })),
      ];
      return (
        <label key={attr.attributeDefinitionId}>
          {labelText}
          <Select
            required={attr.required}
            items={enumItems}
            value={rawVal !== undefined && rawVal !== null ? String(rawVal) : ""}
            onValueChange={(next) =>
              setAttrValues((prev) => ({ ...prev, [attr.code]: next ?? "" }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {enumItems.map((item) => (
                <SelectItem key={item.value || "empty"} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      );
    }

    if (attr.dataType === "MULTI_SELECT") {
      const selectedList: string[] = Array.isArray(rawVal)
        ? rawVal.map(String)
        : typeof rawVal === "string" && rawVal
          ? rawVal.split(",").map((s) => s.trim())
          : [];
      return (
        <div key={attr.attributeDefinitionId} className="panel" style={{ padding: 10 }}>
          <strong style={{ fontSize: 12 }}>{labelText}</strong>
          <div className="button-row" style={{ marginTop: 6, flexWrap: "wrap" }}>
            {attr.options.map((opt) => {
              const checked = selectedList.includes(opt.value);
              return (
                <label className="check-label" key={opt.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selectedList, opt.value]
                        : selectedList.filter((v) => v !== opt.value);
                      setAttrValues((prev) => ({ ...prev, [attr.code]: next }));
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    if (attr.dataType === "NUMBER") {
      const min =
        attr.validationRules?.min !== undefined
          ? Number(attr.validationRules.min)
          : undefined;
      const max =
        attr.validationRules?.max !== undefined
          ? Number(attr.validationRules.max)
          : undefined;
      return (
        <label key={attr.attributeDefinitionId}>
          {labelText}
          <input
            type="number"
            step="any"
            required={attr.required}
            min={Number.isFinite(min) ? min : undefined}
            max={Number.isFinite(max) ? max : undefined}
            value={rawVal !== undefined && rawVal !== null ? String(rawVal) : ""}
            placeholder={
              min !== undefined && max !== undefined ? `${min}–${max}` : ""
            }
            onChange={(e) =>
              setAttrValues((prev) => ({
                ...prev,
                [attr.code]:
                  e.target.value === "" ? "" : Number(e.target.value),
              }))
            }
          />
        </label>
      );
    }

    return (
      <label key={attr.attributeDefinitionId}>
        {labelText}
        <input
          type={attr.dataType === "DATE" ? "date" : "text"}
          required={attr.required}
          value={rawVal !== undefined && rawVal !== null ? String(rawVal) : ""}
          onChange={(e) =>
            setAttrValues((prev) => ({ ...prev, [attr.code]: e.target.value }))
          }
        />
      </label>
    );
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        size="xl"
        title={existing ? `Edit ${existing.name}` : "New product"}
        description="Typed attributes and variant options update automatically based on product type."
        headerExtra={existing ? <StatusBadge status={existing.status} /> : null}
        submitLabel={existing ? "Save product" : "Create product"}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitDisabled={typesQuery.isLoading || categoriesQuery.isLoading}
        error={error}
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (!name.trim()) {
            setError("Product name is required.");
            return;
          }
          if (!effectiveTypeId) {
            setError("Select a product type.");
            return;
          }
          if (!existing) {
            if (variants.some((v) => !v.sku.trim() || !v.title.trim())) {
              setError("Every variant requires a SKU and title.");
              return;
            }
            createMutation.mutate();
          } else {
            updateMutation.mutate(false);
          }
        }}
      >
        {typesQuery.isLoading || categoriesQuery.isLoading ? (
          <Skeleton rows={5} />
        ) : (
          <div className="admin-product-view">
            <div className="form-stack">
              <FormDialogSection title="Basic details">
                <FormDialogRow>
                  <label>
                    Product name
                    <input
                      required
                      value={name}
                      placeholder="Apex Carbon GTX"
                      onChange={(e) => {
                        const nextName = e.target.value;
                        setName(nextName);
                        if (!existing) setSlug(slugify(nextName));
                      }}
                    />
                  </label>
                  <label>
                    Slug
                    <input
                      value={slug}
                      placeholder="apex-carbon-gtx"
                      onChange={(e) => setSlug(slugify(e.target.value))}
                    />
                  </label>
                </FormDialogRow>

                <FormDialogRow>
                  <label>
                    Product type
                    <Select
                      required
                      items={productTypes.map((pt) => ({
                        value: pt.id,
                        label: `${pt.name} (${pt.code})`,
                      }))}
                      value={effectiveTypeId}
                      onValueChange={(next) => setSelectedTypeId(next ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {productTypes.map((pt) => (
                          <SelectItem key={pt.id} value={pt.id}>
                            {pt.name} ({pt.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    Brand
                    <input
                      required
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                    />
                  </label>
                  <label>
                    Status
                    <Select
                      items={PRODUCT_STATUS_ITEMS}
                      value={status}
                      onValueChange={(next) => next && setStatus(next)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_STATUS_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </FormDialogRow>

                <label>
                  Description
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                <div>
                  <strong style={{ fontSize: 12.5 }}>Categories</strong>
                  <div
                    className="button-row"
                    style={{ marginTop: 8, flexWrap: "wrap", gap: 10 }}
                  >
                    {categories.map((cat) => {
                      const checked = categoryIds.includes(cat.id);
                      return (
                        <label className="check-label" key={cat.id}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setCategoryIds((curr) =>
                                e.target.checked
                                  ? [...curr, cat.id]
                                  : curr.filter((c) => c !== cat.id)
                              )
                            }
                          />
                          {cat.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </FormDialogSection>

              <FormDialogSection
                title="Dynamic attributes"
                actions={
                  activeProductType ? (
                    <Badge tone="accent">{activeProductType.name}</Badge>
                  ) : null
                }
              >
                {activeProductType?.attributes?.length ? (
                  <div className="form-stack" style={{ gap: 12 }}>
                    {activeProductType.attributes.map(renderTypedAttributeInput)}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 12.5 }}>
                    This product type has no bound attributes.
                  </p>
                )}
              </FormDialogSection>

              {!existing ? (
                <FormDialogSection
                  title="Initial variants & SKUs"
                  actions={
                    <Button
                      size="sm"
                      onClick={() =>
                        setVariants((curr) => [
                          ...curr,
                          {
                            sku: "",
                            title: `Variant ${curr.length + 1}`,
                            price: curr[0]?.price || 129,
                            stock: 10,
                            options: {},
                            status: "ACTIVE",
                          },
                        ])
                      }
                    >
                      <Plus size={13} /> Add variant
                    </Button>
                  }
                >
                  {variants.map((variant, idx) => (
                    <div
                      key={idx}
                      className="panel"
                      style={{ padding: 12, display: "grid", gap: 10, boxShadow: "none" }}
                    >
                      <FormDialogRow>
                        <label>
                          SKU
                          <input
                            required
                            value={variant.sku}
                            placeholder="TER-001"
                            onChange={(e) =>
                              setVariants((curr) =>
                                curr.map((v, i) =>
                                  i === idx ? { ...v, sku: e.target.value } : v
                                )
                              )
                            }
                          />
                        </label>
                        <label>
                          Title
                          <input
                            required
                            value={variant.title}
                            placeholder="10 / Forest"
                            onChange={(e) =>
                              setVariants((curr) =>
                                curr.map((v, i) =>
                                  i === idx ? { ...v, title: e.target.value } : v
                                )
                              )
                            }
                          />
                        </label>
                      </FormDialogRow>
                      <FormDialogRow>
                        <label>
                          Price (USD)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={variant.price}
                            onChange={(e) =>
                              setVariants((curr) =>
                                curr.map((v, i) =>
                                  i === idx ? { ...v, price: Number(e.target.value) } : v
                                )
                              )
                            }
                          />
                        </label>
                        <label>
                          Compare at
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.compareAtPrice ?? ""}
                            onChange={(e) =>
                              setVariants((curr) =>
                                curr.map((v, i) =>
                                  i === idx
                                    ? {
                                        ...v,
                                        compareAtPrice: e.target.value
                                          ? Number(e.target.value)
                                          : undefined,
                                      }
                                    : v
                                )
                              )
                            }
                          />
                        </label>
                        <label>
                          Initial stock
                          <input
                            type="number"
                            min="0"
                            required
                            value={variant.stock}
                            onChange={(e) =>
                              setVariants((curr) =>
                                curr.map((v, i) =>
                                  i === idx ? { ...v, stock: Number(e.target.value) } : v
                                )
                              )
                            }
                          />
                        </label>
                      </FormDialogRow>
                      {activeProductType?.variantOptions?.length ? (
                        <FormDialogRow>
                          {activeProductType.variantOptions.map((vo) => (
                            <label key={vo.code}>
                              {vo.name}
                              <input
                                value={variant.options?.[vo.code] || ""}
                                placeholder={vo.name}
                                onChange={(e) =>
                                  setVariants((curr) =>
                                    curr.map((v, i) =>
                                      i === idx
                                        ? {
                                            ...v,
                                            options: {
                                              ...(v.options || {}),
                                              [vo.code]: e.target.value,
                                            },
                                          }
                                        : v
                                    )
                                  )
                                }
                              />
                            </label>
                          ))}
                        </FormDialogRow>
                      ) : null}
                      {variants.length > 1 ? (
                        <div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setVariants((curr) => curr.filter((_, i) => i !== idx))
                            }
                          >
                            Remove variant
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </FormDialogSection>
              ) : null}

              {existing ? (
                <FormDialogSection title="Search engine optimization">
                  <label>
                    SEO Title
                    <input
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    SEO Meta Description
                    <textarea
                      rows={2}
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                    />
                  </label>
                </FormDialogSection>
              ) : null}
            </div>

            <aside className="form-stack">
              <FormDialogSection title="Product media">
                <ImageGallery
                  images={images.map((i) => i.url)}
                  alt={name || "Product"}
                  onRemove={(url) =>
                    setImages((curr) => curr.filter((img) => img.url !== url))
                  }
                  onSelectPrimary={(url) =>
                    setImages((curr) => {
                      const hit = curr.find((i) => i.url === url);
                      if (!hit) return curr;
                      return [hit, ...curr.filter((i) => i.url !== url)];
                    })
                  }
                />

                {canUploadMedia ? (
                  <label className="btn media-upload">
                    <Upload size={14} />{" "}
                    {uploadMutation.isPending ? "Uploading…" : "Upload to S3 storage"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadMutation.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) uploadMutation.mutate(file);
                      }}
                    />
                  </label>
                ) : null}

                {mediaAssets.length ? (
                  <label>
                    Attach from Media Library
                    <Select
                      items={[
                        { value: "", label: "Choose uploaded asset…" },
                        ...mediaAssets.map((a) => ({
                          value: a.id,
                          label: a.originalFilename,
                        })),
                      ]}
                      value=""
                      onValueChange={(next) => {
                        const asset = mediaAssets.find((a) => a.id === next);
                        if (!asset) return;
                        setImages((curr) => [
                          ...curr.filter((i) => i.url !== "/media/terrain-fallback.jpg"),
                          {
                            mediaAssetId: asset.id,
                            url: asset.url,
                            altText: asset.altText || asset.originalFilename,
                          },
                        ]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Choose uploaded asset…</SelectItem>
                        {mediaAssets.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.originalFilename}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ) : null}

                <div className="form-pair" style={{ alignItems: "flex-end" }}>
                  <label style={{ flex: 1 }}>
                    Or add image URL
                    <input
                      value={imageUrlInput}
                      placeholder="/media/shoe-olive.jpg"
                      onChange={(e) => setImageUrlInput(e.target.value)}
                    />
                  </label>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!imageUrlInput.trim()) return;
                      setImages((curr) => [
                        ...curr.filter((i) => i.url !== "/media/terrain-fallback.jpg"),
                        { url: imageUrlInput.trim(), altText: name || "Product image" },
                      ]);
                      setImageUrlInput("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              </FormDialogSection>
            </aside>
          </div>
        )}
      </FormDialog>

      {confirmTypeSwitch ? (
        <ConfirmDialog
          title="Switch product type & drop incompatible attributes?"
          description="This product has attribute values from its previous product type that are not bound to the newly selected product type."
          confirmLabel="Confirm & switch type"
          destructive
          onCancel={() => setConfirmTypeSwitch(false)}
          onConfirm={() => updateMutation.mutate(true)}
        />
      ) : null}
    </>
  );
}

function ProductDetailView({
  product,
  initialEditOpen = false,
  onEditCloseNavigate,
  notify,
}: {
  product: ProductDto;
  initialEditOpen?: boolean;
  onEditCloseNavigate?: () => void;
  notify: (msg: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");
  const canPrice = hasPermission("pricing:write") || canWrite;
  const canAdjustStock = hasPermission("inventory:write");

  const [detailTab, setDetailTab] = useState("variants");
  const [editProductOpen, setEditProductOpen] = useState(initialEditOpen);
  const [editVariant, setEditVariant] = useState<VariantDto | null>(null);
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<{
    variantId: string;
    sku: string;
    currentStock: number;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [modalError, setModalError] = useState("");

  const updateVariantMutation = useMutation({
    mutationFn: (payload: {
      variantId: string;
      title: string;
      price: number;
      compareAtPrice: number | null;
      status: string;
    }) =>
      adminCatalogApi.updateVariant(payload.variantId, {
        title: payload.title,
        price: payload.price,
        compareAtPrice: payload.compareAtPrice,
        status: payload.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product", product.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setEditVariant(null);
      notify("Variant pricing and status updated");
    },
    onError: (err) =>
      setModalError(err instanceof ApiError ? err.message : "Failed to update variant"),
  });

  const addVariantMutation = useMutation({
    mutationFn: (payload: VariantInput) =>
      adminCatalogApi.addVariant(product.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product", product.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setAddVariantOpen(false);
      notify("Variant added");
    },
    onError: (err) =>
      setModalError(err instanceof ApiError ? err.message : "Failed to add variant"),
  });

  const adjustMutation = useMutation({
    mutationFn: (payload: { variantId: string; delta: number; reason: string }) =>
      adminInventoryApi.adjust(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product", product.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
      setAdjustTarget(null);
      notify("Inventory adjusted");
    },
    onError: (err) =>
      setModalError(err instanceof ApiError ? err.message : "Failed to adjust inventory"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminCatalogApi.deleteProduct(product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      notify("Product archived/deleted");
      router.push("/admin/products");
    },
    onError: (err) => {
      setDeleteOpen(false);
      notify(err instanceof ApiError ? err.message : "Failed to delete product");
    },
  });

  const gallery = product.images.length
    ? product.images.map((i) => i.url)
    : [product.primaryImageUrl || "/media/terrain-fallback.jpg"];

  const variantColumns: DataTableColumn<VariantDto>[] = [
    {
      id: "sku",
      header: "SKU",
      cell: (v) => <code>{v.sku}</code>,
    },
    {
      id: "variant",
      header: "Variant",
      cell: (v) => <strong>{v.title}</strong>,
    },
    {
      id: "options",
      header: "Options",
      cell: (v) =>
        Object.entries(v.options || {}).length
          ? Object.entries(v.options)
              .map(([k, val]) => `${k}: ${val}`)
              .join(" · ")
          : "—",
    },
    {
      id: "price",
      header: "Price",
      cell: (v) => (
        <>
          <strong>{usdExact(v.price)}</strong>
          {v.compareAtPrice ? (
            <span
              className="muted"
              style={{
                textDecoration: "line-through",
                marginLeft: 6,
                fontSize: 11.5,
              }}
            >
              {usdExact(v.compareAtPrice)}
            </span>
          ) : null}
        </>
      ),
    },
    {
      id: "stock",
      header: "Stock",
      cell: (v) => (
        <>
          <StatusBadge
            status={
              v.availableStock === 0
                ? "Out of stock"
                : v.availableStock <= 5
                  ? "Low stock"
                  : "In stock"
            }
          />{" "}
          <span className="muted">({v.availableStock})</span>
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (v) => <StatusBadge status={v.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (v) => (
        <div className="button-row" style={{ justifyContent: "flex-end" }}>
          {canPrice ? (
            <Button
              size="sm"
              onClick={() => {
                setModalError("");
                setEditVariant(v);
              }}
            >
              Edit price
            </Button>
          ) : null}
          {canAdjustStock ? (
            <Button
              size="sm"
              onClick={() => {
                setModalError("");
                setAdjustTarget({
                  variantId: v.id,
                  sku: v.sku,
                  currentStock: v.availableStock,
                });
              }}
            >
              Adjust stock
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const attributeColumns: DataTableColumn<(typeof product.attributes)[number]>[] = [
    {
      id: "name",
      header: "Attribute",
      cell: (attr) => attr.name,
    },
    {
      id: "code",
      header: "Code",
      cell: (attr) => <code>{attr.code}</code>,
    },
    {
      id: "value",
      header: "Value",
      cell: (attr) => {
        const rawDisplay =
          attr.displayValue ||
          (attr.value !== null && attr.value !== undefined
            ? String(attr.value)
            : "—");
        return (
          <strong>
            {attr.unit &&
            rawDisplay !== "—" &&
            !rawDisplay.toLowerCase().endsWith(attr.unit.toLowerCase())
              ? `${rawDisplay} ${attr.unit}`
              : rawDisplay}
          </strong>
        );
      },
    },
    {
      id: "flags",
      header: "Flags",
      cell: (attr) => (
        <div className="button-row" style={{ gap: 4, flexWrap: "wrap" }}>
          {attr.filterable ? <Badge tone="green">Filterable</Badge> : null}
          {attr.searchable ? <Badge>Searchable</Badge> : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="admin-page-scroll">
        <Breadcrumbs
          items={[
            { label: "Products", href: "/admin/products" },
            { label: product.name },
          ]}
        />

        <div className="admin-title">
          <div>
            <h1>{product.name}</h1>
            <p>
              {product.productTypeName} · {product.brand} ·{" "}
              {product.categories.map((c) => c.name).join(", ") || "Uncategorized"}
            </p>
          </div>
          <div className="button-row">
            <StatusBadge status={product.status} />
            <Link
              className="btn"
              href={`/store/product/${product.slug}`}
              target="_blank"
            >
              View in storefront
            </Link>
            {canWrite ? (
              <>
                <Button variant="primary" onClick={() => setEditProductOpen(true)}>
                  <Pencil size={14} /> Edit product
                </Button>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={14} /> Delete
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="admin-product-view">
          <div className="panel">
            <ImageGallery images={gallery} alt={product.name} />
          </div>

          <section className="panel form-stack">
            <h2>Overview</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              {product.description || "No description provided."}
            </p>
            <div className="form-pair">
              <div>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  Price range
                </span>
                <strong style={{ display: "block", fontSize: 16 }}>
                  {product.minPrice === product.maxPrice
                    ? usdExact(product.minPrice)
                    : `${usdExact(product.minPrice)} – ${usdExact(product.maxPrice)}`}
                </strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  Available stock
                </span>
                <strong style={{ display: "block", fontSize: 16 }}>
                  {product.totalStock} units
                </strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  Last updated
                </span>
                <strong style={{ display: "block", fontSize: 13 }}>
                  {formatDate(product.updatedAt)}
                </strong>
              </div>
            </div>
          </section>
        </div>

        <div className="admin-tabs-shell">
          <Tabs
            items={[
              {
                id: "variants",
                label: "Variants & inventory",
                badge: product.variants.length,
              },
              {
                id: "attributes",
                label: "Typed attributes",
                badge: product.attributes.length,
              },
            ]}
            value={detailTab}
            onChange={setDetailTab}
          />

          {detailTab === "variants" ? (
            <DataTable
              title="Variants & inventory"
              headerActions={
                canWrite ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setModalError("");
                      setAddVariantOpen(true);
                    }}
                  >
                    <Plus size={14} /> Add variant
                  </Button>
                ) : null
              }
              columns={variantColumns}
              data={product.variants}
              getRowKey={(v) => v.id}
              pageSize={6}
            />
          ) : (
            <DataTable
              title="Typed attributes"
              columns={attributeColumns}
              data={product.attributes}
              getRowKey={(attr) => attr.definitionId}
              pageSize={6}
              emptyState={
                <Empty
                  title="No attribute values recorded"
                  text="Edit the product to populate dynamic attributes for its product type."
                />
              }
            />
          )}
        </div>
      </div>

      {editProductOpen ? (
        <ProductFormDialog
          key={`edit-${product.id}-${product.version}`}
          open
          onOpenChange={(nextOpen) => {
            setEditProductOpen(nextOpen);
            if (!nextOpen) {
              onEditCloseNavigate?.();
            }
          }}
          existing={product}
          notify={notify}
          onSaved={() => {
            onEditCloseNavigate?.();
          }}
        />
      ) : null}

      {editVariant ? (
        <FormDialog
          open
          onOpenChange={(nextOpen) => !nextOpen && setEditVariant(null)}
          title={`Edit ${editVariant.sku}`}
          description="Update variant title, pricing, or availability status."
          submitLabel="Save variant"
          isSubmitting={updateVariantMutation.isPending}
          error={modalError}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const compRaw = String(fd.get("compareAtPrice") || "").trim();
            updateVariantMutation.mutate({
              variantId: editVariant.id,
              title: String(fd.get("title") || ""),
              price: Number(fd.get("price")),
              compareAtPrice: compRaw ? Number(compRaw) : null,
              status: String(fd.get("status") || "ACTIVE"),
            });
          }}
        >
          <label>
            Title
            <input name="title" required defaultValue={editVariant.title} />
          </label>
          <FormDialogRow>
            <label>
              Price (USD)
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={editVariant.price}
              />
            </label>
            <label>
              Compare at (optional)
              <input
                name="compareAtPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editVariant.compareAtPrice ?? ""}
              />
            </label>
            <label>
              Status
              <Select
                name="status"
                items={VARIANT_STATUS_ITEMS}
                defaultValue={editVariant.status}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANT_STATUS_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </FormDialogRow>
        </FormDialog>
      ) : null}

      {addVariantOpen ? (
        <FormDialog
          open
          onOpenChange={setAddVariantOpen}
          title={`Add variant to ${product.name}`}
          description="Create a new SKU variant with initial stocked quantity."
          submitLabel="Add variant"
          isSubmitting={addVariantMutation.isPending}
          error={modalError}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            addVariantMutation.mutate({
              sku: String(fd.get("sku") || "").trim(),
              title: String(fd.get("title") || "").trim(),
              price: Number(fd.get("price")),
              stock: Number(fd.get("stock")),
              status: "ACTIVE",
            });
          }}
        >
          <FormDialogRow>
            <label>
              SKU
              <input name="sku" required placeholder="SKU-NEW-01" />
            </label>
            <label>
              Title
              <input name="title" required placeholder="Large / Black" />
            </label>
          </FormDialogRow>
          <FormDialogRow>
            <label>
              Price (USD)
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={product.minPrice}
              />
            </label>
            <label>
              Initial stock
              <input name="stock" type="number" min="0" required defaultValue={10} />
            </label>
          </FormDialogRow>
        </FormDialog>
      ) : null}

      {adjustTarget ? (
        <FormDialog
          open
          onOpenChange={(nextOpen) => !nextOpen && setAdjustTarget(null)}
          size="sm"
          title={`Adjust stock for ${adjustTarget.sku}`}
          description={`Current available stock: ${adjustTarget.currentStock} units. Every change creates an inventory adjustment record.`}
          submitLabel="Apply adjustment"
          isSubmitting={adjustMutation.isPending}
          error={modalError}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            adjustMutation.mutate({
              variantId: adjustTarget.variantId,
              delta: Number(fd.get("delta")),
              reason: String(fd.get("reason") || "").trim(),
            });
          }}
        >
          <FormDialogRow>
            <label>
              Quantity delta (e.g. +10 or -2)
              <input name="delta" type="number" required defaultValue={10} />
            </label>
            <label>
              Reason
              <input
                name="reason"
                required
                placeholder="Warehouse restock / cycle count"
              />
            </label>
          </FormDialogRow>
        </FormDialog>
      ) : null}

      {deleteOpen ? (
        <ConfirmDialog
          title={`Delete ${product.name}?`}
          description="Removes this product from active storefront listings."
          confirmLabel="Delete product"
          destructive
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate()}
        />
      ) : null}
    </>
  );
}

function InventoryView({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canAdjust = hasPermission("inventory:write");

  const [tab, setTab] = useState("levels");
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<InventoryLevelDto | null>(null);
  const [error, setError] = useState("");

  const invQuery = useQuery({
    queryKey: ["admin-inventory"],
    queryFn: () => adminInventoryApi.overview(),
  });

  const adjustMutation = useMutation({
    mutationFn: (payload: {
      variantId: string;
      stockLocationId?: string;
      delta: number;
      reason: string;
    }) => adminInventoryApi.adjust(payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setSelectedLevel(null);
      notify(`Stock for ${updated.sku} is now ${updated.availableQuantity}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to adjust inventory"),
  });

  const overview = invQuery.data;
  const levels = (overview?.levels || []).filter((l) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      l.sku.toLowerCase().includes(q) ||
      l.locationName.toLowerCase().includes(q)
    );
  });
  const adjustments = overview?.recentAdjustments || [];

  const levelColumns: DataTableColumn<InventoryLevelDto>[] = [
    { id: "sku", header: "SKU", cell: (lvl) => <code>{lvl.sku}</code> },
    { id: "location", header: "Location", cell: (lvl) => lvl.locationName },
    { id: "onHand", header: "On hand", cell: (lvl) => lvl.stockedQuantity },
    { id: "reserved", header: "Reserved", cell: (lvl) => lvl.reservedQuantity },
    {
      id: "available",
      header: "Available",
      cell: (lvl) => <strong>{lvl.availableQuantity}</strong>,
    },
    {
      id: "status",
      header: "Status",
      cell: (lvl) => (
        <StatusBadge
          status={
            lvl.availableQuantity === 0
              ? "Out of stock"
              : lvl.availableQuantity <= 5
                ? "Low stock"
                : "In stock"
          }
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (lvl) =>
        canAdjust ? (
          <Button
            size="sm"
            onClick={() => {
              setError("");
              setSelectedLevel(lvl);
            }}
          >
            <ArrowDownUp size={13} /> Adjust
          </Button>
        ) : null,
    },
  ];

  const adjustmentColumns: DataTableColumn<AdjustmentDto>[] = [
    {
      id: "delta",
      header: "Delta",
      cell: (adj) => (
        <Badge tone={adj.delta >= 0 ? "green" : "red"}>
          {adj.delta >= 0 ? `+${adj.delta}` : adj.delta}
        </Badge>
      ),
    },
    {
      id: "change",
      header: "Before → After",
      cell: (adj) => (
        <>
          {adj.quantityBefore} → <strong>{adj.quantityAfter}</strong>
        </>
      ),
    },
    { id: "reason", header: "Reason", cell: (adj) => adj.reason },
    { id: "actor", header: "Actor", cell: (adj) => adj.actorEmail },
    { id: "created", header: "Timestamp", cell: (adj) => formatDate(adj.createdAt) },
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Inventory</h1>
          <p>
            Track stock on hand, committed reservations, and audited warehouse adjustments.
          </p>
        </div>
        {overview?.locations?.length ? (
          <Badge tone="accent">{overview.locations[0].name}</Badge>
        ) : null}
      </div>

      <div className="admin-tabs-shell">
        <Tabs
          items={[
            {
              id: "levels",
              label: "Stock levels",
              badge: overview?.levels?.length || 0,
            },
            {
              id: "adjustments",
              label: "Recent adjustments",
              badge: adjustments.length,
            },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "levels" ? (
          <DataTable
            columns={levelColumns}
            data={levels}
            getRowKey={(lvl) => lvl.id}
            isLoading={invQuery.isLoading}
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search SKU or warehouse location…"
            searchAriaLabel="Search inventory by SKU"
            pageSize={12}
            emptyState={
              <Empty
                title="No inventory records match"
                text="Try clearing the SKU search query."
              />
            }
          />
        ) : (
          <DataTable
            columns={adjustmentColumns}
            data={adjustments}
            getRowKey={(adj) => adj.id}
            isLoading={invQuery.isLoading}
            pageSize={12}
            emptyState={
              <Empty
                title="No manual adjustments yet"
                text="Adjust SKU stock to create an audited ledger entry."
              />
            }
          />
        )}
      </div>

      {selectedLevel ? (
        <FormDialog
          open
          onOpenChange={(nextOpen) => !nextOpen && setSelectedLevel(null)}
          size="sm"
          title={`Adjust stock — ${selectedLevel.sku}`}
          description={`Available: ${selectedLevel.availableQuantity} units at ${selectedLevel.locationName}.`}
          submitLabel="Commit adjustment"
          isSubmitting={adjustMutation.isPending}
          error={error}
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const fd = new FormData(e.currentTarget);
            const reason = String(fd.get("reason") || "").trim();
            if (!reason) {
              setError("A reason is required for every inventory adjustment.");
              return;
            }
            adjustMutation.mutate({
              variantId: selectedLevel.variantId,
              stockLocationId: selectedLevel.stockLocationId,
              delta: Number(fd.get("delta")),
              reason,
            });
          }}
        >
          <FormDialogRow>
            <label>
              Delta
              <input name="delta" type="number" required defaultValue={10} />
            </label>
            <label>
              Reason
              <input
                name="reason"
                required
                placeholder="Supplier shipment received"
              />
            </label>
          </FormDialogRow>
        </FormDialog>
      ) : null}
    </>
  );
}

export function Catalog({
  route,
  notify,
}: {
  route: string[];
  notify: (message: string) => void;
}) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");
  const [view, id, subView] = route;

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(id === "new");
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);

  const isListView = view === "products" && (!id || id === "new");
  const isDetailOrEdit = view === "products" && Boolean(id) && id !== "new";

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminCatalogApi.listCategories(),
    enabled: isListView,
  });

  const productsQuery = useQuery({
    queryKey: ["admin-products", query, categoryId, statusFilter],
    queryFn: () =>
      adminCatalogApi.listProducts({
        q: query.trim() || undefined,
        categoryId: categoryId || undefined,
        status: statusFilter || undefined,
      }),
    enabled: isListView,
  });

  const detailQuery = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => adminCatalogApi.getProduct(id),
    enabled: isDetailOrEdit,
  });

  if (view === "inventory") {
    return <InventoryView notify={notify} />;
  }

  if (isDetailOrEdit) {
    if (detailQuery.isLoading) return <Skeleton rows={4} />;
    if (detailQuery.isError || !detailQuery.data) {
      return (
        <Empty
          title="Product not found"
          text={
            detailQuery.error instanceof ApiError
              ? detailQuery.error.message
              : "Could not load this product."
          }
          action={
            <Link className="btn primary" href="/admin/products">
              Back to products
            </Link>
          }
        />
      );
    }
    return (
      <ProductDetailView
        key={detailQuery.data.id}
        product={detailQuery.data}
        initialEditOpen={subView === "edit"}
        onEditCloseNavigate={
          subView === "edit"
            ? () => router.push(`/admin/products/${detailQuery.data.id}`)
            : undefined
        }
        notify={notify}
      />
    );
  }

  const products = productsQuery.data || [];
  const categories = categoriesQuery.data || [];

  const columns: DataTableColumn<ProductDto>[] = [
    {
      id: "product",
      header: "Product",
      cell: (product) => (
        <Link href={`/admin/products/${product.id}`} className="row-product">
          <img
            src={product.primaryImageUrl || "/media/terrain-fallback.jpg"}
            alt=""
          />
          <div>
            <strong style={{ display: "block" }}>{product.name}</strong>
            <span className="muted" style={{ fontSize: 11.5 }}>
              {product.brand} · {product.variants.length}{" "}
              {product.variants.length === 1 ? "variant" : "variants"}
            </span>
          </div>
        </Link>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (product) => <Badge tone="accent">{product.productTypeName}</Badge>,
    },
    {
      id: "categories",
      header: "Categories",
      cell: (product) => product.categories.map((c) => c.name).join(", ") || "—",
    },
    {
      id: "price",
      header: "Price",
      cell: (product) => <strong>{usdExact(product.minPrice)}</strong>,
    },
    {
      id: "stock",
      header: "Stock",
      cell: (product) => (
        <span className={cn(product.totalStock <= 5 ? "danger" : undefined)}>
          {product.totalStock}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (product) => <StatusBadge status={product.status} />,
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Actions",
            align: "right" as const,
            cell: (product: ProductDto) => (
              <IconButton
                label={`Edit ${product.name}`}
                onClick={() => setEditingProduct(product)}
              >
                <Pencil size={14} />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Products</h1>
          <p>
            Manage multi-type products, variants, typed attributes, and S3 imagery.
          </p>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Add product
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={products}
        getRowKey={(product) => product.id}
        isLoading={productsQuery.isLoading}
        page={page}
        onPageChange={setPage}
        pageSize={12}
        searchValue={query}
        onSearchChange={(next) => {
          setQuery(next);
          setPage(1);
        }}
        searchPlaceholder="Search name, slug, or brand…"
        searchAriaLabel="Search products"
        toolbar={
          <>
            <Select
              items={[
                { value: "", label: "All categories" },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
              value={categoryId}
              onValueChange={(next) => {
                setCategoryId(next ?? "");
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={PRODUCT_STATUS_FILTER_ITEMS}
              value={statusFilter}
              onValueChange={(next) => {
                setStatusFilter(next ?? "");
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUS_FILTER_ITEMS.map((item) => (
                  <SelectItem key={item.value || "all"} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        emptyState={
          <Empty
            icon={<Package size={22} />}
            title="No products match"
            text="Adjust your search or create a new product."
          />
        }
      />

      {createOpen ? (
        <ProductFormDialog
          key="new-product"
          open
          onOpenChange={(nextOpen) => {
            setCreateOpen(nextOpen);
            if (!nextOpen && id === "new") {
              router.push("/admin/products");
            }
          }}
          notify={notify}
          onSaved={(created) => {
            if (id === "new") {
              router.push(`/admin/products/${created.id}`);
            }
          }}
        />
      ) : null}

      {editingProduct ? (
        <ProductFormDialog
          key={`edit-${editingProduct.id}-${editingProduct.version}`}
          open
          onOpenChange={(nextOpen) => !nextOpen && setEditingProduct(null)}
          existing={editingProduct}
          notify={notify}
        />
      ) : null}
    </>
  );
}
