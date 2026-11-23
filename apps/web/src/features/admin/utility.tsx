"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  adminCatalogApi,
  adminMediaApi,
  adminOrderApi,
} from "@/lib/commerce-api";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { formatDateTime, newId, slugify, usdExact } from "@/lib/format";
import { useStored } from "@/lib/storage";
import type { NavigationItemDto } from "@/types/api-cms-ai";
import type { CollectionDto, OrderDto } from "@/types/api-commerce";

type FieldConfig = {
  label: string;
  default: string;
  options?: string[];
};

const settingsConfig: Record<string, FieldConfig[]> = {
  payment: [
    { label: "Provider", default: "Sandbox Payment Gateway", options: ["Sandbox Payment Gateway", "Stripe", "Adyen"] },
    { label: "Statement descriptor", default: "DAT COMMERCE" },
    { label: "Capture timing", default: "Automatic on checkout", options: ["Automatic on checkout", "Manual authorize"] },
  ],
  shipping: [
    { label: "Origin warehouse", default: "Portland Distribution Hub (US-West)" },
    { label: "Standard shipping fee", default: "12.00" },
    { label: "Free shipping threshold", default: "100.00" },
  ],
  tax: [
    { label: "Tax calculation", default: "Zero-rated sandbox (Phase 3)", options: ["Zero-rated sandbox (Phase 3)", "Automatic regional rates"] },
    { label: "Included in prices", default: "No", options: ["Yes", "No"] },
  ],
  integrations: [
    { label: "S3 media endpoint", default: "http://silo:9000 (/storage proxy)" },
    { label: "AI Gateway (9Router)", default: "Server-side only (mock / live mode via env)" },
  ],
};

