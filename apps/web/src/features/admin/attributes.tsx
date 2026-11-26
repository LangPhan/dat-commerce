"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
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

const DATA_TYPE_ITEMS = DATA_TYPES.map((typeOpt) => ({
  value: typeOpt,
  label: typeOpt,
}));

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
  const [page, setPage] = useState(1);
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

      const updatePromise = adminCatalogApi.updateAttribute(form.id, {
        name: form.name.trim(),
        required: form.required,
        filterable: form.filterable,
        searchable: form.searchable,
        unit: form.unit.trim(),
        validationRules,
        options,
      });

      if (form.bindProductTypeId) {
        const [updated] = await Promise.all([
          updatePromise,
          adminCatalogApi.bindTypeAttribute(form.bindProductTypeId, {
            attributeDefinitionId: form.id,
          }),
        ]);
        return updated;
      }
      return updatePromise;
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
  const deferredQuery = useDeferredValue(query);

  const typeNamesByAttrId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pt of productTypes) {
      for (const bound of pt.attributes) {
        const curr = map.get(bound.attributeDefinitionId);
        if (curr) curr.push(pt.name);
        else map.set(bound.attributeDefinitionId, [pt.name]);
      }
    }
    return map;
  }, [productTypes]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return attrs.filter((item) => {
      if (typeFilter) {
        const boundTo = typeNamesByAttrId.get(item.id);
        if (!boundTo || !boundTo.includes(typeFilter)) return false;
      }
      if (q) {
        if (
          !item.name.toLowerCase().includes(q) &&
          !item.code.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [attrs, deferredQuery, typeFilter, typeNamesByAttrId]);

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

  const columns: DataTableColumn<AttributeDefinitionDto>[] = [
    {
      id: "name",
      header: "Name",
      cell: (item) => (
        <>
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
            <Badge tone="neutral" className="ml-badge">
              Archived
            </Badge>
          ) : null}
        </>
      ),
    },
    {
      id: "code",
      header: "Code",
      cell: (item) => <code>{item.code}</code>,
    },
    {
      id: "type",
      header: "Data type",
      cell: (item) => <Badge tone="accent">{item.dataType}</Badge>,
    },
    {
      id: "productTypes",
      header: "Product types",
      cell: (item) => {
        const boundTypes = typeNamesByAttrId.get(item.id) || [];
        return boundTypes.length ? boundTypes.join(", ") : "Unbound";
      },
    },
    {
      id: "behavior",
      header: "Behavior",
      cell: (item) => (
        <div className="button-row" style={{ gap: 4 }}>
          {item.required ? <Badge tone="amber">Required</Badge> : null}
          {item.filterable ? <Badge tone="green">Filterable</Badge> : null}
          {item.searchable ? <Badge>Searchable</Badge> : null}
        </div>
      ),
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Actions",
            align: "right" as const,
            cell: (item: AttributeDefinitionDto) => (
              <div className="button-row" style={{ justifyContent: "flex-end" }}>
                <IconButton
                  label={`Edit ${item.name}`}
                  onClick={() => openEdit(item)}
                >
                  <Pencil size={14} />
                </IconButton>
                {!item.archivedAt ? (
                  <IconButton
                    label={`Delete ${item.name}`}
                    onClick={() => setRemoveTarget(item)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                ) : null}
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

      <DataTable
        columns={columns}
        data={visible}
        getRowKey={(item) => item.id}
        isLoading={attrsQuery.isLoading}
        page={page}
        onPageChange={setPage}
        pageSize={10}
        searchValue={query}
        onSearchChange={(next) => {
          setQuery(next);
          setPage(1);
        }}
        searchPlaceholder="Search attribute name or code…"
        searchAriaLabel="Search attributes"
        toolbar={
          <>
            <Select
              items={[
                { value: "", label: "All product types" },
                ...productTypes.map((pt) => ({ value: pt.name, label: pt.name })),
              ]}
              value={typeFilter}
              onValueChange={(next) => {
                setTypeFilter(next ?? "");
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by product type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All product types</SelectItem>
                {productTypes.map((pt) => (
                  <SelectItem key={pt.id} value={pt.name}>
                    {pt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="check-label">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => {
                  setIncludeArchived(e.target.checked);
                  setPage(1);
                }}
              />
              Show archived
            </label>
          </>
        }
        emptyState={
          <Empty
            title="No attributes match"
            text="Create a custom attribute or clear the active product type filter."
          />
        }
      />

      {draft ? (
        <FormDialog
          open
          onOpenChange={(nextOpen) => !nextOpen && setDraft(null)}
          size="lg"
          title={draft.id ? `Edit ${draft.name}` : "New dynamic attribute"}
          description="Attribute codes must be unique lowercase identifiers (letters, numbers, underscores)."
          submitLabel={draft.id ? "Save attribute" : "Create attribute"}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          error={error}
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
          <FormDialogRow>
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
          </FormDialogRow>

          <FormDialogRow>
            <label>
              Data type
              <Select
                disabled={Boolean(draft.id)}
                items={DATA_TYPE_ITEMS}
                value={draft.dataType}
                onValueChange={(next) =>
                  next &&
                  setDraft((prev) =>
                    prev ? { ...prev, dataType: next as AttributeDataType } : null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Bind to product type (optional)
              <Select
                items={[
                  { value: "", label: "None" },
                  ...productTypes.map((pt) => ({ value: pt.id, label: pt.name })),
                ]}
                value={draft.bindProductTypeId}
                onValueChange={(next) =>
                  setDraft((prev) =>
                    prev ? { ...prev, bindProductTypeId: next ?? "" } : null
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

          <FormDialogRow>
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
              <FormDialogRow>
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
              </FormDialogRow>
            ) : (
              <div />
            )}
          </FormDialogRow>

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

          <div className="button-row" style={{ gap: 14 }}>
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
        </FormDialog>
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
