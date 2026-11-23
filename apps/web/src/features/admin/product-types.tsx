"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { Modal } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { adminCatalogApi } from "@/lib/commerce-api";
import { formatDate, slugify } from "@/lib/format";
import type {
  AttributeDefinitionDto,
  ProductTypeDto,
  TypeAttributeBindingRequest,
  VariantOptionDefRequest,
} from "@/types/api-commerce";

type ProductTypeDraft = {
  id?: string;
  code: string;
  name: string;
  description: string;
  attributes: (TypeAttributeBindingRequest & { label: string; dataType: string })[];
  variantOptions: VariantOptionDefRequest[];
};

export function ProductTypesManager({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");

  const typesQuery = useQuery({
    queryKey: ["admin-product-types"],
    queryFn: () => adminCatalogApi.listProductTypes(),
  });

  const attrsQuery = useQuery({
    queryKey: ["admin-attributes", false],
    queryFn: () => adminCatalogApi.listAttributes(false),
  });

  const [draft, setDraft] = useState<ProductTypeDraft | null>(null);
  const [attrToBind, setAttrToBind] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: ProductTypeDraft) =>
      adminCatalogApi.createProductType({
        code: payload.code.trim().toLowerCase(),
        name: payload.name.trim(),
        description: payload.description.trim() || undefined,
        attributes: payload.attributes.map((a, index) => ({
          attributeDefinitionId: a.attributeDefinitionId,
          displayOrder: index,
          requiredOverride: a.requiredOverride,
        })),
        variantOptions: payload.variantOptions
          .filter((v) => v.code.trim() && v.name.trim())
          .map((v, index) => ({
            code: v.code.trim().toLowerCase(),
            name: v.name.trim(),
            sortOrder: index,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product-types"] });
      setDraft(null);
      notify("Product type created");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to create product type"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ProductTypeDraft) => {
      if (!payload.id) throw new Error("Missing product type id");
      return adminCatalogApi.updateProductType(payload.id, {
        name: payload.name.trim(),
        description: payload.description.trim(),
        attributes: payload.attributes.map((a, index) => ({
          attributeDefinitionId: a.attributeDefinitionId,
          displayOrder: index,
          requiredOverride: a.requiredOverride,
        })),
        variantOptions: payload.variantOptions
          .filter((v) => v.code.trim() && v.name.trim())
          .map((v, index) => ({
            code: v.code.trim().toLowerCase(),
            name: v.name.trim(),
            sortOrder: index,
          })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product-types"] });
      setDraft(null);
      notify("Product type updated");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to update product type"),
  });

  function openCreate() {
    setError("");
    setAttrToBind("");
    setDraft({
      code: "",
      name: "",
      description: "",
      attributes: [],
      variantOptions: [{ code: "color", name: "Color", sortOrder: 0 }],
    });
  }

  function openEdit(pt: ProductTypeDto) {
    setError("");
    setAttrToBind("");
    setDraft({
      id: pt.id,
      code: pt.code,
      name: pt.name,
      description: pt.description || "",
      attributes: pt.attributes.map((a, index) => ({
        attributeDefinitionId: a.attributeDefinitionId,
        displayOrder: index,
        requiredOverride: a.requiredOverride ?? null,
        label: `${a.name} (${a.code})`,
        dataType: a.dataType,
      })),
      variantOptions: pt.variantOptions.map((v, index) => ({
        code: v.code,
        name: v.name,
        sortOrder: index,
      })),
    });
  }

  const allAttrs: AttributeDefinitionDto[] = attrsQuery.data || [];
  const types: ProductTypeDto[] = typesQuery.data || [];
  const availableToBind = draft
    ? allAttrs.filter(
        (a) => !draft.attributes.some((b) => b.attributeDefinitionId === a.id)
      )
    : [];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Product Types</h1>
          <p>
            Define product family schemas, required attributes, and variant option dimensions.
          </p>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} /> New product type
          </Button>
        ) : null}
      </div>

      {typesQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : typesQuery.isError ? (
        <Empty
          title="Could not load product types"
          text={
            typesQuery.error instanceof ApiError
              ? typesQuery.error.message
              : "Unexpected API error."
          }
        />
      ) : types.length ? (
        <div className="admin-table-panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product type</th>
                <th>Code</th>
                <th>Bound attributes</th>
                <th>Variant options</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {types.map((pt) => (
                <tr key={pt.id}>
                  <td>
                    <strong style={{ display: "block" }}>{pt.name}</strong>
                    {pt.description ? (
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {pt.description}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <code>{pt.code}</code>
                  </td>
                  <td>
                    <div className="button-row" style={{ gap: 4 }}>
                      {pt.attributes.length ? (
                        pt.attributes.map((attr) => (
                          <Badge
                            key={attr.attributeDefinitionId}
                            tone={attr.required ? "amber" : "neutral"}
                          >
                            {attr.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="button-row" style={{ gap: 4 }}>
                      {pt.variantOptions.length ? (
                        pt.variantOptions.map((vo) => (
                          <Badge key={vo.id} tone="accent">
                            {vo.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="muted">Default</span>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(pt.updatedAt)}</td>
                  <td>
                    {canWrite ? (
                      <IconButton
                        label={`Edit ${pt.name}`}
                        onClick={() => openEdit(pt)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={<Shapes size={22} />}
          title="No product types defined"
          text="Create a product type to organize dynamic attributes for a product family."
        />
      )}

      {draft ? (
        <Modal
          wide
          title={draft.id ? `Edit ${draft.name}` : "New product type"}
          description="Bind reusable attributes and configure variant option axes (e.g. size, color)."
          close={() => setDraft(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (!draft.name.trim()) {
                setError("Name is required.");
                return;
              }
              if (!draft.id && !/^[a-z0-9_-]+$/.test(draft.code.trim())) {
                setError("Code must use lowercase letters, numbers, hyphens, or underscores.");
                return;
              }
              if (draft.id) {
                updateMutation.mutate(draft);
              } else {
                createMutation.mutate(draft);
              }
            }}
          >
            <div className="field-row">
              <label>
                Name
                <input
                  required
                  value={draft.name}
                  placeholder="e.g. Gaming Laptop"
                  onChange={(e) => {
                    const name = e.target.value;
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            name,
                            code: prev.id
                              ? prev.code
                              : slugify(name).replace(/-/g, "_"),
                          }
                        : null
                    );
                  }}
                />
              </label>
              <label>
                Code
                <input
                  required
                  disabled={Boolean(draft.id)}
                  value={draft.code}
                  placeholder="gaming_laptop"
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }
                        : null
                    )
                  }
                />
              </label>
            </div>

            <label>
              Description
              <input
                value={draft.description}
                placeholder="High-refresh workstations and portable gaming rigs"
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
              />
            </label>

            <div className="panel" style={{ padding: 12 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>
                <strong>Attribute schema</strong>
                <div className="button-row">
                  <select
                    aria-label="Select attribute to add"
                    value={attrToBind}
                    onChange={(e) => setAttrToBind(e.target.value)}
                  >
                    <option value="">Choose attribute…</option>
                    {availableToBind.map((attr) => (
                      <option key={attr.id} value={attr.id}>
                        {attr.name} ({attr.dataType})
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!attrToBind}
                    onClick={() => {
                      const found = allAttrs.find((a) => a.id === attrToBind);
                      if (!found) return;
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              attributes: [
                                ...prev.attributes,
                                {
                                  attributeDefinitionId: found.id,
                                  displayOrder: prev.attributes.length,
                                  requiredOverride: found.required,
                                  label: `${found.name} (${found.code})`,
                                  dataType: found.dataType,
                                },
                              ],
                            }
                          : null
                      );
                      setAttrToBind("");
                    }}
                  >
                    Bind
                  </Button>
                </div>
              </div>

              {draft.attributes.length ? (
                <div className="form-stack" style={{ gap: 8 }}>
                  {draft.attributes.map((binding, idx) => (
                    <div
                      key={binding.attributeDefinitionId}
                      className="line-item"
                      style={{ gap: 8 }}
                    >
                      <span>
                        <strong>{binding.label}</strong>{" "}
                        <Badge tone="accent">{binding.dataType}</Badge>
                      </span>
                      <div className="button-row">
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={Boolean(binding.requiredOverride)}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      attributes: prev.attributes.map((item, i) =>
                                        i === idx
                                          ? { ...item, requiredOverride: e.target.checked }
                                          : item
                                      ),
                                    }
                                  : null
                              )
                            }
                          />
                          Required
                        </label>
                        <IconButton
                          label={`Unbind ${binding.label}`}
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    attributes: prev.attributes.filter((_, i) => i !== idx),
                                  }
                                : null
                            )
                          }
                        >
                          <Trash2 size={13} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 12 }}>
                  No attributes bound yet. Bind existing attributes above.
                </p>
              )}
            </div>

            <div className="panel" style={{ padding: 12 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>
                <strong>Variant option dimensions</strong>
                <Button
                  size="sm"
                  onClick={() =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            variantOptions: [
                              ...prev.variantOptions,
                              { code: "", name: "" },
                            ],
                          }
                        : null
                    )
                  }
                >
                  <Plus size={13} /> Add option
                </Button>
              </div>
              <div className="form-stack" style={{ gap: 8 }}>
                {draft.variantOptions.map((vo, idx) => (
                  <div className="field-row" key={idx} style={{ alignItems: "center" }}>
                    <input
                      aria-label={`Variant option code ${idx + 1}`}
                      placeholder="size"
                      value={vo.code}
                      onChange={(e) => {
                        const code = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                variantOptions: prev.variantOptions.map((x, i) =>
                                  i === idx ? { ...x, code } : x
                                ),
                              }
                            : null
                        );
                      }}
                    />
                    <input
                      aria-label={`Variant option name ${idx + 1}`}
                      placeholder="Size"
                      value={vo.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                variantOptions: prev.variantOptions.map((x, i) =>
                                  i === idx ? { ...x, name } : x
                                ),
                              }
                            : null
                        );
                      }}
                    />
                    <IconButton
                      label="Remove option"
                      onClick={() =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                variantOptions: prev.variantOptions.filter(
                                  (_, i) => i !== idx
                                ),
                              }
                            : null
                        )
                      }
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="modal-actions">
              <Button onClick={() => setDraft(null)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {draft.id ? "Save product type" : "Create product type"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
