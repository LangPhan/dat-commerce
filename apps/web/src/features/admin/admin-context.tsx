"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AuthGuard } from "@/features/auth/auth-guard";
import { useAppTheme, useStoredBoolean } from "@/lib/theme";
import { AdminShell } from "./shell";

const AdminToastContext = createContext<((msg: string) => void) | null>(null);

export function parseAdminRoute(pathname: string | null): string[] {
  if (!pathname) return [];
  const trimmed = pathname.replace(/^\/admin\/?/, "");
  return trimmed ? trimmed.split("/").filter(Boolean) : [];
}

export function useAdminNotify(): (msg: string) => void {
  const ctx = useContext(AdminToastContext);
  if (!ctx) {
    throw new Error("useAdminNotify must be used inside AdminLayoutShell");
  }
  return ctx;
}

export function AdminLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = parseAdminRoute(pathname);
  const [view = "", id, subView] = route;
  const [theme, setTheme] = useAppTheme();
  const [collapsed, setCollapsed] = useStoredBoolean("admin-collapsed", false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <AuthGuard>
      <AdminToastContext.Provider value={setToast}>
        <AdminShell
          view={view}
          id={id}
          subView={subView}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          theme={theme}
          setTheme={(next) => setTheme(next === "dark" ? "dark" : "light")}
          toast={toast}
        >
          {children}
        </AdminShell>
      </AdminToastContext.Provider>
    </AuthGuard>
  );
}
