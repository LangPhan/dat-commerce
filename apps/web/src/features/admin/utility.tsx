"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, Copy, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/data-display";
import { newId, usdExact } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { initialCollections } from "@/mocks/catalog";
import { initialMembers } from "@/mocks/operations";
import { initialBlocks, initialStoreMenu, pagePaths, pageTemplates } from "@/mocks/pages";
import type {
  Collection,
  MediaAsset,
  Order,
  Product,
  StoreMenuLink,
  TeamMember,
} from "@/types/commerce";
import type { Block } from "@/types/editor";

type Field = { label: string; default: string; options?: string[] };

const settingsConfig: Record<string, Field[]> = {
  general: [
    { label: "Currency", default: "USD", options: ["USD", "EUR", "GBP", "VND"] },
    { label: "Timezone", default: "America/Los_Angeles" },
    { label: "Unit system", default: "Imperial", options: ["Imperial", "Metric"] },
  ],
  "store-information": [
    { label: "Store name", default: "Terrain Supply" },
    { label: "Contact email", default: "hello@terrain.example" },
    { label: "Public domain", default: "terrain.example" },
  ],
  payment: [
    {
      label: "Checkout provider",
      default: "Demo payments",
      options: ["Demo payments", "Stripe (configured)", "Medusa Pay"],
    },
    { label: "Capture method", default: "Automatic", options: ["Automatic", "Manual"] },
  ],
  shipping: [
    { label: "Standard shipping fee", default: "12" },
    { label: "Free shipping threshold", default: "100" },
    { label: "Dispatch estimate", default: "2 business days" },
  ],
  tax: [
    { label: "Tax region", default: "United States" },
    { label: "Display prices", default: "Exclude tax", options: ["Exclude tax", "Include tax"] },
  ],
  integrations: [
    { label: "Commerce backend", default: "Medusa v2" },
    { label: "CMS & page builder", default: "Payload CMS" },
    { label: "LLM gateway", default: "9Router" },
  ],
};

