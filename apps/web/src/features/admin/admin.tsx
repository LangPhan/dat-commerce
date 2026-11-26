"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/data-display";
import { AuthGuard } from "@/features/auth/auth-guard";
import { parseAdminRoute, useAdminNotify } from "./admin-context";
import { navigation } from "./shell";

const loadingFallback = () => <Skeleton rows={5} />;

const Dashboard = dynamic(
  () => import("./dashboard").then((m) => m.Dashboard),
  { loading: loadingFallback }
);
const Catalog = dynamic(
  () => import("./products").then((m) => m.Catalog),
  { loading: loadingFallback }
);
const CategoryManager = dynamic(
  () => import("./categories").then((m) => m.CategoryManager),
  { loading: loadingFallback }
);
const ProductTypesManager = dynamic(
  () => import("./product-types").then((m) => m.ProductTypesManager),
  { loading: loadingFallback }
);
const Attributes = dynamic(
  () => import("./attributes").then((m) => m.Attributes),
  { loading: loadingFallback }
);
const Orders = dynamic(
  () => import("./orders").then((m) => m.Orders),
  { loading: loadingFallback }
);
const Promotions = dynamic(
  () => import("./promotions").then((m) => m.Promotions),
  { loading: loadingFallback }
);
const Editor = dynamic(
  () => import("@/features/editor/editor").then((m) => m.Editor),
  { ssr: false, loading: loadingFallback }
);
const ThemeSettingsView = dynamic(
  () => import("./theme-settings").then((m) => m.ThemeSettingsView),
  { ssr: false, loading: loadingFallback }
);
const Workspace = dynamic(
  () => import("@/features/assistant/workspace").then((m) => m.Workspace),
  { ssr: false, loading: loadingFallback }
);
const AiSettingsView = dynamic(
  () => import("./ai-settings").then((m) => m.AiSettingsView),
  { loading: loadingFallback }
);
const ActivityTable = dynamic(
  () => import("@/features/assistant/activity").then((m) => m.ActivityTable),
  { loading: loadingFallback }
);
const AuditLogsView = dynamic(
  () => import("./audit-logs").then((m) => m.AuditLogsView),
  { loading: loadingFallback }
);
const UsersManagement = dynamic(
  () => import("./users-management").then((m) => m.UsersManagement),
  { loading: loadingFallback }
);
const StoreSettingsView = dynamic(
  () => import("./store-settings").then((m) => m.StoreSettingsView),
  { loading: loadingFallback }
);
const UtilityPage = dynamic(
  () => import("./utility").then((m) => m.UtilityPage),
  { loading: loadingFallback }
);

const NAV_ITEM_BY_PATH = new Map(
  navigation.flatMap((group) => group.items.map((item) => [item.path, item] as const))
);

export function Admin() {
  const pathname = usePathname();
  const route = parseAdminRoute(pathname);
  const [view = "", id] = route;
  const setToast = useAdminNotify();

  const activeItem = NAV_ITEM_BY_PATH.get(view);

  if (view === "") {
    return (
      <AuthGuard requiredPermission="dashboard:read">
        <Dashboard notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "products") {
    return (
      <AuthGuard requiredPermission="catalog:read">
        <Catalog key={route.join("/")} route={route} notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "inventory") {
    return (
      <AuthGuard requiredPermission="inventory:read">
        <Catalog key={route.join("/")} route={route} notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "categories") {
    return (
      <AuthGuard requiredPermission="catalog:read">
        <CategoryManager notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "product-types") {
    return (
      <AuthGuard requiredPermission="catalog:read">
        <ProductTypesManager notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "attributes") {
    return (
      <AuthGuard requiredPermission="catalog:read">
        <Attributes notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "collections") {
    return (
      <AuthGuard requiredPermission="catalog:read">
        <UtilityPage key={view} view={view} title="Collections" notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "orders") {
    return (
      <AuthGuard requiredPermission="order:read">
        <Orders key={id || "orders"} id={id} notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "customers") {
    return (
      <AuthGuard requiredPermission="order:read">
        <UtilityPage key={view} view={view} title="Customers" notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "discounts" || view === "promotions") {
    return (
      <AuthGuard requiredPermission="promotion:read">
        <Promotions notify={setToast} isCampaignView={view === "promotions"} />
      </AuthGuard>
    );
  }
  if (view === "media" || view === "pages" || view === "navigation") {
    return (
      <AuthGuard requiredPermission="content:read">
        <UtilityPage
          key={view}
          view={view}
          title={activeItem?.title || "Store Design"}
          notify={setToast}
        />
      </AuthGuard>
    );
  }
  if (view === "editor") {
    return (
      <AuthGuard requiredPermission="content:read">
        <Editor />
      </AuthGuard>
    );
  }
  if (view === "theme") {
    return (
      <AuthGuard requiredPermission="content:read">
        <ThemeSettingsView notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "assistant") {
    return (
      <AuthGuard requiredPermission="ai:use">
        <Workspace notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "ai-settings") {
    return (
      <AuthGuard requiredPermission="ai:use">
        <AiSettingsView notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "ai-activity" || view === "automation") {
    return (
      <AuthGuard requiredPermission="ai:use">
        <ActivityTable automation={view === "automation"} notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "audit-logs") {
    return (
      <AuthGuard requiredPermission="audit:read">
        <AuditLogsView />
      </AuthGuard>
    );
  }
  if (view === "users") {
    return (
      <AuthGuard requiredPermission="users:read">
        <UsersManagement notify={setToast} />
      </AuthGuard>
    );
  }
  if (view === "general" || view === "store-information") {
    return (
      <AuthGuard requiredPermission="store:read">
        <StoreSettingsView mode={view} notify={setToast} />
      </AuthGuard>
    );
  }
  if (activeItem) {
    return (
      <UtilityPage
        key={view}
        view={view}
        title={activeItem.title}
        notify={setToast}
      />
    );
  }
  return (
    <div className="admin-title">
      <div>
        <h1>Page not found</h1>
        <p>The requested merchant workspace route could not be found.</p>
      </div>
      <Link className="btn primary" href="/admin">
        Back to overview
      </Link>
    </div>
  );
}
