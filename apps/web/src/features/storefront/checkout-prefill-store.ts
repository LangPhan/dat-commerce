import { create } from "zustand";
import type { CheckoutPrefillDto } from "@/types/api-cms-ai";

const STORAGE_KEY = "dc_ai_checkout_prefill";

function readInitialPrefill(): {
  prefill: CheckoutPrefillDto | null;
  updatedAt: number | null;
} {
  if (typeof window === "undefined") {
    return { prefill: null, updatedAt: null };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { prefill: null, updatedAt: null };
    const parsed = JSON.parse(raw) as {
      prefill?: CheckoutPrefillDto;
      updatedAt?: number;
    };
    if (!parsed?.prefill) return { prefill: null, updatedAt: null };
    return {
      prefill: parsed.prefill,
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    return { prefill: null, updatedAt: null };
  }
}

type CheckoutPrefillState = {
  prefill: CheckoutPrefillDto | null;
  updatedAt: number | null;
  setPrefill: (prefill: CheckoutPrefillDto) => void;
  clearPrefill: () => void;
};

const initial = readInitialPrefill();

export const useCheckoutPrefillStore = create<CheckoutPrefillState>((set) => ({
  prefill: initial.prefill,
  updatedAt: initial.updatedAt,
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
    set({ prefill, updatedAt });
  },
  clearPrefill: () => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore storage quota
      }
    }
    set({ prefill: null, updatedAt: null });
  },
}));
