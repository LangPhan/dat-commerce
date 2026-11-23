"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/data-display";
import { useAuth } from "./auth-context";

export function AuthGuard({
  requiredPermission,
  children,
}: {
  requiredPermission?: string;
  children: ReactNode;
}) {
  const { user, ready, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) {
      const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [ready, user, pathname, router]);

  if (!ready || !user) {
    return (
      <div className="auth-loading-shell">
        <Skeleton rows={4} />
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
