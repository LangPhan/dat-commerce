"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Box,
  ChevronRight,
  CircleHelp,
  Command,
  ExternalLink,
  FolderTree,
  History,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Search,
  Settings2,
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

export type NavItem = { title: string; path: string; icon: LucideIcon };
const nav = (title: string, path: string, icon: LucideIcon): NavItem => ({
  title,
  path,
  icon,
});

export const navigation: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [nav("Dashboard", "", LayoutDashboard)] },
  {
    title: "Catalog",
    items: [
      nav("Products", "products", Box),
      nav("Categories", "categories", FolderTree),
      nav("Collections", "collections", Layers),
      nav("Attributes", "attributes", Settings2),
      nav("Inventory", "inventory", Package),
    ],
  },
  {
    title: "Sales",
    items: [
      nav("Orders", "orders", ShoppingBag),
      nav("Customers", "customers", Users),
      nav("Discounts", "discounts", Tag),
      nav("Promotions", "promotions", Sparkles),
    ],
  },
  {
    title: "Store Design",
    items: [
      nav("Pages", "pages", PanelTop),
      nav("Theme Editor", "editor", Layers),
      nav("Navigation", "navigation", Menu),
      nav("Media Library", "media", ImageIcon),
    ],
  },
  {
    title: "AI Workspace",
    items: [
      nav("AI Assistant", "assistant", Sparkles),
      nav("AI Activity", "ai-activity", History),
      nav("Automation History", "automation", History),
    ],
  },
  {
    title: "Settings",
    items: [
      nav("General", "general", Settings2),
      nav("Store Information", "store-information", CircleHelp),
      nav("Payment", "payment", ShoppingBag),
      nav("Shipping", "shipping", Package),
      nav("Tax", "tax", Tag),
      nav("Integrations", "integrations", Layers),
      nav("Users & Permissions", "users", Users),
    ],
  },
];

export const adminLink = (path: string) =>
  path === "editor" ? "/" : path ? "/admin/" + path : "/admin";

export function AdminShell({
  view,
  id,
  subView,
  collapsed,
  setCollapsed,
  theme,
  setTheme,
  toast,
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
  children: ReactNode;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const allNavItems = navigation.flatMap((group) =>
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
    {
      id: "action-new-product",
      label: "Create new product",
      group: "Quick Actions",
      icon: <Box size={15} />,
      run: () => router.push("/admin/products/new"),
    },
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

  const crumbs = [
    { label: "Workspace", href: "/admin" },
    { label: activeItem?.title || "Overview", href: view ? adminLink(view) : undefined },
    ...(id ? [{ label: id === "new" ? "New product" : id, href: subView ? `/admin/${view}/${id}` : undefined }] : []),
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
            <strong>Terrain Supply</strong>
            <small>Forma Commerce</small>
          </div>
        </div>

        <nav>
          {navigation.map((group) => (
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

            <Link className="btn store-shortcut" href="/">
              <Sparkles size={14} /> Visual Editor
            </Link>

            <Link className="btn store-shortcut" href="/store" target="_blank">
              View store <ExternalLink size={13} />
            </Link>

            <Link
              href="/admin/users"
              className="avatar"
              aria-label="Workspace members"
              title="Alex Morgan (Owner)"
            >
              AM
            </Link>
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

      <Toast message={toast} />
    </div>
  );
}
