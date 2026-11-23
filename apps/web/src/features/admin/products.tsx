"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  Check,
  Package,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumbs,
  Empty,
  ImageGallery,
  Skeleton,
} from "@/components/ui/data-display";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
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
  TypeAttributeDto,
  VariantDto,
  VariantInput,
} from "@/types/api-commerce";

function formatAttributeInitialValues(product?: ProductDto): Record<string, unknown> {
  if (!product) return {};
  const map: Record<string, unknown> = {};
  for (const attr of product.attributes) {
    map[attr.code] = attr.value;
  }
  return map;
}

function ProductForm({
  existing,
  notify,
}: {
  existing?: ProductDto;
  notify: (msg: string) => void;
}) {
  const router = useRouter();
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

  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    existing?.productTypeId || ""
  );
  const [name, setName] = useState(existing?.name || "");
  const [slug, setSlug] = useState(existing?.slug || "");
  const [brand, setBrand] = useState(existing?.brand || "Terrain");
  const [status, setStatus] = useState(existing?.status || "ACTIVE");
  const [description, setDescription] = useState(existing?.description || "");
  const [seoTitle, setSeoTitle] = useState(existing?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(
    existing?.seoDescription || ""
  );
  const [categoryIds, setCategoryIds] = useState<string[]>(
    existing?.categories.map((c) => c.id) || []
  );
  const [images, setImages] = useState<
    { mediaAssetId?: string | null; url: string; altText?: string }[]
  >(() =>
    existing?.images?.length
      ? existing.images.map((img) => ({
          mediaAssetId: img.mediaAssetId,
          url: img.url,
          altText: img.altText || existing.name,
        }))
      : existing?.primaryImageUrl
        ? [{ url: existing.primaryImageUrl, altText: existing.name }]
        : [{ url: "/media/terrain-fallback.jpg", altText: "Product" }]
  );
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [attrValues, setAttrValues] = useState<Record<string, unknown>>(() =>
    formatAttributeInitialValues(existing)
  );
  const [variants, setVariants] = useState<VariantInput[]>(() =>
    existing?.variants?.length
      ? existing.variants.map((v) => ({
          id: v.id,
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
      router.push(`/admin/products/${created.id}`);
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
      router.push(`/admin/products/${updated.id}`);
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
      return (
        <label key={attr.attributeDefinitionId}>
          {labelText}
          <select
            required={attr.required}
            value={rawVal !== undefined && rawVal !== null ? String(rawVal) : ""}
            onChange={(e) =>
              setAttrValues((prev) => ({ ...prev, [attr.code]: e.target.value }))
            }
          >
            <option value="">Select {attr.name}…</option>
            {attr.options.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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

  if (typesQuery.isLoading || categoriesQuery.isLoading) {
    return <Skeleton rows={5} />;
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Products", href: "/admin/products" },
          ...(existing
            ? [
                { label: existing.name, href: `/admin/products/${existing.id}` },
                { label: "Edit" },
              ]
            : [{ label: "New product" }]),
        ]}
      />

      <div className="admin-title">
        <div>
          <h1>{existing ? `Edit ${existing.name}` : "New product"}</h1>
          <p>
            Typed attributes and variant options update automatically based on product type.
          </p>
        </div>
      </div>

      <form
        className="form-stack"
        style={{ maxWidth: 940 }}
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
        <div className="admin-product-view">
          <div className="form-stack">
            <section className="panel form-stack">
              <h2>Basic details</h2>
              <div className="form-pair">
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
              </div>

              <div className="form-pair">
                <label>
                  Product type
                  <select
                    required
                    value={effectiveTypeId}
                    onChange={(e) => setSelectedTypeId(e.target.value)}
                  >
                    {productTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name} ({pt.code})
                      </option>
                    ))}
                  </select>
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
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </label>
              </div>

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
            </section>

            <section className="panel form-stack">
              <div className="section-title">
                <h2>Dynamic attributes</h2>
                {activeProductType ? (
                  <Badge tone="accent">{activeProductType.name}</Badge>
                ) : null}
              </div>
              {activeProductType?.attributes?.length ? (
                <div className="form-stack" style={{ gap: 12 }}>
                  {activeProductType.attributes.map(renderTypedAttributeInput)}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 12.5 }}>
                  This product type has no bound attributes.
                </p>
              )}
            </section>

            {!existing ? (
              <section className="panel form-stack">
                <div className="section-title">
                  <h2>Initial variants & SKUs</h2>
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
                </div>
                {variants.map((variant, idx) => (
                  <div
                    key={idx}
                    className="panel"
                    style={{ padding: 12, display: "grid", gap: 10 }}
                  >
                    <div className="form-pair">
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
                    </div>
                    <div className="form-pair">
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
                    </div>
                    {activeProductType?.variantOptions?.length ? (
                      <div className="form-pair">
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
                      </div>
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
                          <Trash2 size={13} /> Remove variant
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : (
              <section className="panel form-stack">
                <h2>SEO metadata</h2>
                <label>
                  SEO Title
                  <input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                  />
                </label>
                <label>
                  SEO Description
                  <textarea
                    rows={2}
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                  />
                </label>
              </section>
            )}
          </div>

          <aside className="form-stack">
            <section className="panel form-stack">
              <h2>Product media</h2>
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
                  <select
                    value=""
                    onChange={(e) => {
                      const asset = mediaAssets.find((a) => a.id === e.target.value);
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
                    <option value="">Choose uploaded asset…</option>
                    {mediaAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.originalFilename}
                      </option>
                    ))}
                  </select>
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
            </section>
          </aside>
        </div>

        {error ? (
          <p className="danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="button-row">
          <Button
            variant="primary"
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {existing ? "Save product" : "Create product"}
          </Button>
          <Link
            className="btn"
            href={existing ? `/admin/products/${existing.id}` : "/admin/products"}
          >
            Cancel
          </Link>
        </div>
      </form>

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
  notify,
}: {
  product: ProductDto;
  notify: (msg: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");
  const canPrice = hasPermission("pricing:write") || canWrite;
  const canAdjustStock = hasPermission("inventory:write");

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

  return (
    <>
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
              <Link
                className="btn primary"
                href={`/admin/products/${product.id}/edit`}
              >
                Edit product
              </Link>
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

        <div className="form-stack">
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

          <section className="panel form-stack">
            <h2>Typed attributes</h2>
            {product.attributes.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Attribute</th>
                      <th>Code</th>
                      <th>Value</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.attributes.map((attr) => (
                      <tr key={attr.definitionId}>
                        <td>{attr.name}</td>
                        <td>
                          <code>{attr.code}</code>
                        </td>
                        <td>
                          <strong>
                            {(() => {
                              const rawDisplay =
                                attr.displayValue ||
                                (attr.value !== null && attr.value !== undefined
                                  ? String(attr.value)
                                  : "—");
                              return attr.unit &&
                                rawDisplay !== "—" &&
                                !rawDisplay.toLowerCase().endsWith(attr.unit.toLowerCase())
                                ? `${rawDisplay} ${attr.unit}`
                                : rawDisplay;
                            })()}
                          </strong>
                        </td>
                        <td>
                          <div className="button-row" style={{ gap: 4, flexWrap: "wrap" }}>
                            {attr.filterable ? (
                              <Badge tone="green">Filterable</Badge>
                            ) : null}
                            {attr.searchable ? <Badge>Searchable</Badge> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12.5 }}>
                No attribute values recorded.
              </p>
            )}
          </section>
        </div>
      </div>

      <section className="admin-table-panel" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h2>Variants & inventory</h2>
          {canWrite ? (
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
          ) : null}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Variant</th>
                <th>Options</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id}>
                  <td>
                    <code>{v.sku}</code>
                  </td>
                  <td>
                    <strong>{v.title}</strong>
                  </td>
                  <td>
                    {Object.entries(v.options || {}).length
                      ? Object.entries(v.options)
                          .map(([k, val]) => `${k}: ${val}`)
                          .join(" · ")
                      : "—"}
                  </td>
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>
                    <div className="button-row">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editVariant ? (
        <Modal
          title={`Edit ${editVariant.sku}`}
          description="Update variant title, pricing, or availability status."
          close={() => setEditVariant(null)}
        >
          <form
            className="form-stack"
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
            <div className="form-pair">
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
                <select name="status" defaultValue={editVariant.status}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>
            </div>
            {modalError ? (
              <p className="danger" role="alert">
                {modalError}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setEditVariant(null)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={updateVariantMutation.isPending}
              >
                Save variant
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {addVariantOpen ? (
        <Modal
          title={`Add variant to ${product.name}`}
          description="Create a new SKU variant with initial stocked quantity."
          close={() => setAddVariantOpen(false)}
        >
          <form
            className="form-stack"
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
            <div className="form-pair">
              <label>
                SKU
                <input name="sku" required placeholder="SKU-NEW-01" />
              </label>
              <label>
                Title
                <input name="title" required placeholder="Large / Black" />
              </label>
            </div>
            <div className="form-pair">
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
            </div>
            {modalError ? (
              <p className="danger" role="alert">
                {modalError}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setAddVariantOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={addVariantMutation.isPending}
              >
                Add variant
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {adjustTarget ? (
        <Modal
          title={`Adjust stock for ${adjustTarget.sku}`}
          description={`Current available stock: ${adjustTarget.currentStock} units. Every change creates an inventory adjustment record.`}
          close={() => setAdjustTarget(null)}
        >
          <form
            className="form-stack"
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
            <div className="form-pair">
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
            </div>
            {modalError ? (
              <p className="danger" role="alert">
                {modalError}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setAdjustTarget(null)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={adjustMutation.isPending}
              >
                Apply adjustment
              </Button>
            </div>
          </form>
        </Modal>
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

      {invQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : (
        <div className="form-stack">
          <div className="admin-table-panel">
            <div className="table-toolbar">
              <label className="search-field">
                <Search size={15} />
                <input
                  aria-label="Search inventory by SKU"
                  placeholder="Search SKU or warehouse location…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Location</th>
                    <th>On hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {levels.map((lvl) => (
                    <tr key={lvl.id}>
                      <td>
                        <code>{lvl.sku}</code>
                      </td>
                      <td>{lvl.locationName}</td>
                      <td>{lvl.stockedQuantity}</td>
                      <td>{lvl.reservedQuantity}</td>
                      <td>
                        <strong>{lvl.availableQuantity}</strong>
                      </td>
                      <td>
                        <StatusBadge
                          status={
                            lvl.availableQuantity === 0
                              ? "Out of stock"
                              : lvl.availableQuantity <= 5
                                ? "Low stock"
                                : "In stock"
                          }
                        />
                      </td>
                      <td>
                        {canAdjust ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setError("");
                              setSelectedLevel(lvl);
                            }}
                          >
                            <ArrowDownUp size={13} /> Adjust
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <section className="admin-table-panel">
            <div className="section-title">
              <h2>Recent stock adjustments</h2>
              <Badge>{overview?.recentAdjustments?.length || 0} logged</Badge>
            </div>
            {overview?.recentAdjustments?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Delta</th>
                      <th>Before → After</th>
                      <th>Reason</th>
                      <th>Actor</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentAdjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td>
                          <Badge tone={adj.delta >= 0 ? "green" : "red"}>
                            {adj.delta >= 0 ? `+${adj.delta}` : adj.delta}
                          </Badge>
                        </td>
                        <td>
                          {adj.quantityBefore} → <strong>{adj.quantityAfter}</strong>
                        </td>
                        <td>{adj.reason}</td>
                        <td>{adj.actorEmail}</td>
                        <td>{formatDate(adj.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ padding: "8px 0" }}>
                No manual adjustments recorded yet.
              </p>
            )}
          </section>
        </div>
      )}

      {selectedLevel ? (
        <Modal
          title={`Adjust stock — ${selectedLevel.sku}`}
          description={`Available: ${selectedLevel.availableQuantity} units at ${selectedLevel.locationName}.`}
          close={() => setSelectedLevel(null)}
        >
          <form
            className="form-stack"
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
            <div className="form-pair">
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
            </div>
            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setSelectedLevel(null)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={adjustMutation.isPending}
              >
                <Check size={14} /> Commit adjustment
              </Button>
            </div>
          </form>
        </Modal>
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
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");
  const [view, id, subView] = route;

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isListView = view === "products" && !id;
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

  if (id === "new") {
    return <ProductForm key="new-product" notify={notify} />;
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
    if (subView === "edit") {
      return (
        <ProductForm
          key={detailQuery.data.id}
          existing={detailQuery.data}
          notify={notify}
        />
      );
    }
    return <ProductDetailView product={detailQuery.data} notify={notify} />;
  }

  const products = productsQuery.data || [];
  const categories = categoriesQuery.data || [];

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
          <Link className="btn primary" href="/admin/products/new">
            <Plus size={15} /> Add product
          </Link>
        ) : null}
      </div>

      <div className="admin-table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search products"
              placeholder="Search name, slug, or brand…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>

        {productsQuery.isLoading ? (
          <Skeleton rows={4} />
        ) : products.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Categories</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="row-product"
                      >
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
                    </td>
                    <td>
                      <Badge tone="accent">{product.productTypeName}</Badge>
                    </td>
                    <td>
                      {product.categories.map((c) => c.name).join(", ") || "—"}
                    </td>
                    <td>
                      <strong>{usdExact(product.minPrice)}</strong>
                    </td>
                    <td>
                      <span
                        className={cn(
                          product.totalStock <= 5 ? "danger" : undefined
                        )}
                      >
                        {product.totalStock}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={product.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Package size={22} />}
            title="No products match"
            text="Adjust your search or create a new product."
          />
        )}
      </div>
    </>
  );
}
