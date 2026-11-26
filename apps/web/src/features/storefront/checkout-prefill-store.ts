import { create } from "zustand";
import type { CheckoutPrefillDto } from "@/types/api-cms-ai";

const STORAGE_KEY = "dc_ai_checkout_prefill:v1";
const LEGACY_STORAGE_KEY = "dc_ai_checkout_prefill";

function readStoredPrefill(): {
  prefill: CheckoutPrefillDto | null;
  updatedAt: number | null;
} {
  if (typeof window === "undefined") {
    return { prefill: null, updatedAt: null };
  }
  try {
    let raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        window.sessionStorage.setItem(STORAGE_KEY, legacy);
        window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (!raw) return { prefill: null, updatedAt: null };
    const parsed = JSON.parse(raw) as {
      prefill?: CheckoutPrefillDto;
      updatedAt?: number;
    };
    if (!parsed?.prefill || typeof parsed.prefill !== "object") {
      return { prefill: null, updatedAt: null };
    }
    return {
      prefill: parsed.prefill,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return { prefill: null, updatedAt: null };
  }
}

type CheckoutPrefillState = {
  prefill: CheckoutPrefillDto | null;
  updatedAt: number | null;
  hydrated: boolean;
  hydrateFromStorage: () => void;
  setPrefill: (prefill: CheckoutPrefillDto) => void;
  clearPrefill: () => void;
};

export const useCheckoutPrefillStore = create<CheckoutPrefillState>(
  (set, get) => ({
    prefill: null,
    updatedAt: null,
    hydrated: false,
    hydrateFromStorage: () => {
      if (get().hydrated) return;
      const stored = readStoredPrefill();
      set({
        prefill: stored.prefill,
        updatedAt: stored.updatedAt,
        hydrated: true,
      });
    },
    setPrefill: (prefill) => {
      const updatedAt = Date.now();
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ prefill, updatedAt })
          );
        } catch {
          // ignore storage quota
        }
      }
      set({ prefill, updatedAt, hydrated: true });
    },
    clearPrefill: () => {
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
          window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          // ignore storage quota
        }
      }
      set({ prefill: null, updatedAt: null, hydrated: true });
    },
  })
);
