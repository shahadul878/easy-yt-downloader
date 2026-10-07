import { create } from "zustand";
import { api, subscribeDownloadEvents } from "@/lib/tauri";
import type { DownloadJob, HistoryEntry } from "@/lib/types";
import { useSettingsStore } from "@/stores/settingsStore";

interface DownloadState {
  jobs: DownloadJob[];
  history: HistoryEntry[];
  starting: boolean;
  error: string | null;
  initialized: boolean;
  init: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  startDownload: (input: {
    url: string;
    formatId: string;
    title?: string;
    convertToMp3?: boolean;
  }) => Promise<void>;
  startPlaylistDownloads: (input: {
    entries: { url: string; title: string }[];
    mode: "video" | "mp3";
  }) => Promise<void>;
  cancelDownload: (jobId: string) => Promise<void>;
  retryDownload: (job: {
    url: string;
    title: string;
    formatId: string;
    convertToMp3?: boolean;
  }) => Promise<void>;
  openFolder: (path: string) => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

async function maybeOpenFolderOnComplete(outputPath?: string | null) {
  const settings = useSettingsStore.getState().settings;
  if (!settings?.openFolderOnComplete) return;
  const target = outputPath || settings.downloadDir;
  if (!target) return;
  try {
    await api.revealInFolder(target);
  } catch {
    // Non-fatal: download already succeeded.
  }
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  jobs: [],
  history: [],
  starting: false,
  error: null,
  initialized: false,
  init: async () => {
    if (get().initialized) return;
    try {
      const [jobs, history] = await Promise.all([
        api.listActiveDownloads(),
        api.listHistory(100),
      ]);
      set({ jobs, history, initialized: true });

      unsubscribe?.();
      unsubscribe = await subscribeDownloadEvents({
        onProgress: (event) => {
          set((state) => ({
            jobs: state.jobs.map((job) =>
              job.id === event.jobId
                ? {
                    ...job,
                    progress: event.progress,
                    speed: event.speed,
                    eta: event.eta,
                    status: event.status,
                  }
                : job,
            ),
          }));
        },
        onFinished: async (event) => {
          set((state) => ({
            jobs: state.jobs.map((job) =>
              job.id === event.jobId
                ? {
                    ...job,
                    status: event.status,
                    outputPath: event.outputPath,
                    progress: event.status === "completed" ? 100 : job.progress,
                  }
                : job,
            ),
          }));
          await get().refreshHistory();
          if (event.status === "completed") {
            await maybeOpenFolderOnComplete(event.outputPath);
          }
        },
        onError: async (event) => {
          set((state) => ({
            jobs: state.jobs.map((job) =>
              job.id === event.jobId
                ? { ...job, status: "failed", error: event.error }
                : job,
            ),
            error: event.error,
          }));
          await get().refreshHistory();
        },
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to init downloads",
        initialized: true,
      });
    }
  },
  refreshHistory: async () => {
    try {
      const history = await api.listHistory(100);
      set({ history });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load history",
      });
    }
  },
  startDownload: async ({ url, formatId, title, convertToMp3 }) => {
    set({ starting: true, error: null });
    try {
      const job = await api.startDownload({
        url,
        formatId,
        title,
        convertToMp3: Boolean(convertToMp3),
      });
      set((state) => ({
        jobs: [job, ...state.jobs.filter((j) => j.id !== job.id)],
        starting: false,
      }));
      await get().refreshHistory();
    } catch (error) {
      set({
        starting: false,
        error: error instanceof Error ? error.message : "Failed to start download",
      });
    }
  },
  startPlaylistDownloads: async ({ entries, mode }) => {
    if (entries.length === 0) {
      set({ error: "Select at least one playlist item." });
      return;
    }
    set({ starting: true, error: null });
    const convertToMp3 = mode === "mp3";
    // MP3: backend upgrades bestaudio → m4a-preferred selector + VBR quality 0.
    const formatId = convertToMp3 ? "bestaudio" : "bv*+ba/b";
    try {
      for (const entry of entries) {
        const job = await api.startDownload({
          url: entry.url,
          formatId,
          title: entry.title,
          convertToMp3,
        });
        set((state) => ({
          jobs: [job, ...state.jobs.filter((j) => j.id !== job.id)],
        }));
      }
      set({ starting: false });
      await get().refreshHistory();
    } catch (error) {
      set({
        starting: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start playlist downloads",
      });
    }
  },
  cancelDownload: async (jobId) => {
    try {
      await api.cancelDownload(jobId);
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId ? { ...job, status: "cancelled" } : job,
        ),
      }));
      await get().refreshHistory();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to cancel download",
      });
    }
  },
  retryDownload: async (job) => {
    set({ error: null });
    await get().startDownload({
      url: job.url,
      formatId: job.formatId,
      title: job.title,
      convertToMp3: Boolean(job.convertToMp3),
    });
  },
  openFolder: async (path) => {
    try {
      await api.revealInFolder(path);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to open folder",
      });
    }
  },
}));
