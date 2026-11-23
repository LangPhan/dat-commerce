"use client";
import { useCallback, useEffect, useState } from "react";

const STORAGE_EVENT = "forma:storage";

export function useStored<T>(key: string, initial: T) {
  const [value, setValueState] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forma:" + key);
      if (saved !== null) {
        setValueState(JSON.parse(saved) as T);
      }
    } catch {
      /* Keep initial fallback when browser storage is unavailable. */
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    const onCustom = (event: Event) => {
      const custom = event as CustomEvent<{ key: string; value: T }>;
      if (custom.detail?.key === key) {
        setValueState(custom.detail.value);
      }
    };
    const onNative = (event: StorageEvent) => {
      if (event.key === "forma:" + key && event.newValue) {
        try {
          setValueState(JSON.parse(event.newValue) as T);
        } catch {
          /* Ignore malformed storage payload. */
        }
      }
    };
    window.addEventListener(STORAGE_EVENT, onCustom);
    window.addEventListener("storage", onNative);
    return () => {
      window.removeEventListener(STORAGE_EVENT, onCustom);
      window.removeEventListener("storage", onNative);
    };
  }, [key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved =
          typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          localStorage.setItem("forma:" + key, JSON.stringify(resolved));
          window.dispatchEvent(
            new CustomEvent(STORAGE_EVENT, { detail: { key, value: resolved } })
          );
        } catch {
          /* Best-effort persistence. */
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setValue, ready] as const;
}
