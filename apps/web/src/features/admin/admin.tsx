"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { ActivityTable } from "@/features/assistant/activity";
import { Workspace } from "@/features/assistant/workspace";
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
import { CategoryManager } from "./categories";
import { Dashboard } from "./dashboard";
import { Orders } from "./orders";
import { Catalog } from "./products";
import { Promotions } from "./promotions";
import { AdminShell, navigation } from "./shell";
import { UtilityPage } from "./utility";

export function Admin({ route }: { route: string[] }) {
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
  } else if (view === "assistant") {
    content = (
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
    );
  } else if (view === "ai-activity" || view === "automation") {
    content = (
      <ActivityTable rows={activity} automation={view === "automation"} />
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