function CollectionsView({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("catalog:write");

  const [edit, setEdit] = useState<{
    id?: string;
    name: string;
    slug: string;
    description: string;
    productIds: string[];
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionDto | null>(null);
  const [error, setError] = useState("");

  const collectionsQuery = useQuery({
    queryKey: ["admin-collections"],
    queryFn: () => adminCatalogApi.listCollections(),
  });
  const productsQuery = useQuery({
    queryKey: ["admin-products", "collection-picker"],
    queryFn: () => adminCatalogApi.listProducts(),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: {
      id?: string;
      name: string;
      slug: string;
      description: string;
      productIds: string[];
    }) =>
      payload.id
        ? adminCatalogApi.updateCollection(payload.id, {
            name: payload.name,
            slug: payload.slug || undefined,
            description: payload.description,
            productIds: payload.productIds,
          })
        : adminCatalogApi.createCollection({
            name: payload.name,
            slug: payload.slug || undefined,
            description: payload.description,
            productIds: payload.productIds,
          }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
      setEdit(null);
      notify(vars.id ? "Collection updated" : "Collection created");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to save collection"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCatalogApi.deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
      setDeleteTarget(null);
      notify("Collection deleted");
    },
    onError: (err) => {
      setDeleteTarget(null);
      notify(err instanceof ApiError ? err.message : "Failed to delete collection");
    },
  });

  const collections = collectionsQuery.data || [];
  const products = productsQuery.data || [];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Collections</h1>
          <p>Curate themed product assortments stored in PostgreSQL and exposed on the storefront.</p>
        </div>
        {canWrite ? (
          <Button
            variant="primary"
            onClick={() => {
              setError("");
              setEdit({ name: "", slug: "", description: "", productIds: [] });
            }}
          >
            <Plus size={15} /> Create collection
          </Button>
        ) : null}
      </div>

      {collectionsQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : collections.length ? (
        <div className="admin-table-panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Collection</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Products</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collections.map((item) => (
                <tr key={item.id}>
                  <td>
                    {canWrite ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setError("");
                          setEdit({
                            id: item.id,
                            name: item.name,
                            slug: item.slug,
                            description: item.description || "",
                            productIds: item.productIds,
                          });
                        }}
                      >
                        {item.name}
                      </button>
                    ) : (
                      <strong>{item.name}</strong>
                    )}
                  </td>
                  <td>
                    <code>{item.slug}</code>
                  </td>
                  <td className="muted">{item.description || "—"}</td>
                  <td>
                    <Badge tone="accent">{item.productIds.length} products</Badge>
                  </td>
                  <td>
                    {canWrite ? (
                      <IconButton
                        label={`Delete ${item.name}`}
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 size={14} />
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
          title="No collections yet"
          text="Create a collection to group featured products across categories."
        />
      )}

      {edit ? (
        <Modal
          title={edit.id ? `Edit ${edit.name}` : "New collection"}
          description="Assign products to display under this curated assortment."
          close={() => setEdit(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (!edit.name.trim()) {
                setError("Name is required.");
                return;
              }
              saveMutation.mutate(edit);
            }}
          >
            <div className="field-row">
              <label>
                Name
                <input
                  required
                  value={edit.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setEdit((prev) =>
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
                  value={edit.slug}
                  onChange={(e) =>
                    setEdit((prev) =>
                      prev ? { ...prev, slug: slugify(e.target.value) } : null
                    )
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                rows={2}
                value={edit.description}
                onChange={(e) =>
                  setEdit((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
              />
            </label>
            <div>
              <strong style={{ fontSize: 12.5 }}>Assigned products</strong>
              <div
                className="check-row"
                style={{
                  marginTop: 8,
                  maxHeight: 200,
                  overflowY: "auto",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {products.map((p) => {
                  const checked = edit.productIds.includes(p.id);
                  return (
                    <label className="check-label" key={p.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setEdit((prev) => {
                            if (!prev) return null;
                            const next = e.target.checked
                              ? [...prev.productIds, p.id]
                              : prev.productIds.filter((x) => x !== p.id);
                            return { ...prev, productIds: next };
                          })
                        }
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            </div>
            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setEdit(null)}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={saveMutation.isPending}>
                Save collection
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          description="Removes this collection without affecting underlying products."
          confirmLabel="Delete"
          destructive
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      ) : null}
    </>
  );
}

function MediaLibraryView({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("media:write");
  const [error, setError] = useState("");

  const mediaQuery = useQuery({
    queryKey: ["admin-media"],
    queryFn: () => adminMediaApi.list(),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminMediaApi.upload(file, file.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      setError("");
      notify("Uploaded asset to Silo S3");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to upload asset"),
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => adminMediaApi.remove(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      notify("Deleted media asset");
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to delete asset"),
  });

  const assets = mediaQuery.data || [];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Media Library</h1>
          <p>
            Upload and manage product images in Silo S3 object storage (served via <code>/storage</code>).
          </p>
        </div>
        {canWrite ? (
          <label className="btn primary media-upload">
            <Upload size={15} />{" "}
            {uploadMutation.isPending ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              aria-label="Upload image"
              disabled={uploadMutation.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 5_000_000) {
                  setError("Choose an image under 5 MB.");
                  return;
                }
                uploadMutation.mutate(file);
              }}
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="danger" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      {mediaQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : assets.length ? (
        <div className="admin-media">
          {assets.map((asset) => (
            <div key={asset.id} className="panel">
              <img src={asset.url} alt={asset.altText || asset.originalFilename} />
              <div>
                <strong>{asset.originalFilename}</strong>
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(asset.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No uploaded media assets yet"
          text="Upload an image above to store it in Silo S3 and attach it to catalog products."
        />
      )}
    </>
  );
}

function CustomersView() {
  const [customerDrawer, setCustomerDrawer] = useState<{
    name: string;
    email: string;
    orders: OrderDto[];
  } | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", "customers"],
    queryFn: () => adminOrderApi.list(),
  });

  const orders = ordersQuery.data || [];
  const grouped = new Map<string, { name: string; email: string; orders: OrderDto[] }>();
  for (const o of orders) {
    const existing = grouped.get(o.customerEmail.toLowerCase());
    if (existing) existing.orders.push(o);
    else {
      grouped.set(o.customerEmail.toLowerCase(), {
        name: o.customerName,
        email: o.customerEmail,
        orders: [o],
      });
    }
  }
  const customers = Array.from(grouped.values());

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Customers</h1>
          <p>Customer directory aggregated live from storefront and merchant orders.</p>
        </div>
        <Badge tone="accent">{customers.length} customers</Badge>
      </div>

      {ordersQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : customers.length ? (
        <div className="admin-table-panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Orders</th>
                <th>Lifetime spend</th>
                <th>Latest order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const spend = c.orders
                  .filter((o) => o.status !== "CANCELED")
                  .reduce((s, o) => s + Number(o.grandTotal), 0);
                return (
                  <tr key={c.email}>
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setCustomerDrawer(c)}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td>{c.email}</td>
                    <td>{c.orders.length}</td>
                    <td>
                      <strong>{usdExact(spend)}</strong>
                    </td>
                    <td>
                      <Link href={`/admin/orders/${c.orders[0].id}`}>
                        {c.orders[0].orderNumber}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No customer orders yet"
          text="Customers appear automatically after their first checkout."
        />
      )}

      {customerDrawer ? (
        <Drawer
          title={customerDrawer.name}
          description={customerDrawer.email}
          close={() => setCustomerDrawer(null)}
        >
          <div className="form-stack">
            <strong>Order history ({customerDrawer.orders.length})</strong>
            {customerDrawer.orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="panel"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{order.orderNumber}</strong>
                  <p className="muted" style={{ fontSize: 11.5 }}>
                    {formatDateTime(order.createdAt)} · {order.status}
                  </p>
                </div>
                <strong>{usdExact(order.grandTotal)}</strong>
              </Link>
            ))}
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function PagesView({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");

  const pagesQuery = useQuery({
    queryKey: ["admin-pages"],
    queryFn: () => cmsAdminApi.listPages(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { slug: string; title: string }) =>
      cmsAdminApi.createPage({
        slug: payload.slug,
        title: payload.title,
        content: { version: 1, blocks: [] },
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      setModalOpen(false);
      notify(`Created page "${created.title}"`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to create page"),
  });

  const pages = pagesQuery.data || [];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Pages</h1>
          <p>
            Schema-driven CMS pages persisted in PostgreSQL with versioned draft/publish workflows.
          </p>
        </div>
        {canWrite ? (
          <Button
            variant="primary"
            onClick={() => {
              setError("");
              setModalOpen(true);
            }}
          >
            <Plus size={15} /> New page
          </Button>
        ) : null}
      </div>

      {pagesQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : pages.length ? (
        <div className="admin-table-panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Version</th>
                <th>Sections</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const livePath = p.slug === "home" ? "/store" : `/store/${p.slug}`;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                    </td>
                    <td>
                      <code>{livePath}</code>
                    </td>
                    <td>
                      <StatusBadge
                        status={p.hasUnpublishedChanges ? "Draft" : p.status}
                      />
                    </td>
                    <td>v{p.latestVersionNumber}</td>
                    <td>{p.blockCount} sections</td>
                    <td>
                      <div className="button-row">
                        <Link
                          className="btn btn-sm primary"
                          href={`/?page=${encodeURIComponent(p.slug)}`}
                        >
                          Edit in Visual Editor
                        </Link>
                        {p.publishedVersionId ? (
                          <Link className="btn btn-sm" href={livePath} target="_blank">
                            View live <ArrowUpRight size={13} />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No CMS pages yet" text="Create your first storefront page." />
      )}

      {modalOpen ? (
        <Modal
          title="New CMS page"
          description="Create a blank draft page ready for the Visual Store Editor."
          close={() => setModalOpen(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              const fd = new FormData(e.currentTarget);
              const title = String(fd.get("title") || "").trim();
              const slug = slugify(String(fd.get("slug") || title));
              if (!title || !slug) {
                setError("Title and slug are required.");
                return;
              }
              createMutation.mutate({ title, slug });
            }}
          >
            <label>
              Title
              <input name="title" required placeholder="Field Guide" />
            </label>
            <label>
              Slug
              <input name="slug" placeholder="field-guide" />
            </label>
            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={createMutation.isPending}>
                Create draft page
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function NavigationView({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const [modalOpen, setModalOpen] = useState(false);

  const navQuery = useQuery({
    queryKey: ["admin-nav", "main"],
    queryFn: () => cmsAdminApi.getNavigation("main"),
  });

  const updateMutation = useMutation({
    mutationFn: (items: NavigationItemDto[]) =>
      cmsAdminApi.updateNavigation("main", items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-nav", "main"] });
      queryClient.invalidateQueries({ queryKey: ["store-nav", "main"] });
      notify("Navigation menu saved");
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to update menu"),
  });

  const items = navQuery.data?.items || [];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Navigation</h1>
          <p>Reorder, add, or remove links shown in the customer storefront header.</p>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Add link
          </Button>
        ) : null}
      </div>

      {navQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : items.length ? (
        <div className="admin-table-panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Destination</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.label}</strong>
                  </td>
                  <td>
                    <code>{item.url}</code>
                  </td>
                  <td>
                    {canWrite ? (
                      <div className="button-row">
                        <IconButton
                          label="Move up"
                          disabled={index === 0 || updateMutation.isPending}
                          onClick={() => {
                            const next = [...items];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            updateMutation.mutate(next);
                          }}
                        >
                          <ArrowUp size={14} />
                        </IconButton>
                        <IconButton
                          label="Move down"
                          disabled={index === items.length - 1 || updateMutation.isPending}
                          onClick={() => {
                            const next = [...items];
                            [next[index + 1], next[index]] = [next[index], next[index + 1]];
                            updateMutation.mutate(next);
                          }}
                        >
                          <ArrowDown size={14} />
                        </IconButton>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updateMutation.isPending}
                          onClick={() => {
                            updateMutation.mutate(items.filter((l) => l.id !== item.id));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <span className="muted">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No navigation links" text="Add links to populate the storefront header." />
      )}

      {modalOpen ? (
        <Modal
          title="Add navigation link"
          description="Uses allowlisted internal / paths or https:// URLs."
          close={() => setModalOpen(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const label = String(fd.get("label") || "").trim();
              const url = String(fd.get("url") || "").trim();
              updateMutation.mutate([...items, { id: newId(), label, url }]);
              setModalOpen(false);
            }}
          >
            <label>
              Label
              <input name="label" required placeholder="New Arrivals" />
            </label>
            <label>
              Destination path
              <input name="url" required placeholder="/store/shop" />
            </label>
            <div className="modal-actions">
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
                Add link
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function UtilityPage({
  view,
  title,
  notify,
}: {
  view: string;
  title: string;
  notify: (message: string) => void;
}) {
  const [preferences, setPreferences, preferencesReady] = useStored<Record<string, string>>(
    "preferences:" + view,
    {}
  );

  if (view === "collections") return <CollectionsView notify={notify} />;
  if (view === "media") return <MediaLibraryView notify={notify} />;
  if (view === "customers") return <CustomersView />;
  if (view === "pages") return <PagesView notify={notify} />;
  if (view === "navigation") return <NavigationView notify={notify} />;

  let content: React.ReactNode = (
    <Empty title={title} text="Configuration view ready." />
  );

  if (settingsConfig[view]) {
    content = preferencesReady ? (
      <form
        className="panel form-stack utility-form"
        onSubmit={(e) => {
          e.preventDefault();
          setPreferences(
            Object.fromEntries(
              Array.from(new FormData(e.currentTarget), ([key, value]) => [
                key,
                String(value),
              ])
            )
          );
          notify("Settings saved");
        }}
      >
        {settingsConfig[view].map((field) => (
          <label key={field.label}>
            {field.label}
            {field.options ? (
              <select
                name={field.label}
                defaultValue={preferences[field.label] || field.default}
              >
                {field.options.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                required
                name={field.label}
                defaultValue={preferences[field.label] || field.default}
              />
            )}
          </label>
        ))}
        <div>
          <Button variant="primary" type="submit">
            Save settings
          </Button>
        </div>
      </form>
    ) : null;
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{title}</h1>
          <p>Configure store preferences.</p>
        </div>
      </div>
      {content}
    </>
  );
}
