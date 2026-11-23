"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { ActivityTable } from "@/features/assistant/activity";
import { Workspace } from "@/features/assistant/workspace";
import { AuthGuard } from "@/features/auth/auth-guard";
import { useStored } from "@/lib/storage";
import {
  initialAttributes,
  initialCategories,
  initialProducts,
} from "@/mocks/catalog";
import {
  initialActivity,
  initialDiscounts,
  initialOrders,
} from "@/mocks/operations";
import { initialBlocks } from "@/mocks/pages";
import type { AIActivityEntry, Snapshot } from "@/types/ai";
import type {
  Attribute,
  Category,
  Discount,
  Order,
  Product,
} from "@/types/commerce";
import type { Block } from "@/types/editor";
import { Attributes } from "./attributes";
import { AuditLogsView } from "./audit-logs";
import { CategoryManager } from "./categories";
import { Dashboard } from "./dashboard";
import { Orders } from "./orders";
import { Catalog } from "./products";
import { Promotions } from "./promotions";
import { AdminShell, navigation } from "./shell";
import { StoreSettingsView } from "./store-settings";
import { UsersManagement } from "./users-management";
import { UtilityPage } from "./utility";

function AdminWorkspace({ route }: { route: string[] }) {
  const [view = "", id, subView] = route;
  const [catalog, setCatalog, ready] = useStored<Product[]>(
    "catalog",
    initialProducts
  );
  const [categories, setCategories] = useStored<Category[]>(
    "categories",
    initialCategories
  );
  const [attributeList, setAttributes] = useStored<Attribute[]>(
    "attributes",
    initialAttributes
  );
  const [discountList, setDiscounts] = useStored<Discount[]>(
    "discounts",
    initialDiscounts
  );
  const [orderList, setOrders] = useStored<Order[]>("orders", initialOrders);
  const [draftBlocks, setDraftBlocks] = useStored<Block[]>(
    "draft",
    initialBlocks
  );
  const [activity, setActivity] = useStored<AIActivityEntry[]>(
    "ai-activity",
    initialActivity
  );
  const [theme, setTheme] = useStored("theme", "light");
  const [collapsed, setCollapsed] = useStored("admin-collapsed", false);
  const [toast, setToast] = useState("");

  const allItems = navigation.flatMap((group) => group.items);
  const activeItem = allItems.find((item) => item.path === view);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  function commitSnapshot(next: Partial<Snapshot>) {
    if (next.catalog) setCatalog(next.catalog);
    if (next.categories) setCategories(next.categories);
    if (next.discounts) setDiscounts(next.discounts);
    if (next.attributes) setAttributes(next.attributes);
    if (next.draftBlocks) setDraftBlocks(next.draftBlocks);
    setToast("AI operation applied");
  }

  let content: React.ReactNode;
  if (!ready) {
    content = <Skeleton rows={4} />;
  } else if (view === "") {
    content = (
      <Dashboard
        products={catalog}
        orders={orderList}
        restock={(productId, addUnits) => {
          setCatalog((curr) =>
            curr.map((p) =>
              p.id === productId ? { ...p, stock: p.stock + addUnits } : p
            )
          );
          setToast(`Added ${addUnits} units to inventory`);
        }}
      />
    );
  } else if (view === "products" || view === "inventory") {
    content = (
      <Catalog
        key={route.join("/")}
        products={catalog}
        save={setCatalog}
        categories={categories}
        attributes={attributeList}
        notify={setToast}
        route={route}
      />
    );
  } else if (view === "categories") {
    content = (
      <CategoryManager
        categories={categories}
        save={setCategories}
        products={catalog}
        updateProducts={setCatalog}
        attributes={attributeList}
        notify={setToast}
      />
    );
  } else if (view === "product-types") {
    content = (
      <>
        <div className="admin-title">
          <div>
            <h1>Product Types</h1>
            <p>Define domain schemas and attribute sets per product family.</p>
          </div>
        </div>
        <Empty
          title="Product Type API integration scheduled for Phase 2"
          text="Database schema and ERD for product_types, attribute_definitions, and variant_option_definitions are documented in docs/architecture/erd.md."
        />
      </>
    );
  } else if (view === "attributes") {
    content = (
      <Attributes
        items={attributeList}
        save={setAttributes}
        categories={categories}
        notify={setToast}
      />
    );
  } else if (view === "orders") {
    content = (
      <Orders
        key={id || "orders"}
        id={id}
        items={orderList}
        save={setOrders}
        notify={setToast}
      />
    );
  } else if (view === "discounts" || view === "promotions") {
    content = (
      <Promotions
        items={discountList}
        save={setDiscounts}
        categories={categories}
        products={catalog}
        notify={setToast}
        isCampaignView={view === "promotions"}
      />
    );
  } else if (view === "theme") {
    content = (
      <>
        <div className="admin-title">
          <div>
            <h1>Theme Tokens</h1>
            <p>Manage allowlisted colors, typography, radius, and container tokens.</p>
          </div>
        </div>
        <Empty
          title="Theme Token Editor scheduled for Phase 4"
          text="Allowlisted Theme Tokens v1 contract is specified in docs/architecture/block-schema-v1.md."
        />
      </>
    );
  } else if (view === "assistant") {
    content = (
      <AuthGuard requiredPermission="ai:use">
        <Workspace
          snapshot={{
            catalog,
            categories,
            discounts: discountList,
            attributes: attributeList,
            draftBlocks,
          }}
          commit={commitSnapshot}
          log={(entry) => setActivity((curr) => [entry, ...curr])}
        />
      </AuthGuard>
    );
  } else if (view === "ai-activity" || view === "automation") {
    content = (
      <AuthGuard requiredPermission="ai:use">
        <ActivityTable rows={activity} automation={view === "automation"} />
      </AuthGuard>
    );
  } else if (view === "audit-logs") {
    content = (
      <AuthGuard requiredPermission="audit:read">
        <AuditLogsView />
      </AuthGuard>
    );
  } else if (view === "users") {
    content = (
      <AuthGuard requiredPermission="users:read">
        <UsersManagement notify={setToast} />
      </AuthGuard>
    );
  } else if (view === "general" || view === "store-information") {
    content = (
      <AuthGuard requiredPermission="store:read">
        <StoreSettingsView mode={view} notify={setToast} />
      </AuthGuard>
    );
  } else if (activeItem) {
    content = (
      <UtilityPage
        key={view}
        view={view}
        title={activeItem.title}
        products={catalog}
        orders={orderList}
        notify={setToast}
      />
    );
  } else {
    content = (
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

  return (
    <AdminShell
      view={view}
      id={id}
      subView={subView}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      theme={theme}
      setTheme={setTheme}
      toast={toast}
    >
      {content}
    </AdminShell>
  );
}

export function Admin({ route }: { route: string[] }) {
  return (
    <AuthGuard>
      <AdminWorkspace route={route} />
    </AuthGuard>
  );
}
