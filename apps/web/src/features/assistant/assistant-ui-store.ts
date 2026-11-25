import { create } from "zustand";

type AdminAssistantUiState = {
  floatingOpen: boolean;
  floatingExpanded: boolean;
  activeThreadId: string;
  draftPrompt: string;
  setFloatingOpen: (open: boolean) => void;
  toggleFloatingOpen: () => void;
  setFloatingExpanded: (expanded: boolean) => void;
  setActiveThreadId: (id: string) => void;
  setDraftPrompt: (prompt: string) => void;
};

export const useAdminAssistantStore = create<AdminAssistantUiState>((set) => ({
  floatingOpen: false,
  floatingExpanded: false,
  activeThreadId: "",
  draftPrompt: "",
  setFloatingOpen: (open) => set({ floatingOpen: open }),
  toggleFloatingOpen: () => set((s) => ({ floatingOpen: !s.floatingOpen })),
  setFloatingExpanded: (expanded) => set({ floatingExpanded: expanded }),
  setActiveThreadId: (id) => set({ activeThreadId: id }),
  setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),
}));
