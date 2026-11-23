"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AppTheme = "light" | "dark";

const STORAGE_EVENT = "forma:storage";
const THEME_KEY = "theme";

function normalizeTheme(raw: unknown): AppTheme {
  return raw === "dark" ? "dark" : "light";
}

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem("forma:" + key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function applyAppTheme(next: AppTheme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
  }
}

function subscribeKey(key: string, syncThemeOnNative = false) {
  return (onStoreChange: () => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }
    const onCustom = (event: Event) => {
      const custom = event as CustomEvent<{ key?: string }>;
      if (custom.detail?.key === key) {
        onStoreChange();
      }
    };
    const onNative = (event: StorageEvent) => {
      if (event.key === "forma:" + key) {
        if (syncThemeOnNative) {
          applyAppTheme(normalizeTheme(readStoredValue<string>(THEME_KEY, "light")));
        }
        onStoreChange();
      }
    };
    window.addEventListener(STORAGE_EVENT, onCustom);
    window.addEventListener("storage", onNative);
    return () => {
      window.removeEventListener(STORAGE_EVENT, onCustom);
      window.removeEventListener("storage", onNative);
    };
  };
}

const subscribeTheme = subscribeKey(THEME_KEY, true);

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
    try {
      window.localStorage.setItem("forma:" + THEME_KEY, JSON.stringify(resolved));
      window.dispatchEvent(
        new CustomEvent(STORAGE_EVENT, { detail: { key: THEME_KEY, value: resolved } })
      );
    } catch {
      /* Best-effort persistence. */
    }
  }, []);

  return [theme, setTheme] as const;
}

export function useStoredBoolean(
  key: string,
  initial = false
): readonly [boolean, (next: boolean) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeKey(key)(onStoreChange),
    [key]
  );

  const getSnapshot = useCallback(
    () => Boolean(readStoredValue<boolean>(key, initial)),
    [key, initial]
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, () => initial);

  const setValue = useCallback(
    (next: boolean) => {
      const resolved = Boolean(next);
      try {
        window.localStorage.setItem("forma:" + key, JSON.stringify(resolved));
        window.dispatchEvent(
          new CustomEvent(STORAGE_EVENT, { detail: { key, value: resolved } })
        );
      } catch {
        /* Best-effort persistence. */
      }
    },
    [key]
  );

  return [value, setValue] as const;
}
