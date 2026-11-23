"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  apiFetch,
  refreshSessionToken,
  setAccessToken,
  setOnUnauthorized,
} from "@/lib/api-client";
import type { AuthTokenResponse, AuthUser } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStoreRoute = pathname === "/store" || pathname?.startsWith("/store/");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setOnUnauthorized(() => {
      setAccessToken(null);
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    if (isStoreRoute) {
      return;
    }

    let cancelled = false;
    refreshSessionToken().then((refreshed) => {
      if (!cancelled) {
        setUser(refreshed?.user ?? null);
        setChecked(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isStoreRoute]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthTokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuthRefresh: true,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setChecked(true);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/v1/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string) => Boolean(user?.permissions.includes(permission)),
    [user]
  );

  const hasRole = useCallback(
    (role: string) => Boolean(user?.roles.includes(role)),
    [user]
  );

  const ready = isStoreRoute || checked;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      logout,
      hasPermission,
      hasRole,
    }),
    [user, ready, login, logout, hasPermission, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
