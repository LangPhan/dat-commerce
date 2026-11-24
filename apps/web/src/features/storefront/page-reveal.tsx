"use client";

import { Mountain } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { ElementNode } from "@/features/builder/types";

export type PageRevealPhase = "loading" | "revealing" | "ready";

let initialPathname: string | null = null;
let hasCompletedInitialReveal = false;

export function recordInitialPathname(pathname: string | null | undefined) {
  if (typeof window === "undefined" || !pathname) return;
  if (initialPathname === null) {
    initialPathname = pathname;
    return;
  }
  if (pathname !== initialPathname) {
    hasCompletedInitialReveal = true;
  }
}

export function markStoreInitialRevealDone() {
  hasCompletedInitialReveal = true;
}

export function shouldShowStorePageLoader(
  currentPathname?: string | null
): boolean {
  if (hasCompletedInitialReveal) return false;
  if (
    initialPathname !== null &&
    currentPathname &&
    currentPathname !== initialPathname
  ) {
    hasCompletedInitialReveal = true;
    return false;
  }
  return true;
}

export function resetPageRevealStateForTest() {
  initialPathname = null;
  hasCompletedInitialReveal = false;
}

function hasUrlHash(): boolean {
  return typeof window !== "undefined" && Boolean(window.location?.hash);
}

function scrollToTopInstant() {
  if (typeof window === "undefined" || hasUrlHash()) return;
  if (typeof window.scrollTo !== "function") return;
  try {
    window.scrollTo(0, 0);
  } catch {
    // Ignore unimplemented scrollTo in test environments such as jsdom.
  }
}

function isSafePreloadUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  const lower = trimmed.toLowerCase();
  return lower.startsWith("https://") || lower.startsWith("http://");
}

function collectBackgroundUrls(bgValue: string | undefined, out: string[]) {
  if (!bgValue) return;
  const regex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match: RegExpExecArray | null = regex.exec(bgValue);
  while (match !== null) {
    const candidate = (match[2] || "").trim();
    if (isSafePreloadUrl(candidate) && !out.includes(candidate)) {
      out.push(candidate);
    }
    match = regex.exec(bgValue);
  }
}

export function extractPreloadImageUrls(nodes?: ElementNode[] | null): string[] {
  if (!nodes?.length) return [];
  const urls: string[] = [];

  for (const section of nodes.slice(0, 2)) {
    const queue: ElementNode[] = [section];
    if (section.children?.length) {
      queue.push(...section.children);
    }
    for (const node of queue) {
      collectBackgroundUrls(node.styles?.base?.backgroundImage, urls);
      if (node.type === "image" && typeof node.props?.src === "string") {
        const candidate = node.props.src.trim();
        if (isSafePreloadUrl(candidate) && !urls.includes(candidate)) {
          urls.push(candidate);
        }
      }
      if (urls.length >= 2) {
        return urls.slice(0, 2);
      }
    }
  }

  return urls.slice(0, 2);
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function preloadSingleImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().catch(() => undefined).finally(finish);
      } else {
        finish();
      }
    };
    img.onerror = finish;
    img.src = url;
    if (img.complete) {
      finish();
    }
  });
}

export function StorePageReveal({
  ready,
  preloadImageUrls = [],
  brandName = "TERRAIN",
  maxWaitMs = 2400,
  children,
}: {
  ready: boolean;
  preloadImageUrls?: string[];
  brandName?: string;
  maxWaitMs?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<PageRevealPhase>(() =>
    shouldShowStorePageLoader(pathname) ? "loading" : "ready"
  );

  useEffect(() => {
    recordInitialPathname(pathname);
  }, [pathname]);

  useEffect(() => {
    if (phase !== "loading" || hasUrlHash()) return;
    const prevRestoration =
      "scrollRestoration" in window.history
        ? window.history.scrollRestoration
        : null;
    if (prevRestoration !== null) {
      window.history.scrollRestoration = "manual";
    }
    scrollToTopInstant();

    const keepAtTop = () => {
      if (!hasUrlHash() && window.scrollY > 0) {
        scrollToTopInstant();
      }
    };
    window.addEventListener("scroll", keepAtTop, { passive: true });
    window.addEventListener("load", keepAtTop);

    return () => {
      window.removeEventListener("scroll", keepAtTop);
      window.removeEventListener("load", keepAtTop);
      if (prevRestoration !== null) {
        window.history.scrollRestoration = prevRestoration;
      }
    };
  }, [phase]);

  const preloadKey = preloadImageUrls.join("\n");

  useEffect(() => {
    if (phase !== "loading") return;
    const failsafeTimer = window.setTimeout(() => {
      scrollToTopInstant();
      markStoreInitialRevealDone();
      setPhase("revealing");
    }, maxWaitMs);
    return () => window.clearTimeout(failsafeTimer);
  }, [phase, maxWaitMs]);

  useEffect(() => {
    if (!ready || phase !== "loading") return;
    let cancelled = false;
    let rafOne = 0;
    let rafTwo = 0;

    const urls = preloadKey ? preloadKey.split("\n").filter(Boolean) : [];
    const fontsReady =
      typeof document !== "undefined" && document.fonts?.ready
        ? Promise.race([document.fonts.ready.catch(() => undefined), waitMs(400)])
        : Promise.resolve();
    const imagesReady =
      urls.length > 0
        ? Promise.race([Promise.all(urls.map(preloadSingleImage)), waitMs(700)])
        : Promise.resolve();

    void Promise.all([fontsReady, imagesReady]).then(() => {
      if (cancelled) return;
      rafOne = window.requestAnimationFrame(() => {
        if (cancelled) return;
        rafTwo = window.requestAnimationFrame(() => {
          if (!cancelled) {
            scrollToTopInstant();
            markStoreInitialRevealDone();
            setPhase("revealing");
          }
        });
      });
    });

    return () => {
      cancelled = true;
      if (rafOne) window.cancelAnimationFrame(rafOne);
      if (rafTwo) window.cancelAnimationFrame(rafTwo);
    };
  }, [ready, phase, preloadKey]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const finishTimer = window.setTimeout(() => {
      setPhase("ready");
    }, 400);
    return () => window.clearTimeout(finishTimer);
  }, [phase]);

  return (
    <>
      {phase !== "ready" ? (
        <div
          className={`store-page-loader${phase === "revealing" ? " is-exiting" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Loading storefront"
        >
          <div className="store-page-loader-inner">
            <div className="store-page-loader-brand">
              <Mountain size={20} strokeWidth={2} aria-hidden="true" />
              <span>{brandName}</span>
            </div>
            <div className="store-page-loader-track" aria-hidden="true">
              <div className="store-page-loader-bar" />
            </div>
          </div>
        </div>
      ) : null}
      <div className={`store-page-stage is-${phase}`}>{children}</div>
    </>
  );
}
