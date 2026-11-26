"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px 16px",
          background: "#f7f8fa",
          color: "#111318",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <main
          role="alert"
          style={{
            width: "min(460px, 100%)",
            background: "#ffffff",
            border: "1px solid #e4e6ec",
            borderRadius: 12,
            padding: 28,
            boxShadow: "0 8px 24px rgba(17, 19, 24, 0.08)",
            display: "grid",
            gap: 14,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            Dat Commerce hit a critical error
          </h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#5c6270" }}>
            The application shell could not render. You can retry now or return to the
            storefront.
          </p>
          {error.digest ? (
            <p style={{ margin: 0, fontSize: 12, color: "#878d9c" }}>
              Reference ID: <code>{error.digest}</code>
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 0,
                borderRadius: 8,
                padding: "9px 14px",
                background: "#5b46e8",
                color: "#ffffff",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                border: "1px solid #e4e6ec",
                borderRadius: 8,
                padding: "9px 14px",
                background: "#ffffff",
                color: "#111318",
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Return to storefront
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
