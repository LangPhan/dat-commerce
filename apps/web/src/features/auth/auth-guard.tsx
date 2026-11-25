"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { isAdminUser, useAuth } from "./auth-context";

export function AuthGuard({
  requiredPermission,
  requireAdmin = true,
  children,
}: {
  requiredPermission?: string;
  requireAdmin?: boolean;
  children: ReactNode;
}) {
  const { user, ready, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = isAdminUser(user);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const next =
        pathname && pathname !== "/login"
          ? `?next=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/login${next}`);
      return;
    }
    if (requireAdmin && !isAdmin && pathname?.startsWith("/admin")) {
      router.replace("/");
    }
  }, [ready, user, requireAdmin, isAdmin, pathname, router]);

  if (!ready || !user) {
    return (
      <div className="auth-loading-shell">
        <Skeleton rows={4} />
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="panel auth-denied-card">
        <ShieldAlert size={26} className="danger" />
        <h2>Merchant admin access required</h2>
        <p className="muted">
          You are signed in as a customer account ({user.email}), which does not
          have staff permissions for the Admin Dashboard.
        </p>
        <div className="button-row">
          <Link className="btn primary" href="/">
            Back to Storefront
          </Link>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="panel auth-denied-card">
        <ShieldAlert size={26} className="danger" />
        <h2>Access denied</h2>
        <p className="muted">
          Your role ({user.roles.join(", ") || "VIEWER"}) does not include the{" "}
          <code>{requiredPermission}</code> permission required for this view.
        </p>
        <div className="button-row">
          <Link className="btn primary" href="/admin">
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
