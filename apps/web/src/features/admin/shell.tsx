"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Box,
  CircleHelp,
  ExternalLink,
  FolderTree,
  History,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Search,
  Settings2,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingBag,
  Sparkles,
  Sun,
  Tag,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/button";
import type { CommandItem } from "@/components/ui/command-palette";
import { Breadcrumbs } from "@/components/ui/data-display";
import { useAuth } from "@/features/auth/auth-context";

const CommandPalette = dynamic(
  () => import("@/components/ui/command-palette").then((m) => m.CommandPalette),
  { ssr: false }
);

const FloatingAdminAssistant = dynamic(
  () =>
    import("@/features/assistant/FloatingAdminAssistant").then(
      (m) => m.FloatingAdminAssistant
    ),
  { ssr: false }
);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
};

const nav = (
  title: string,
  path: string,
  icon: LucideIcon,
  permission?: string
): NavItem => ({
  title,
  path,
  icon,
  permission,
});

export const navigation: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [nav("Dashboard", "", LayoutDashboard, "dashboard:read")] },
  {
    title: "Catalog",
    items: [
      nav("Products", "products", Box, "catalog:read"),
      nav("Categories", "categories", FolderTree, "catalog:read"),
      nav("Collections", "collections", Layers, "catalog:read"),
      nav("Product Types", "product-types", Shapes, "catalog:read"),
      nav("Attributes", "attributes", Settings2, "catalog:read"),
      nav("Inventory", "inventory", Package, "inventory:read"),
    ],
  },
  {
    title: "Sales",
    items: [
      nav("Orders", "orders", ShoppingBag, "order:read"),
      nav("Customers", "customers", Users, "order:read"),
      nav("Discounts", "discounts", Tag, "promotion:read"),
      nav("Promotions", "promotions", Sparkles, "promotion:read"),
    ],
  },
  {
    title: "Store Design",
    items: [
      nav("Pages", "pages", PanelTop, "content:read"),
      nav("Theme", "theme", Palette, "content:read"),
      nav("Theme Editor", "editor", Layers, "content:read"),
      nav("Seasonal Experiences", "experiences", Wand2, "content:read"),
      nav("Navigation", "navigation", Menu, "content:read"),
      nav("Media Library", "media", ImageIcon, "content:read"),
    ],
  },
  {
    title: "AI Workspace",
    items: [
      nav("AI Assistant", "assistant", Sparkles, "ai:use"),
      nav("AI Settings", "ai-settings", SlidersHorizontal, "ai:settings:write"),
      nav("AI Activity", "ai-activity", History, "ai:use"),
      nav("Automation History", "automation", History, "ai:use"),
      nav("Audit Logs", "audit-logs", ShieldCheck, "audit:read"),
    ],
  },
  {
    title: "Settings",
    items: [
      nav("General", "general", Settings2, "store:read"),
      nav("Store Information", "store-information", CircleHelp, "store:read"),
      nav("Payment", "payment", ShoppingBag, "store:read"),
      nav("Shipping", "shipping", Package, "store:read"),
      nav("Tax", "tax", Tag, "store:read"),
      nav("Integrations", "integrations", Layers, "store:read"),
      nav("Users & Permissions", "users", Users, "users:read"),
    ],
  },
];

export const adminLink = (path: string) =>
  path ? "/admin/" + path : "/admin";

function initialsFor(name?: string) {
  if (!name) return "DC";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function AdminCommandPaletteModal({
  visibleNavigation,
  canWriteCatalog,
  theme,
  setTheme,
  onNavigate,
  close,
}: {
  visibleNavigation: { title: string; items: NavItem[] }[];
  canWriteCatalog: boolean;
  theme: string;
  setTheme: (next: string) => void;
  onNavigate: (href: string) => void;
  close: () => void;
}) {
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    for (const group of visibleNavigation) {
      for (const { title, path, icon: Icon } of group.items) {
        items.push({
          id: "nav-" + (path || "dashboard"),
          label: title,
          group: group.title,
          icon: <Icon size={15} />,
          run: () => onNavigate(adminLink(path)),
        });
      }
    }
    if (canWriteCatalog) {
      items.push({
        id: "action-new-product",
        label: "Create new product",
        group: "Quick Actions",
        icon: <Box size={15} />,
        run: () => onNavigate("/admin/products/new"),
      });
    }
    items.push(
      {
        id: "action-view-store",
        label: "Open Customer Storefront",
        group: "Quick Actions",
        icon: <ExternalLink size={15} />,
        run: () => onNavigate("/"),
      },
      {
        id: "action-toggle-theme",
        label: theme === "light" ? "Switch to dark theme" : "Switch to light theme",
        group: "Preferences",
        icon: theme === "light" ? <Moon size={15} /> : <Sun size={15} />,
        run: () => setTheme(theme === "light" ? "dark" : "light"),
      }
    );
    return items;
  }, [visibleNavigation, canWriteCatalog, theme, setTheme, onNavigate]);

  return (
    <CommandPalette
      title="Search workspace"
      description="Jump to any admin view, storefront, or quick action."
      commands={commands}
      close={close}
    />
  );
}