export function UtilityPage({
  view,
  title,
  products,
  orders,
  notify,
}: {
  view: string;
  title: string;
  products: Product[];
  orders: Order[];
  notify: (message: string) => void;
}) {
  const [preferences, setPreferences, preferencesReady] = useStored<Record<string, string>>(
    "preferences:" + view,
    {}
  );
  const [collections, setCollections] = useStored<Collection[]>(
    "collections",
    initialCollections
  );
  const [menu, setMenu] = useStored<StoreMenuLink[]>("store-menu", initialStoreMenu);
  const [members, setMembers] = useStored<TeamMember[]>("members", initialMembers);
  const [media, setMedia] = useStored<MediaAsset[]>("media", []);
  const [draft] = useStored<Block[]>("draft", initialBlocks);
  const [published] = useStored<Block[]>("published", initialBlocks);

  const [modalOpen, setModalOpen] = useState(false);
  const [collectionEdit, setCollectionEdit] = useState<Collection | null>(null);
  const [deleteCollection, setDeleteCollection] = useState<Collection | null>(null);
  const [customerDrawer, setCustomerDrawer] = useState<{
    name: string;
    email: string;
    orders: Order[];
  } | null>(null);
  const [error, setError] = useState("");

  let subtitle = "";
  let action: React.ReactNode = null;
  let content: React.ReactNode = null;

  if (settingsConfig[view]) {
    subtitle = "Configure store preferences persisted across your workspace.";
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
  } else if (view === "pages") {
    subtitle = "Manage CMS pages and jump directly into the AI Visual Store Editor.";
    const homeSynced = JSON.stringify(draft) === JSON.stringify(published);
    content = (
      <div className="admin-table-panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Page</th>
              <th>Route</th>
              <th>Status</th>
              <th>Sections</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(pageTemplates).map(([label, tpl]) => {
              const path = pagePaths[label] || "/store";
              const isHome = label === "Home page";
              const sectionCount = isHome ? draft.length : tpl.length;
              return (
                <tr key={label}>
                  <td>
                    <strong>{label}</strong>
                  </td>
                  <td>
                    <code>{path}</code>
                  </td>
                  <td>
                    <StatusBadge
                      status={isHome && !homeSynced ? "Draft" : "Published"}
                    />
                  </td>
                  <td>{sectionCount} sections</td>
                  <td>
                    <div className="button-row">
                      <Link
                        className="btn btn-sm primary"
                        href={`/?page=${encodeURIComponent(label)}`}
                      >
                        Edit in Visual Editor
                      </Link>
                      <Link className="btn btn-sm" href={path} target="_blank">
                        View live <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } else if (view === "customers") {
    subtitle = "Directory of customers aggregated from storefront and demo orders.";
    const grouped = new Map<string, { name: string; email: string; orders: Order[] }>();
    for (const o of orders) {
      const existing = grouped.get(o.email);
      if (existing) existing.orders.push(o);
      else grouped.set(o.email, { name: o.customer, email: o.email, orders: [o] });
    }
    const customers = Array.from(grouped.values());

    content = (
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
              const spend = c.orders.reduce((s, o) => s + o.total, 0);
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
                      #{c.orders[0].id}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } else if (view === "collections") {
    subtitle = "Curate themed product assortments for editorial banners and storefront pages.";
    action = (
      <Button
        variant="primary"
        onClick={() =>
          setCollectionEdit({ id: "", name: "", description: "", products: [] })
        }
      >
        <Plus size={15} /> Create collection
      </Button>
    );
    content = (
      <div className="admin-table-panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Collection</th>
              <th>Description</th>
              <th>Products</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {collections.map((item) => (
              <tr key={item.id}>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setCollectionEdit(item)}
                  >
                    {item.name}
                  </button>
                </td>
                <td className="muted">{item.description || "—"}</td>
                <td>
                  <Badge tone="accent">{item.products.length} products</Badge>
                </td>
                <td>
                  <IconButton
                    label={`Delete ${item.name}`}
                    onClick={() => setDeleteCollection(item)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (view === "navigation") {
    subtitle = "Reorder, add, or remove links shown in the customer storefront header.";
    action = (
      <Button
        variant="primary"
        onClick={() => {
          setError("");
          setModalOpen(true);
        }}
      >
        <Plus size={15} /> Add link
      </Button>
    );
    content = menu.length ? (
      <div className="admin-table-panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Destination</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {menu.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.label}</strong>
                </td>
                <td>
                  <code>{item.url}</code>
                </td>
                <td>
                  <div className="button-row">
                    <IconButton
                      label="Move up"
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...menu];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        setMenu(next);
                      }}
                    >
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      disabled={index === menu.length - 1}
                      onClick={() => {
                        const next = [...menu];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        setMenu(next);
                      }}
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMenu(menu.filter((link) => link.id !== item.id));
                        notify("Link removed");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No navigation links"
        text="Add links to populate the storefront header menu."
      />
    );
  } else if (view === "users") {
    subtitle = "Manage team members and role-based access across the merchant admin.";
    action = (
      <Button
        variant="primary"
        onClick={() => {
          setError("");
          setModalOpen(true);
        }}
      >
        <Plus size={15} /> Invite member
      </Button>
    );
    content = (
      <div className="admin-table-panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <strong>{member.name}</strong>
                </td>
                <td>{member.email}</td>
                <td>
                  {member.role === "Owner" ? (
                    <Badge tone="accent">Owner</Badge>
                  ) : (
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      onChange={(e) => {
                        setMembers(
                          members.map((m) =>
                            m.id === member.id ? { ...m, role: e.target.value } : m
                          )
                        );
                        notify("Role updated");
                      }}
                    >
                      <option>Editor</option>
                      <option>Analyst</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    // Media Library
    subtitle = "Browse catalog imagery and upload custom assets for storefront sections.";
    action = (
      <label className="btn primary media-upload">
        <Upload size={15} /> Upload image
        <input
          type="file"
          accept="image/*"
          aria-label="Upload image"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2_000_000) {
              setError("Choose an image under 2 MB.");
              return;
            }
            setError("");
            const reader = new FileReader();
            reader.onload = () => {
              setMedia((curr) => [
                { id: newId(), name: file.name, url: String(reader.result) },
                ...curr,
              ]);
              notify("Image added to library");
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
    );
    const allMedia = [
      ...media.map((m) => ({ ...m, custom: true })),
      ...products.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.image,
        custom: false,
      })),
    ];
    content = (
      <>
        {error ? (
          <p className="danger" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </p>
        ) : null}
        <div className="admin-media">
          {allMedia.map((item) => (
            <div key={item.id} className="panel">
              <img src={item.url} alt={item.name} />
              <div>
                <strong
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </strong>
                <div className="button-row" style={{ gap: 2 }}>
                  <IconButton
                    label={`Copy URL for ${item.name}`}
                    onClick={() => {
                      navigator.clipboard?.writeText(item.url).catch(() => {});
                      notify("Image URL copied");
                    }}
                  >
                    <Copy size={13} />
                  </IconButton>
                  {item.custom ? (
                    <IconButton
                      label={`Delete ${item.name}`}
                      onClick={() => {
                        setMedia((curr) => curr.filter((m) => m.id !== item.id));
                        notify("Asset removed");
                      }}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
      {content}

      {collectionEdit ? (
        <Modal
          title={collectionEdit.id ? "Edit collection" : "New collection"}
          description="Select the products featured in this collection."
          close={() => setCollectionEdit(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setCollections(
                collectionEdit.id
                  ? collections.map((c) =>
                      c.id === collectionEdit.id ? collectionEdit : c
                    )
                  : [...collections, { ...collectionEdit, id: newId() }]
              );
              setCollectionEdit(null);
              notify("Collection saved");
            }}
          >
            <label>
              Collection name
              <input
                required
                value={collectionEdit.name}
                onChange={(e) =>
                  setCollectionEdit({ ...collectionEdit, name: e.target.value })
                }
              />
            </label>
            <label>
              Description
              <input
                value={collectionEdit.description || ""}
                onChange={(e) =>
                  setCollectionEdit({
                    ...collectionEdit,
                    description: e.target.value,
                  })
                }
              />
            </label>
            <div className="form-stack" style={{ maxHeight: "35dvh", overflow: "auto" }}>
              {products.map((p) => (
                <label className="check-label" key={p.id}>
                  <input
                    type="checkbox"
                    checked={collectionEdit.products.includes(p.id)}
                    onChange={(e) =>
                      setCollectionEdit({
                        ...collectionEdit,
                        products: e.target.checked
                          ? [...collectionEdit.products, p.id]
                          : collectionEdit.products.filter((pid) => pid !== p.id),
                      })
                    }
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <Button onClick={() => setCollectionEdit(null)}>Cancel</Button>
              <Button variant="primary" type="submit">
                Save collection
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteCollection ? (
        <ConfirmDialog
          title={`Delete collection "${deleteCollection.name}"?`}
          description="Products inside this collection will remain in your catalog."
          confirmLabel="Delete collection"
          destructive
          onCancel={() => setDeleteCollection(null)}
          onConfirm={() => {
            setCollections(collections.filter((c) => c.id !== deleteCollection.id));
            setDeleteCollection(null);
            notify("Collection deleted");
          }}
        />
      ) : null}

      {modalOpen ? (
        <Modal
          title={view === "users" ? "Invite workspace member" : "Add navigation link"}
          description={
            view === "users"
              ? "Assign a role for this collaborator."
              : "Use an internal storefront path (e.g. /store/shop) or an HTTPS URL."
          }
          close={() => setModalOpen(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name"));
              if (view === "users") {
                const email = String(fd.get("email"));
                if (
                  members.some(
                    (m) => m.email.toLowerCase() === email.toLowerCase()
                  )
                ) {
                  setError("This email is already on the workspace.");
                  return;
                }
                setMembers([
                  ...members,
                  { id: newId(), name, email, role: String(fd.get("role")) },
                ]);
              } else {
                const url = String(fd.get("url"));
                if (!/^\/(?!\/)|^https:\/\//i.test(url)) {
                  setError("Enter a valid internal path or HTTPS URL.");
                  return;
                }
                setMenu([...menu, { id: newId(), label: name, url }]);
              }
              setModalOpen(false);
              notify(view === "users" ? "Member invited" : "Navigation updated");
            }}
          >
            <label>
              {view === "users" ? "Full name" : "Link label"}
              <input name="name" required />
            </label>
            {view === "users" ? (
              <>
                <label>
                  Email address
                  <input type="email" name="email" required />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option>Editor</option>
                    <option>Analyst</option>
                  </select>
                </label>
              </>
            ) : (
              <label>
                Destination URL
                <input required name="url" placeholder="/store/shop" />
              </label>
            )}
            {error ? (
              <p className="danger" role="alert">
                {error}
              </p>
            ) : null}
            <div className="modal-actions">
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit">
                Save
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {customerDrawer ? (
        <Drawer
          title={customerDrawer.name}
          description={customerDrawer.email}
          close={() => setCustomerDrawer(null)}
        >
          <div className="form-stack">
            <strong>Order history ({customerDrawer.orders.length})</strong>
            {customerDrawer.orders.map((ord) => (
              <Link
                key={ord.id}
                href={`/admin/orders/${ord.id}`}
                className="panel"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <strong>#{ord.id}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {ord.date} · {ord.fulfillment}
                  </div>
                </div>
                <strong>{usdExact(ord.total)}</strong>
              </Link>
            ))}
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
