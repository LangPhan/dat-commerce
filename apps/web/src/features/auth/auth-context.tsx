"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  refreshSessionToken,
  setAccessToken,
  setOnUnauthorized,
} from "@/lib/api-client";
import type { AuthTokenResponse, AuthUser } from "@/types/auth";

export function isAdminUser(user?: AuthUser | null): boolean {
  return Boolean(user && user.roles && user.roles.length > 0);
}

export function resolvePostAuthRedirect(
  user: AuthUser,
  rawNext?: string | null
): string {
  const isAdmin = isAdminUser(user);
  const safeNext =
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/login")
      ? rawNext
      : null;

  if (safeNext) {
    if (isAdmin) {
      return safeNext;
    }
    return safeNext.startsWith("/admin") ? "/" : safeNext;
  }
  return isAdmin ? "/admin" : "/";
}

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    setOnUnauthorized(() => {
      setAccessToken(null);
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    let cancelled = false;
    refreshSessionToken()
      .then((refreshed) => {
        if (!cancelled) {
          setUser(refreshed?.user ?? null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthTokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuthRefresh: true,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setReady(true);
    return res.user;
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const res = await apiFetch<AuthTokenResponse>("/api/v1/auth/register", {
        method: "POST",
        body: { fullName, email, password },
        skipAuthRefresh: true,
      });
      setAccessToken(res.accessToken);
      setUser(res.user);
      setReady(true);
      return res.user;
    },
    []
  );

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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      isAdmin: isAdminUser(user),
      login,
      register,
      logout,
      hasPermission,
      hasRole,
    }),
    [user, ready, login, register, logout, hasPermission, hasRole]
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

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
