"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivityTable } from "@/features/assistant/activity";
import { Workspace } from "@/features/assistant/workspace";
import { AuthGuard } from "@/features/auth/auth-guard";
import { parseAdminRoute, useAdminNotify } from "./admin-context";
import { AiSettingsView } from "./ai-settings";
import { Attributes } from "./attributes";
import { AuditLogsView } from "./audit-logs";
import { CategoryManager } from "./categories";
import { Editor } from "@/features/editor/editor";
import { Dashboard } from "./dashboard";
import { Orders } from "./orders";
import { ProductTypesManager } from "./product-types";
import { Catalog } from "./products";
import { Promotions } from "./promotions";
import { navigation } from "./shell";
import { StoreSettingsView } from "./store-settings";
import { ThemeSettingsView } from "./theme-settings";
import { UsersManagement } from "./users-management";
import { UtilityPage } from "./utility";

export function Admin() {
  const pathname = usePathname();
  const route = parseAdminRoute(pathname);
  const [view = "", id] = route;
  const setToast = useAdminNotify();

  const allItems = navigation.flatMap((group) => group.items);
  const activeItem = allItems.find((item) => item.path === view);

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
