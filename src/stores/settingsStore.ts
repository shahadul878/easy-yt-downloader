import { create } from "zustand";
import { api } from "@/lib/tauri";
import type { AppSettings } from "@/lib/types";

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  saving: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await api.getSettings();
      set({ settings, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load settings",
      });
    }
  },
  update: async (patch) => {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ saving: true, error: null });
    try {
      const settings = await api.updateSettings(next);
      set({ settings, saving: false });
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : "Failed to save settings",
      });
    }
  },
}));
