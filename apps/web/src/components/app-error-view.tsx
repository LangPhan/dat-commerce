"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { useEffect } from "react";

type AppErrorViewProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function AppErrorView({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred while rendering this view. You can try again or return to a safe page.",
  homeHref = "/",
  homeLabel = "Back to storefront",
  secondaryHref,
  secondaryLabel,
}: AppErrorViewProps) {
  useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "70dvh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div
        className="panel"
        role="alert"
        style={{
          width: "min(480px, 100%)",
          padding: 28,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-hidden="true"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "var(--red-soft)",
              color: "var(--red)",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} />
          </span>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 680, letterSpacing: "-0.02em" }}>
              {title}
            </h1>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {description}
            </p>
          </div>
        </div>

        {error.digest ? (
          <p className="muted" style={{ fontSize: 11.5 }}>
            Reference ID: <code>{error.digest}</code>
          </p>
        ) : null}

        <div className="button-row" style={{ flexWrap: "wrap" }}>
          <button type="button" className="btn primary" onClick={reset}>
            <RotateCcw size={14} />
            Try again
          </button>
          <Link className="btn" href={homeHref}>
            <Home size={14} />
            {homeLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link className="btn" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
