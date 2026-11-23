"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { adminCatalogApi } from "@/lib/commerce-api";
import { slugify } from "@/lib/format";
import type {
  AttributeDataType,
  AttributeDefinitionDto,
  ProductTypeDto,
} from "@/types/api-commerce";

const DATA_TYPES: AttributeDataType[] = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "ENUM",
  "MULTI_SELECT",
  "DATE",
];

type AttributeFormDraft = {
  id?: string;
  code: string;
  name: string;
  dataType: AttributeDataType;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  unit: string;
  minRule: string;
  maxRule: string;
  optionsText: string;
  bindProductTypeId: string;
};

export function Attributes({ notify }: { notify: (message: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [draft, setDraft] = useState<AttributeFormDraft | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AttributeDefinitionDto | null>(null);
  const [error, setError] = useState("");

  const attrsQuery = useQuery({
    queryKey: ["admin-attributes", includeArchived],
    queryFn: () => adminCatalogApi.listAttributes(includeArchived),
  });

  const typesQuery = useQuery({
    queryKey: ["admin-product-types"],
    queryFn: () => adminCatalogApi.listProductTypes(),
  });

  const createMutation = useMutation({
    mutationFn: async (form: AttributeFormDraft) => {
      const validationRules: Record<string, unknown> = {};
      if (form.dataType === "NUMBER") {
        if (form.minRule.trim() !== "") validationRules.min = Number(form.minRule);
        if (form.maxRule.trim() !== "") validationRules.max = Number(form.maxRule);
      }
      const options =
        form.dataType === "ENUM" || form.dataType === "MULTI_SELECT"
          ? form.optionsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((val, idx) => ({ value: val, label: val, sortOrder: idx }))
          : undefined;

      const created = await adminCatalogApi.createAttribute({
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        dataType: form.dataType,
        required: form.required,
        filterable: form.filterable,
        searchable: form.searchable,
        unit: form.unit.trim() || undefined,
        validationRules,
        options,
      });

      if (form.bindProductTypeId) {
        await adminCatalogApi.bindTypeAttribute(form.bindProductTypeId, {
          attributeDefinitionId: created.id,
          requiredOverride: form.required,
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product-types"] });
      setDraft(null);
      notify("Attribute created");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to create attribute"),
  });

  const updateMutation = useMutation({
    mutationFn: async (form: AttributeFormDraft) => {
      if (!form.id) throw new Error("Missing attribute id");
      const validationRules: Record<string, unknown> = {};
      if (form.dataType === "NUMBER") {
        if (form.minRule.trim() !== "") validationRules.min = Number(form.minRule);
        if (form.maxRule.trim() !== "") validationRules.max = Number(form.maxRule);
      }
      const options =
        form.dataType === "ENUM" || form.dataType === "MULTI_SELECT"
          ? form.optionsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((val, idx) => ({ value: val, label: val, sortOrder: idx }))
          : undefined;

      const updated = await adminCatalogApi.updateAttribute(form.id, {
        name: form.name.trim(),
        required: form.required,
        filterable: form.filterable,
        searchable: form.searchable,
        unit: form.unit.trim(),
        validationRules,
        options,
      });

      if (form.bindProductTypeId) {
        await adminCatalogApi.bindTypeAttribute(form.bindProductTypeId, {
          attributeDefinitionId: updated.id,
        });
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product-types"] });
      setDraft(null);
      notify("Attribute updated");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to update attribute"),
  });

  const deleteMutation = useMutation({
    mutationFn: (attributeId: string) => adminCatalogApi.deleteAttribute(attributeId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product-types"] });
      setRemoveTarget(null);
      notify(
        res.archived
          ? "Attribute is in use and was safely archived instead of deleted"
          : "Attribute deleted"
      );
    },
    onError: (err) => {
      setRemoveTarget(null);
      notify(err instanceof ApiError ? err.message : "Failed to remove attribute");
    },
  });

  const attrs: AttributeDefinitionDto[] = attrsQuery.data || [];
  const productTypes: ProductTypeDto[] = typesQuery.data || [];

  const typeNamesByAttrId = new Map<string, string[]>();
  for (const pt of productTypes) {
    for (const bound of pt.attributes) {
      const curr = typeNamesByAttrId.get(bound.attributeDefinitionId) || [];
      curr.push(pt.name);
      typeNamesByAttrId.set(bound.attributeDefinitionId, curr);
    }
  }

  const visible = attrs.filter((item) => {
    if (typeFilter) {
      const boundTo = typeNamesByAttrId.get(item.id) || [];
      if (!boundTo.includes(typeFilter)) return false;
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (
        !item.name.toLowerCase().includes(q) &&
        !item.code.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  function openNew() {
    setError("");
    setDraft({
      code: "",
      name: "",
      dataType: "TEXT",
      required: false,
      filterable: true,
      searchable: true,
      unit: "",
      minRule: "",
      maxRule: "",
      optionsText: "",
      bindProductTypeId: productTypes[0]?.id || "",
    });
  }

  function openEdit(item: AttributeDefinitionDto) {
    setError("");
    const rules = item.validationRules || {};
    setDraft({
      id: item.id,
      code: item.code,
      name: item.name,
      dataType: (DATA_TYPES.includes(item.dataType as AttributeDataType)
        ? item.dataType
        : "TEXT") as AttributeDataType,
      required: item.required,
      filterable: item.filterable,
      searchable: item.searchable,
      unit: item.unit || "",
      minRule: rules.min !== undefined && rules.min !== null ? String(rules.min) : "",
      maxRule: rules.max !== undefined && rules.max !== null ? String(rules.max) : "",
      optionsText: item.options.map((o) => o.value).join(", "),
      bindProductTypeId: "",
    });
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Attributes</h1>
          <p>
            Configure dynamic attributes, validation bounds, and faceted storefront filters.
          </p>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={openNew}>
            <Plus size={15} /> New attribute
          </Button>
        ) : null}
      </div>

      <div className="admin-table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search attributes"
              placeholder="Search attribute name or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by product type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All product types</option>
            {productTypes.map((pt) => (
              <option key={pt.id} value={pt.name}>
                {pt.name}
              </option>
            ))}
          </select>
          <label className="check-label">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        {attrsQuery.isLoading ? (
          <Skeleton rows={4} />
        ) : visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Data type</th>
                  <th>Product types</th>
                  <th>Behavior</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const boundTypes = typeNamesByAttrId.get(item.id) || [];
                  return (
                    <tr key={item.id}>
                      <td>
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => openEdit(item)}
                          >
                            {item.name}
                          </button>
                        ) : (
                          <strong>{item.name}</strong>
                        )}
                        {item.unit ? (
                          <span className="muted" style={{ fontSize: 11, marginLeft: 5 }}>
                            ({item.unit})
                          </span>
                        ) : null}
                        {item.archivedAt ? (
                          <Badge tone="neutral" className="ml-1">
                            Archived
                          </Badge>
                        ) : null}
                      </td>
                      <td>
                        <code>{item.code}</code>
                      </td>
                      <td>
                        <Badge tone="accent">{item.dataType}</Badge>
                      </td>
                      <td>
                        {boundTypes.length ? boundTypes.join(", ") : "Unbound"}
                      </td>
                      <td>
                        <div className="button-row" style={{ gap: 4 }}>
                          {item.required ? <Badge tone="amber">Required</Badge> : null}
                          {item.filterable ? <Badge tone="green">Filterable</Badge> : null}
                          {item.searchable ? <Badge>Searchable</Badge> : null}
                        </div>
                      </td>
                      <td>
                        {canWrite && !item.archivedAt ? (
                          <IconButton
                            label={`Delete ${item.name}`}
                            onClick={() => setRemoveTarget(item)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No attributes match"
            text="Create a custom attribute or clear the active product type filter."
          />
        )}
      </div>

      {draft ? (
        <Modal
          title={draft.id ? `Edit ${draft.name}` : "New dynamic attribute"}
          description="Attribute codes must be unique lowercase identifiers (letters, numbers, underscores)."
          close={() => setDraft(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (!draft.name.trim()) {
                setError("Attribute name is required.");
                return;
              }
              if (!draft.id && !/^[a-z0-9_]+$/.test(draft.code.trim())) {
                setError(
                  "Attribute code must contain only lowercase letters, numbers, and underscores."
                );
                return;
              }
              if (
                (draft.dataType === "ENUM" || draft.dataType === "MULTI_SELECT") &&
                !draft.optionsText
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean).length
              ) {
                setError("Provide at least one comma-separated option.");
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
                  placeholder="e.g. Battery Capacity"
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
                  placeholder="battery_capacity"
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                          }
                        : null
                    )
                  }
                />
              </label>
            </div>

            <div className="field-row">
              <label>
                Data type
                <select
                  disabled={Boolean(draft.id)}
                  value={draft.dataType}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, dataType: e.target.value as AttributeDataType }
                        : null
                    )
                  }
                >
                  {DATA_TYPES.map((typeOpt) => (
                    <option key={typeOpt} value={typeOpt}>
                      {typeOpt}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bind to product type (optional)
                <select
                  value={draft.bindProductTypeId}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, bindProductTypeId: e.target.value } : null
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

            <div className="field-row">
              <label>
                Unit (optional)
                <input
                  value={draft.unit}
                  placeholder="GB, mm, Wh"
                  onChange={(e) =>
                    setDraft((prev) => (prev ? { ...prev, unit: e.target.value } : null))
                  }
                />
              </label>
              {draft.dataType === "NUMBER" ? (
                <div className="field-row">
                  <label>
                    Min
                    <input
                      type="number"
                      value={draft.minRule}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, minRule: e.target.value } : null
                        )
                      }
                    />
                  </label>
                  <label>
                    Max
                    <input
                      type="number"
                      value={draft.maxRule}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, maxRule: e.target.value } : null
                        )
                      }
                    />
                  </label>
                </div>
              ) : (
                <div />
              )}
            </div>

            {draft.dataType === "ENUM" || draft.dataType === "MULTI_SELECT" ? (
              <label>
                Allowed options (comma-separated)
                <input
                  value={draft.optionsText}
                  placeholder="Small, Medium, Large"
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, optionsText: e.target.value } : null
                    )
                  }
                />
              </label>
            ) : null}

            <div className="check-row">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.required}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, required: e.target.checked } : null
                    )
                  }
                />
                Required on product
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.filterable}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, filterable: e.target.checked } : null
                    )
                  }
                />
                Storefront filterable
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.searchable}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, searchable: e.target.checked } : null
                    )
                  }
                />
                Search indexed
              </label>
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
                {draft.id ? "Save attribute" : "Create attribute"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {removeTarget ? (
        <ConfirmDialog
          title={`Delete or archive ${removeTarget.name}?`}
          description="If any product or product type already uses this attribute, it will be archived safely instead of hard-deleted."
          confirmLabel="Continue"
          destructive
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => deleteMutation.mutate(removeTarget.id)}
        />
      ) : null}
    </>
  );
}
