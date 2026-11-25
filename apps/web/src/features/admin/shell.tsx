"use client";
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
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { CommandPalette, type CommandItem } from "@/components/ui/command-palette";
import { Breadcrumbs } from "@/components/ui/data-display";
import { Toast } from "@/components/ui/toast";
import { FloatingAdminAssistant } from "@/features/assistant/FloatingAdminAssistant";
import { useAuth } from "@/features/auth/auth-context";

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
      nav("Navigation", "navigation", Menu, "content:read"),
      nav("Media Library", "media", ImageIcon, "content:read"),
    ],
  },
  {
    title: "AI Workspace",
    items: [
      nav("AI Assistant", "assistant", Sparkles, "ai:use"),
      nav("AI Settings", "ai-settings", SlidersHorizontal, "ai:use"),
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
  path === "editor" ? "/" : path ? "/admin/" + path : "/admin";

function initialsFor(name?: string) {
  if (!name) return "DC";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function AdminShell({
  view,
  id,
  subView,
  collapsed,
  setCollapsed,
  theme,
  setTheme,
  toast,
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
  toast: string;
  notify?: (msg: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, logout, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const allNavItems = visibleNavigation.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.title }))
  );
  const activeItem = allNavItems.find((item) => item.path === view);

  const commands: CommandItem[] = [
    ...allNavItems.map(({ title, path, group, icon: Icon }) => ({
      id: "nav-" + (path || "dashboard"),
      label: title,
      group,
      icon: <Icon size={15} />,
      run: () => router.push(adminLink(path)),
    })),
    ...(hasPermission("catalog:write")
      ? [
          {
            id: "action-new-product",
            label: "Create new product",
            group: "Quick Actions",
            icon: <Box size={15} />,
            run: () => router.push("/admin/products/new"),
          },
        ]
      : []),
    {
      id: "action-view-store",
      label: "Open Customer Storefront",
      group: "Quick Actions",
      icon: <ExternalLink size={15} />,
      run: () => router.push("/store"),
    },
    {
      id: "action-toggle-theme",
      label: theme === "light" ? "Switch to dark theme" : "Switch to light theme",
      group: "Preferences",
      icon: theme === "light" ? <Moon size={15} /> : <Sun size={15} />,
      run: () => setTheme(theme === "light" ? "dark" : "light"),
    },
  ];

  const isUuid = (val: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const crumbs = [
    { label: "Workspace", href: "/admin" },
    { label: activeItem?.title || "Overview", href: view ? adminLink(view) : undefined },
    ...(id
      ? [
          {
            label:
              id === "new"
                ? "New product"
                : isUuid(id)
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
              <Link className="btn store-shortcut" href="/">
                <Sparkles size={14} /> Visual Editor
              </Link>
            ) : null}

            <Link className="btn store-shortcut" href="/store" target="_blank">
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

        <main className="admin-content">{children}</main>
      </div>

      {commandOpen ? (
        <CommandPalette
          title="Search workspace"
          description="Jump to any admin view, storefront, or quick action."
          commands={commands}
          close={() => setCommandOpen(false)}
        />
      ) : null}

      <FloatingAdminAssistant
        view={view}
        pageTitle={activeItem?.title || "Dashboard"}
        notify={notify}
      />

      <Toast message={toast} />
    </div>
  );
}