export function AdminShell({
  view,
  id,
  subView,
  collapsed,
  setCollapsed,
  theme,
  setTheme,
  notify,
  children,
}: {
  view: string;
  id?: string;
  subView?: string;
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  theme: string;
  setTheme: (next: string) => void;
  notify?: (msg: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, logout, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const { visibleNavigation, activeItem } = useMemo(() => {
    const groups: { title: string; items: NavItem[] }[] = [];
    let matched: NavItem | undefined;
    for (const group of navigation) {
      const items = group.items.filter(
        (item) => !item.permission || hasPermission(item.permission)
      );
      if (items.length > 0) {
        groups.push({ title: group.title, items });
        if (!matched) {
          matched = items.find((item) => item.path === view);
        }
      }
    }
    return { visibleNavigation: groups, activeItem: matched };
  }, [hasPermission, view]);

  const crumbs = [
    { label: "Workspace", href: "/admin" },
    { label: activeItem?.title || "Overview", href: view ? adminLink(view) : undefined },
    ...(id
      ? [
          {
            label:
              id === "new"
                ? "New product"
                : UUID_REGEX.test(id)
                  ? view === "products"
                    ? "Product details"
                    : view === "orders"
                      ? "Order details"
                      : "Details"
                  : id,
            href: subView ? `/admin/${view}/${id}` : undefined,
          },
        ]
      : []),
    ...(subView ? [{ label: subView === "edit" ? "Edit" : subView }] : []),
  ];

  const showFloatingAssistant =
    hasPermission("ai:use") && view !== "assistant" && view !== "editor";

  return (
    <div
      className={
        "admin-app " +
        (collapsed ? "rail-only " : "") +
        (mobileOpen ? "nav-open" : "")
      }
    >
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className="admin-sidebar" aria-label="Merchant navigation">
        <div className="admin-brand">
          <Link href="/admin" className="forma-mark" style={{ marginLeft: 0 }}>
            <Box size={19} />
          </Link>
          <div>
            <strong>{user?.storeName || "Terrain Supply"}</strong>
            <small>Dat Commerce</small>
          </div>
        </div>

        <nav>
          {visibleNavigation.map((group) => (
            <div className="admin-nav-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map(({ title, path, icon: Icon }) => (
                <Link
                  key={path}
                  href={adminLink(path)}
                  title={title}
                  aria-current={view === path ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={16} />
                  <span>{title}</span>
                  {path === "editor" ? <ArrowUpRight size={13} /> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </IconButton>
          <span>Collapse sidebar</span>
        </div>
      </aside>

      <div className="admin-body">
        <header className="admin-top">
          <div className="button-row" style={{ gap: 10 }}>
            <IconButton
              className="admin-mobile-toggle"
              label="Open navigation"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <Menu size={19} />
            </IconButton>
            <Breadcrumbs items={crumbs} />
          </div>

          <div className="button-row">
            <Button
              className="admin-command"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={14} />
              <span>Search workspace</span>
              <kbd>Ctrl K</kbd>
            </Button>

            <IconButton
              label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </IconButton>

            {hasPermission("content:read") ? (
              <Link className="btn store-shortcut" href="/admin/editor">
                <Sparkles size={14} /> Visual Editor
              </Link>
            ) : null}

            <Link className="btn store-shortcut" href="/" target="_blank">
              View store <ExternalLink size={13} />
            </Link>

            <div className="user-chip">
              <span
                className="avatar"
                title={user ? `${user.fullName} (${user.roles.join(", ")})` : "Account"}
              >
                {initialsFor(user?.fullName)}
              </span>
              <div className="user-chip-meta">
                <strong>{user?.fullName || "Admin"}</strong>
                <small>{user?.roles[0] || "MEMBER"}</small>
              </div>
            </div>

            <IconButton
              label="Sign out"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut size={16} />
            </IconButton>
          </div>
        </header>

        {user?.demo ? (
          <div
            role="status"
            style={{
              background: "#fffbeb",
              borderBottom: "1px solid #fde68a",
              color: "#92400e",
              padding: "8px 18px",
              fontSize: "12.5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <span>
              <strong>Admin Demo Sandbox</strong> — Isolated workspace (main store untouched). Design publishing &amp; AI settings are disabled, and demo data auto-deletes after 2 hours
              {user.demoExpiresAt ? ` (expires ${new Date(user.demoExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : ""}.
            </span>
          </div>
        ) : null}
        <main className="admin-content">{children}</main>
      </div>

      {commandOpen ? (
        <AdminCommandPaletteModal
          visibleNavigation={visibleNavigation}
          canWriteCatalog={hasPermission("catalog:write")}
          theme={theme}
          setTheme={setTheme}
          onNavigate={(href) => router.push(href)}
          close={() => setCommandOpen(false)}
        />
      ) : null}

      {showFloatingAssistant ? (
        <FloatingAdminAssistant
          view={view}
          pageTitle={activeItem?.title || "Dashboard"}
          notify={notify}
        />
      ) : null}
    </div>
  );
}
