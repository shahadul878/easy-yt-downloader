import { create } from "zustand";

export type AppView = "analyze" | "downloads" | "history" | "settings";

interface UiState {
  view: AppView;
  setView: (view: AppView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "analyze",
  setView: (view) => set({ view }),
}));
