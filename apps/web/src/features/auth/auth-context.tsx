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
  loginDemoOwner: () => Promise<AuthUser>;
  register: (fullName: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Module-level bootstrap promise prevents React 19 Strict Mode double-mount
// from losing the resolution callback while ensuring session init runs once.
let initialSessionPromise: Promise<AuthTokenResponse | null> | null = null;

function getInitialSession(): Promise<AuthTokenResponse | null> {
  if (!initialSessionPromise) {
    initialSessionPromise = refreshSessionToken().catch(() => null);
  }
  return initialSessionPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOnUnauthorized(() => {
      setAccessToken(null);
      setUser(null);
      initialSessionPromise = null;
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getInitialSession()
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

  const loginDemoOwner = useCallback(async () => {
    const res = await apiFetch<AuthTokenResponse>("/api/v1/auth/demo-owner", {
      method: "POST",
      skipAuthRefresh: true,
    });
    setAccessToken(res.accessToken);
    initialSessionPromise = Promise.resolve(res);
    setUser(res.user);
    setReady(true);
    return res.user;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthTokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuthRefresh: true,
    });
    setAccessToken(res.accessToken);
    initialSessionPromise = Promise.resolve(res);
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
      initialSessionPromise = Promise.resolve(res);
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
      initialSessionPromise = null;
      setUser(null);
    }
  }, []);

  const permissionSet = useMemo(
    () => new Set(user?.permissions ?? []),
    [user]
  );

  const roleSet = useMemo(() => new Set(user?.roles ?? []), [user]);

  const hasPermission = useCallback(
    (permission: string) => permissionSet.has(permission),
    [permissionSet]
  );

  const hasRole = useCallback(
    (role: string) => roleSet.has(role),
    [roleSet]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      isAdmin: isAdminUser(user),
      login,
      loginDemoOwner,
      register,
      logout,
      hasPermission,
      hasRole,
    }),
    [user, ready, login, loginDemoOwner, register, logout, hasPermission, hasRole]
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
