import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Home, ShoppingBag } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The requested page could not be found on Dat Commerce.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "75dvh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div
        className="panel"
        style={{
          width: "min(480px, 100%)",
          padding: 32,
          display: "grid",
          gap: 16,
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "var(--accent-soft)",
              color: "var(--accent-text)",
              flexShrink: 0,
            }}
          >
            <Compass size={19} />
          </span>
          <div>
            <p
              className="muted"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Error 404
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Page not found
            </h1>
          </div>
        </div>

        <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
          The link you followed may be broken, or the page may have been removed or
          unpublished.
        </p>

        <div className="button-row" style={{ flexWrap: "wrap" }}>
          <Link className="btn primary" href="/">
            <Home size={14} />
            Back to storefront
          </Link>
          <Link className="btn" href="/store/shop">
            <ShoppingBag size={14} />
            Browse catalog
          </Link>
        </div>
      </div>
    </main>
  );
}
