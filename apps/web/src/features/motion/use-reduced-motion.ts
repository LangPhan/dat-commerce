"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

let sharedMql: MediaQueryList | null = null;
const listeners = new Set<() => void>();

function handleChange() {
  for (const listener of listeners) {
    listener();
  }
}

function getMql(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  if (!sharedMql) {
    sharedMql = window.matchMedia(QUERY);
  }
  return sharedMql;
}

function subscribe(onStoreChange: () => void): () => void {
  const mql = getMql();
  if (!mql) return () => {};
  if (listeners.size === 0) {
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
    } else if (typeof mql.addListener === "function") {
      mql.addListener(handleChange);
    }
  }
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && sharedMql) {
      if (typeof sharedMql.removeEventListener === "function") {
        sharedMql.removeEventListener("change", handleChange);
      } else if (typeof sharedMql.removeListener === "function") {
        sharedMql.removeListener(handleChange);
      }
      sharedMql = null;
    }
  };
}

function getSnapshot(): boolean {
  const mql = getMql();
  return mql ? mql.matches : false;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Lightweight shared prefers-reduced-motion hook (avoids pulling in the entire `motion` runtime).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
