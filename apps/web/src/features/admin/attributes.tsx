"use client";
import { Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/data-display";
import { newId } from "@/lib/format";
import { attributeTypes, type Attribute, type Category } from "@/types/commerce";

export function Attributes({
  items,
  save,
  categories,
  notify,
}: {
  items: Attribute[];
  save: (next: Attribute[]) => void;
  categories: Category[];
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [edit, setEdit] = useState<Attribute | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Attribute | null>(null);
  const [error, setError] = useState("");

  const productTypes = Array.from(
    new Set([
      "All products",
      ...categories.map((c) => c.name),
      ...items.map((a) => a.productType),
    ])
  );

  const visible = items
    .filter((item) => {
      if (typeFilter && item.productType !== typeFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.productType.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.productType.localeCompare(b.productType) || a.order - b.order);

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Dynamic Attributes</h1>
          <p>
            Define custom product schemas per product type and control storefront filter facets.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setError("");
            setEdit({
              id: "",
              name: "",
              code: "",
              type: "Text",
              required: false,
              filterable: true,
              searchable: true,
              order: items.length + 1,
              validation: "",
              options: "",
              unit: "",
              productType: typeFilter || "All products",
            });
          }}
        >
          <Plus size={15} /> New attribute
        </Button>
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
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </div>

        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Data type</th>
                  <th>Product type</th>
                  <th>Behavior</th>
                  <th>Order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setError("");
                          setEdit(item);
                        }}
                      >
                        {item.name}
                      </button>
                      {item.unit ? (
                        <span className="muted" style={{ fontSize: 11, marginLeft: 5 }}>
                          ({item.unit})
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <code>{item.code}</code>
                    </td>
                    <td>
                      <Badge tone="accent">{item.type}</Badge>
                    </td>
                    <td>{item.productType}</td>
                    <td>
                      <div className="button-row" style={{ gap: 4 }}>
                        {item.required ? <Badge tone="amber">Required</Badge> : null}
                        {item.filterable ? <Badge tone="green">Filterable</Badge> : null}
                        {item.searchable ? <Badge>Searchable</Badge> : null}
                      </div>
                    </td>
                    <td>{item.order}</td>
                    <td>
                      <IconButton
                        label={`Delete ${item.name}`}
                        onClick={() => setRemoveTarget(item)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
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

      {edit ? (
        <Modal
          title={edit.id ? `Edit ${edit.name}` : "New dynamic attribute"}
          description="Attribute codes must be unique lowercase identifiers (letters, numbers, underscores)."
          close={() => setEdit(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                items.some(
                  (item) => item.code === edit.code && item.id !== edit.id
                )
              ) {
                setError("This attribute code is already in use.");
                return;
              }
              if (edit.validation) {
                try {
                  new RegExp(edit.validation);
                } catch {
                  setError("Enter a valid regular expression.");
                  return;
                }
              }
              save(
                edit.id
                  ? items.map((item) => (item.id === edit.id ? edit : item))
                  : [...items, { ...edit, id: newId() }]
              );
              setEdit(null);
              notify("Attribute saved");
            }}
          >
            <div className="form-pair">
              <label>
                Display name
                <input
                  required
                  value={edit.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setEdit({
                      ...edit,
                      name: nextName,
                      code:
                        edit.id || edit.code
                          ? edit.code
                          : nextName
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "_")
                              .replace(/^_|_$/g, ""),
                    });
                  }}
                />
              </label>
              <label>
                Unique code
                <input
                  required
                  pattern="[a-z][a-z0-9_]*"
                  value={edit.code}
                  onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                />
              </label>
              <label>
                Data type
                <select
                  value={edit.type}
                  onChange={(e) =>
                    setEdit({ ...edit, type: e.target.value as Attribute["type"] })
                  }
                >
                  {attributeTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Product type
                <select
                  value={edit.productType}
                  onChange={(e) =>
                    setEdit({ ...edit, productType: e.target.value })
                  }
                >
                  {productTypes.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="button-row" style={{ gap: 16 }}>
              {(["required", "filterable", "searchable"] as const).map((key) => (
                <label className="check-label" key={key}>
                  <input
                    type="checkbox"
                    checked={edit[key]}
                    onChange={(e) => setEdit({ ...edit, [key]: e.target.checked })}
                  />
                  <span style={{ textTransform: "capitalize" }}>{key}</span>
                </label>
              ))}
            </div>

            <div className="form-pair">
              <label>
                Display order
                <input
                  type="number"
                  min={0}
                  value={edit.order}
                  onChange={(e) =>
                    setEdit({ ...edit, order: Number(e.target.value) })
                  }
                />
              </label>
              {edit.type === "Measurement" ? (
                <label>
                  Measurement unit
                  <input
                    placeholder="e.g. in, GB, mm, L"
                    value={edit.unit || ""}
                    onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                  />
                </label>
              ) : (
                <label>
                  Validation regex (optional)
                  <input
                    placeholder="e.g. ^[A-Z0-9-]+$"
                    value={edit.validation}
                    onChange={(e) =>
                      setEdit({ ...edit, validation: e.target.value })
                    }
                  />
                </label>
              )}
            </div>

            {edit.type === "Select" || edit.type === "Multi-select" ? (
              <label>
                Options (comma-separated)
                <input
                  required
                  placeholder="16 GB, 32 GB, 64 GB"
                  value={edit.options}
                  onChange={(e) => setEdit({ ...edit, options: e.target.value })}
                />
              </label>
            ) : null}

            {error ? (
              <p role="alert" className="danger">
                {error}
              </p>
            ) : null}

            <div className="modal-actions">
              <Button onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Save attribute
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {removeTarget ? (
        <ConfirmDialog
          title={`Delete attribute "${removeTarget.name}"?`}
          description="It will no longer appear on new product forms or storefront filters."
          confirmLabel="Delete attribute"
          destructive
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => {
            save(items.filter((a) => a.id !== removeTarget.id));
            setRemoveTarget(null);
            notify("Attribute removed");
          }}
        />
      ) : null}
    </>
  );
}
