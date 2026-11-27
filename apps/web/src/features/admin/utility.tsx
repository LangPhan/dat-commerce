"use client";

import { revalidateStorefrontCache } from "@/lib/revalidate-store";
import { STORE_CACHE_TAGS } from "@/lib/store-cache-tags";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Pagination, Skeleton } from "@/components/ui/data-display";
import {
  DataTable,
  DataTableCard,
  DataTableFooter,
  DataTableSearch,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { ConfirmDialog, Drawer } from "@/components/ui/dialog";
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
import {
  adminCatalogApi,
  adminMediaApi,
  adminOrderApi,
} from "@/lib/commerce-api";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { formatDateTime, newId, slugify, usdExact } from "@/lib/format";
import { useStored } from "@/lib/storage";
import type { PageSummaryDto, NavigationItemDto } from "@/types/api-cms-ai";
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

  const [query, setQuery] = useState("");
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
    queryKey: ["admin-products", "", "", ""],
    queryFn: () => adminCatalogApi.listProducts(),
    enabled: Boolean(edit),
  });

  const editProductIdSet = useMemo(
    () => new Set(edit?.productIds || []),
    [edit?.productIds]
  );

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

  const collections = (collectionsQuery.data || []).filter((item) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q)
    );
  });
  const products = productsQuery.data || [];

  function openEditCollection(item: CollectionDto) {
    setError("");
    setEdit({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      productIds: item.productIds,
    });
  }

  const columns: DataTableColumn<CollectionDto>[] = [
    {
      id: "name",
      header: "Collection",
      cell: (item) =>
        canWrite ? (
          <button
            type="button"
            className="text-button"
            onClick={() => openEditCollection(item)}
          >
            {item.name}
          </button>
        ) : (
          <strong>{item.name}</strong>
        ),
    },
    { id: "slug", header: "Slug", cell: (item) => <code>{item.slug}</code> },
    {
      id: "description",
      header: "Description",
      cell: (item) => <span className="muted">{item.description || "—"}</span>,
    },
    {
      id: "products",
      header: "Products",
      cell: (item) => <Badge tone="accent">{item.productIds.length} products</Badge>,
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Actions",
            align: "right" as const,
            cell: (item: CollectionDto) => (
              <div className="button-row" style={{ justifyContent: "flex-end" }}>
                <IconButton
                  label={`Edit ${item.name}`}
                  onClick={() => openEditCollection(item)}
                >
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  label={`Delete ${item.name}`}
                  onClick={() => setDeleteTarget(item)}
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

      <DataTable
        columns={columns}
        data={collections}
        getRowKey={(item) => item.id}
        isLoading={collectionsQuery.isLoading}
        pageSize={10}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search collection name or slug…"
        searchAriaLabel="Search collections"
        emptyState={
          <Empty
            title="No collections yet"
            text="Create a collection to group featured products across categories."
          />
        }
      />

      {edit ? (
        <FormDialog
          open
          onOpenChange={(nextOpen) => !nextOpen && setEdit(null)}
          size="lg"
          title={edit.id ? `Edit ${edit.name}` : "New collection"}
          description="Assign products to display under this curated assortment."
          submitLabel="Save collection"
          isSubmitting={saveMutation.isPending}
          error={error}
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
          <FormDialogRow>
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
          </FormDialogRow>
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
              className="button-row"
              style={{
                marginTop: 8,
                maxHeight: 200,
                overflowY: "auto",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {products.map((p) => {
                const checked = editProductIdSet.has(p.id);
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
        </FormDialog>
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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const PAGE_SIZE = 8;

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

  const assets = (mediaQuery.data || []).filter((asset) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      asset.originalFilename.toLowerCase().includes(q) ||
      (asset.altText || "").toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(assets.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageAssets = assets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        <p className="danger" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}

      <DataTableCard>
        <DataTableToolbar>
          <DataTableSearch
            value={query}
            onChange={(next) => {
              setQuery(next);
              setPage(1);
            }}
            placeholder="Search uploaded filename or alt text…"
            ariaLabel="Search media assets"
          />
        </DataTableToolbar>
        {mediaQuery.isLoading ? (
          <div className="ui-data-table-loading">
            <Skeleton rows={3} />
          </div>
        ) : pageAssets.length ? (
          <div className="admin-media-scroll">
            <div className="admin-media">
              {pageAssets.map((asset) => (
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
          </div>
        ) : (
          <div className="ui-data-table-empty">
            <Empty
              title="No uploaded media assets yet"
              text="Upload an image above to store it in Silo S3 and attach it to catalog products."
            />
          </div>
        )}
        {assets.length > 0 && !mediaQuery.isLoading ? (
          <DataTableFooter>
            <Pagination
              page={safePage}
              totalItems={assets.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </DataTableFooter>
        ) : null}
      </DataTableCard>
    </>
  );
}

function CustomersView() {
  const [query, setQuery] = useState("");
  const [customerDrawer, setCustomerDrawer] = useState<{
    name: string;
    email: string;
    orders: OrderDto[];
  } | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", ""],
    queryFn: () => adminOrderApi.list(),
  });

  type CustomerRow = {
    name: string;
    email: string;
    orders: OrderDto[];
    totalSpend: number;
  };

  const allCustomers = useMemo<CustomerRow[]>(() => {
    const orders = ordersQuery.data || [];
    const grouped = new Map<string, CustomerRow>();
    for (const o of orders) {
      const key = o.customerEmail.toLowerCase();
      const delta = o.status !== "CANCELED" ? Number(o.grandTotal) : 0;
      const existing = grouped.get(key);
      if (existing) {
        existing.orders.push(o);
        existing.totalSpend += delta;
      } else {
        grouped.set(key, {
          name: o.customerName,
          email: o.customerEmail,
          orders: [o],
          totalSpend: delta,
        });
      }
    }
    return Array.from(grouped.values());
  }, [ordersQuery.data]);

  const customers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [allCustomers, query]);

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      id: "name",
      header: "Customer",
      cell: (c) => (
        <button
          type="button"
          className="text-button"
          onClick={() => setCustomerDrawer(c)}
        >
          {c.name}
        </button>
      ),
    },
    { id: "email", header: "Email", cell: (c) => c.email },
    { id: "orders", header: "Orders", cell: (c) => c.orders.length },
    {
      id: "spend",
      header: "Lifetime spend",
      cell: (c) => <strong>{usdExact(c.totalSpend)}</strong>,
    },
    {
      id: "latest",
      header: "Latest order",
      cell: (c) => (
        <Link href={`/admin/orders/${c.orders[0].id}`}>
          {c.orders[0].orderNumber}
        </Link>
      ),
    },
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Customers</h1>
          <p>Customer directory aggregated live from storefront and merchant orders.</p>
        </div>
        <Badge tone="accent">{customers.length} customers</Badge>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        getRowKey={(c) => c.email}
        isLoading={ordersQuery.isLoading}
        pageSize={10}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search customer name or email…"
        searchAriaLabel="Search customers"
        emptyState={
          <Empty
            title="No customer orders yet"
            text="Customers appear automatically after their first checkout."
          />
        }
      />

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
  const [query, setQuery] = useState("");
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

  const pages = (pagesQuery.data || []).filter((p) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
  });

  const columns: DataTableColumn<PageSummaryDto>[] = [
    { id: "page", header: "Page", cell: (p) => <strong>{p.title}</strong> },
    {
      id: "slug",
      header: "Slug",
      cell: (p) => <code>{p.slug === "home" ? "/" : `/store/${p.slug}`}</code>,
    },
    {
      id: "status",
      header: "Status",
      cell: (p) => (
        <StatusBadge status={p.hasUnpublishedChanges ? "Draft" : p.status} />
      ),
    },
    { id: "version", header: "Version", cell: (p) => `v${p.latestVersionNumber}` },
    {
      id: "sections",
      header: "Sections",
      cell: (p) => `${p.blockCount} ${p.blockCount === 1 ? "section" : "sections"}`,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (p) => {
        const livePath = p.slug === "home" ? "/" : `/store/${p.slug}`;
        return (
          <div className="button-row" style={{ justifyContent: "flex-end" }}>
            <Link
              className="btn btn-sm primary"
              href={`/admin/editor?page=${encodeURIComponent(p.slug)}`}
            >
              Edit in Visual Editor
            </Link>
            {p.publishedVersionId ? (
              <Link className="btn btn-sm" href={livePath} target="_blank">
                View live <ArrowUpRight size={13} />
              </Link>
            ) : null}
          </div>
        );
      },
    },
  ];

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

      <DataTable
        columns={columns}
        data={pages}
        getRowKey={(p) => p.id}
        isLoading={pagesQuery.isLoading}
        pageSize={10}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search page title or slug…"
        searchAriaLabel="Search CMS pages"
        emptyState={
          <Empty title="No CMS pages yet" text="Create your first storefront page." />
        }
      />

      {modalOpen ? (
        <FormDialog
          open
          onOpenChange={setModalOpen}
          size="sm"
          title="New CMS page"
          description="Create a blank draft page ready for the Visual Store Editor."
          submitLabel="Create draft page"
          isSubmitting={createMutation.isPending}
          error={error}
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
        </FormDialog>
      ) : null}
    </>
  );
}

function NavigationView({ notify }: { notify: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const [modalItem, setModalItem] = useState<{
    id?: string;
    label: string;
    url: string;
  } | null>(null);

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
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.navigation], paths: ["/"] }).catch(() => undefined);
      notify("Navigation menu saved");
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to update menu"),
  });

  const items = useMemo(() => navQuery.data?.items || [], [navQuery.data]);
  const indexById = useMemo(
    () => new Map(items.map((entry, idx) => [entry.id, idx])),
    [items]
  );

  const columns: DataTableColumn<NavigationItemDto>[] = [
    { id: "label", header: "Label", cell: (item) => <strong>{item.label}</strong> },
    { id: "url", header: "Destination", cell: (item) => <code>{item.url}</code> },
    {
      id: "order",
      header: "Actions",
      align: "right",
      cell: (item) => {
        const index = indexById.get(item.id) ?? -1;
        return canWrite ? (
          <div className="button-row" style={{ justifyContent: "flex-end" }}>
            <IconButton
              label={`Edit ${item.label}`}
              onClick={() => setModalItem({ id: item.id, label: item.label, url: item.url })}
            >
              <Pencil size={14} />
            </IconButton>
            <IconButton
              label="Move up"
              disabled={index <= 0 || updateMutation.isPending}
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
        );
      },
    },
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Navigation</h1>
          <p>Reorder, add, edit, or remove links shown in the customer storefront header.</p>
        </div>
        {canWrite ? (
          <Button
            variant="primary"
            onClick={() => setModalItem({ label: "", url: "/store/shop" })}
          >
            <Plus size={15} /> Add link
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={items}
        getRowKey={(item) => item.id}
        isLoading={navQuery.isLoading}
        pageSize={10}
        emptyState={
          <Empty
            title="No navigation links"
            text="Add links to populate the storefront header."
          />
        }
      />

      {modalItem ? (
        <FormDialog
          open
          onOpenChange={(nextOpen) => !nextOpen && setModalItem(null)}
          size="sm"
          title={modalItem.id ? `Edit ${modalItem.label}` : "Add navigation link"}
          description="Uses allowlisted internal / paths or https:// URLs."
          submitLabel={modalItem.id ? "Save link" : "Add link"}
          isSubmitting={updateMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            const label = modalItem.label.trim();
            const url = modalItem.url.trim();
            if (!label || !url) return;
            if (modalItem.id) {
              updateMutation.mutate(
                items.map((item) =>
                  item.id === modalItem.id ? { ...item, label, url } : item
                )
              );
            } else {
              updateMutation.mutate([...items, { id: newId(), label, url }]);
            }
            setModalItem(null);
          }}
        >
          <label>
            Label
            <input
              required
              value={modalItem.label}
              placeholder="New Arrivals"
              onChange={(e) =>
                setModalItem((prev) =>
                  prev ? { ...prev, label: e.target.value } : null
                )
              }
            />
          </label>
          <label>
            Destination path
            <input
              required
              value={modalItem.url}
              placeholder="/store/shop"
              onChange={(e) =>
                setModalItem((prev) =>
                  prev ? { ...prev, url: e.target.value } : null
                )
              }
            />
          </label>
        </FormDialog>
      ) : null}
    </>
  );
}

function StorePreferencesView({
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
              <Select
                name={field.label}
                items={field.options.map((opt) => ({ value: opt, label: opt }))}
                defaultValue={preferences[field.label] || field.default}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    <div className="admin-page-scroll">
      <div className="admin-title">
        <div>
          <h1>{title}</h1>
          <p>Configure store preferences.</p>
        </div>
      </div>
      {content}
    </div>
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
  if (view === "collections") return <CollectionsView notify={notify} />;
  if (view === "media") return <MediaLibraryView notify={notify} />;
  if (view === "customers") return <CustomersView />;
  if (view === "pages") return <PagesView notify={notify} />;
  if (view === "navigation") return <NavigationView notify={notify} />;
  return <StorePreferencesView view={view} title={title} notify={notify} />;
}
