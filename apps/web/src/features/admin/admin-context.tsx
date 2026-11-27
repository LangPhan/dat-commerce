"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Toast } from "@/components/ui/toast";
import { AuthGuard } from "@/features/auth/auth-guard";
import { useAppTheme, useStoredBoolean } from "@/lib/theme";
import { AdminShell } from "./shell";

const AdminToastContext = createContext<((msg: string) => void) | null>(null);

// Isolated toast pub/sub so showing/dismissing toasts never re-renders AdminLayoutShell or AdminShell.
let currentToast = "";
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const toastListeners = new Set<() => void>();

function emitToast(next: string) {
  currentToast = next;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (next) {
    toastTimer = setTimeout(() => {
      currentToast = "";
      toastTimer = null;
      for (const listener of toastListeners) listener();
    }, 2800);
  }
  for (const listener of toastListeners) listener();
}

function subscribeToast(listener: () => void) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

function getToastSnapshot() {
  return currentToast;
}

function getToastServerSnapshot() {
  return "";
}

function AdminToastHost() {
  const message = useSyncExternalStore(
    subscribeToast,
    getToastSnapshot,
    getToastServerSnapshot
  );

  useEffect(() => {
    return () => {
      if (toastTimer && toastListeners.size === 0) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
    };
  }, []);

  return <Toast message={message} />;
}

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

  const handleSetTheme = useCallback(
    (next: string) => setTheme(next === "dark" ? "dark" : "light"),
    [setTheme]
  );

  if (view === "editor" || (view === "experiences" && Boolean(id))) {
    return (
      <AuthGuard requiredPermission="content:read" requireAdmin>
        <AdminToastContext.Provider value={emitToast}>
          {children}
          <AdminToastHost />
        </AdminToastContext.Provider>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAdmin>
      <AdminToastContext.Provider value={emitToast}>
        <AdminShell
          view={view}
          id={id}
          subView={subView}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          theme={theme}
          setTheme={handleSetTheme}
          notify={emitToast}
        >
          {children}
        </AdminShell>
        <AdminToastHost />
      </AdminToastContext.Provider>
    </AuthGuard>
  );
}
