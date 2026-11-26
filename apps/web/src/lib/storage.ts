"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readStoredValue,
  subscribeStoredKey,
  writeStoredValue,
} from "./theme";

export function useStored<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const [value, setValueState] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValueState(readStoredValue<T>(key, initialRef.current));
    setReady(true);
    return subscribeStoredKey(key)(() => {
      setValueState(readStoredValue<T>(key, initialRef.current));
    });
  }, [key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = readStoredValue<T>(key, initialRef.current);
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(current) : next;
      writeStoredValue(key, resolved);
      setValueState(resolved);
    },
    [key]
  );

  return [value, setValue, ready] as const;
}
