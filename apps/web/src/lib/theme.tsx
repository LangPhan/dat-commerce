"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AppTheme = "light" | "dark";

const STORAGE_EVENT = "forma:storage";
const VERSION_PREFIX = "forma:v1:";
const LEGACY_PREFIX = "forma:";
const THEME_KEY = "theme";

// Module-level memory cache & deduplicated window listener registry
const valueCache = new Map<string, unknown>();
const keySubscribers = new Map<string, Set<() => void>>();
let listenersAttached = false;

function storageKey(key: string): string {
  return VERSION_PREFIX + key;
}

function legacyStorageKey(key: string): string {
  return LEGACY_PREFIX + key;
}

function normalizeTheme(raw: unknown): AppTheme {
  return raw === "dark" ? "dark" : "light";
}

function notifyKey(key: string): void {
  const subs = keySubscribers.get(key);
  if (!subs) return;
  for (const fn of subs) {
    fn();
  }
}

function handleCustomStorageEvent(event: Event): void {
  const custom = event as CustomEvent<{ key?: string; value?: unknown }>;
  const key = custom.detail?.key;
  if (!key) return;
  if ("value" in (custom.detail || {})) {
    valueCache.set(key, custom.detail.value);
  } else {
    valueCache.delete(key);
  }
  notifyKey(key);
}

function handleNativeStorageEvent(event: StorageEvent): void {
  if (!event.key) {
    valueCache.clear();
    for (const key of keySubscribers.keys()) {
      notifyKey(key);
    }
    return;
  }
  let matchedKey: string | null = null;
  if (event.key.startsWith(VERSION_PREFIX)) {
    matchedKey = event.key.slice(VERSION_PREFIX.length);
  } else if (event.key.startsWith(LEGACY_PREFIX)) {
    matchedKey = event.key.slice(LEGACY_PREFIX.length);
  }
  if (!matchedKey) return;
  valueCache.delete(matchedKey);
  if (matchedKey === THEME_KEY) {
    applyAppTheme(normalizeTheme(readStoredValue<string>(THEME_KEY, "light")));
  }
  notifyKey(matchedKey);
}

function ensureGlobalListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener(STORAGE_EVENT, handleCustomStorageEvent);
  window.addEventListener("storage", handleNativeStorageEvent);
}

function maybeDetachGlobalListeners(): void {
  if (!listenersAttached || keySubscribers.size > 0 || typeof window === "undefined") {
    return;
  }
  listenersAttached = false;
  window.removeEventListener(STORAGE_EVENT, handleCustomStorageEvent);
  window.removeEventListener("storage", handleNativeStorageEvent);
}

export function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  if (valueCache.has(key)) {
    const cached = valueCache.get(key);
    return cached !== undefined ? (cached as T) : fallback;
  }
  try {
    let raw = window.localStorage.getItem(storageKey(key));
    if (raw === null) {
      const legacy = window.localStorage.getItem(legacyStorageKey(key));
      if (legacy !== null) {
        raw = legacy;
        try {
          window.localStorage.setItem(storageKey(key), legacy);
        } catch {
          /* Best-effort migration */
        }
      }
    }
    if (raw !== null) {
      const parsed = JSON.parse(raw) as T;
      valueCache.set(key, parsed);
      return parsed;
    }
    valueCache.set(key, undefined);
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredValue<T>(key: string, value: T): void {
  valueCache.set(key, value);
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(storageKey(key), serialized);
    // Keep legacy theme key updated for older tabs/scripts
    if (key === THEME_KEY) {
      window.localStorage.setItem(legacyStorageKey(key), serialized);
    }
    window.dispatchEvent(
      new CustomEvent(STORAGE_EVENT, { detail: { key, value } })
    );
  } catch {
    /* Best-effort persistence. */
  }
}

export function subscribeStoredKey(key: string): (onStoreChange: () => void) => () => void {
  return (onStoreChange: () => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }
    ensureGlobalListeners();
    let subs = keySubscribers.get(key);
    if (!subs) {
      subs = new Set();
      keySubscribers.set(key, subs);
    }
    subs.add(onStoreChange);
    return () => {
      subs?.delete(onStoreChange);
      if (subs && subs.size === 0) {
        keySubscribers.delete(key);
        maybeDetachGlobalListeners();
      }
    };
  };
}

export function applyAppTheme(next: AppTheme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
  }
}

const subscribeTheme = subscribeStoredKey(THEME_KEY);

function getThemeSnapshot(): AppTheme {
  if (typeof window !== "undefined") {
    const raw = readStoredValue<string | null>(THEME_KEY, null);
    if (raw === "dark" || raw === "light") {
      return raw;
    }
  }
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.theme;
    if (attr === "dark" || attr === "light") {
      return attr;
    }
  }
  return "light";
}

const getThemeServerSnapshot = (): AppTheme => "light";

export function useAppTheme(): readonly [AppTheme, (next: AppTheme) => void] {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  const setTheme = useCallback((next: AppTheme) => {
    const resolved = normalizeTheme(next);
    applyAppTheme(resolved);
    writeStoredValue(THEME_KEY, resolved);
  }, []);

  return [theme, setTheme] as const;
}

export function useStoredBoolean(
  key: string,
  initial = false
): readonly [boolean, (next: boolean) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeStoredKey(key)(onStoreChange),
    [key]
  );

  const getSnapshot = useCallback(
    () => Boolean(readStoredValue<boolean>(key, initial)),
    [key, initial]
  );

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean) => {
      writeStoredValue(key, Boolean(next));
    },
    [key]
  );

  return [value, setValue] as const;
}
