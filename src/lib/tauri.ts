import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AnalyzeResult,
  AppSettings,
  CommandError,
  DownloadErrorEvent,
  DownloadFinishedEvent,
  DownloadJob,
  DownloadProgressEvent,
  HistoryEntry,
  StartDownloadRequest,
} from "./types";

function toErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as CommandError).message);
  }
  return "Something went wrong.";
}

function assertDesktopRuntime(): void {
  if (!isTauri()) {
    throw new Error(
      "Easy Downloader must run inside the desktop window (npm run tauri:dev), not a regular browser tab.",
    );
  }
}

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  assertDesktopRuntime();
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export const api = {
  analyzeUrl(url: string) {
    return invokeCommand<AnalyzeResult>("analyze_url", { url });
  },
  startDownload(request: StartDownloadRequest) {
    return invokeCommand<DownloadJob>("start_download", { request });
  },
  cancelDownload(jobId: string) {
    return invokeCommand<void>("cancel_download", { jobId });
  },
  listHistory(limit = 100) {
    return invokeCommand<HistoryEntry[]>("list_history", { limit });
  },
  getSettings() {
    return invokeCommand<AppSettings>("get_settings");
  },
  updateSettings(settings: AppSettings) {
    return invokeCommand<AppSettings>("update_settings", { settings });
  },
  listActiveDownloads() {
    return invokeCommand<DownloadJob[]>("list_active_downloads");
  },
  revealInFolder(path: string) {
    return invokeCommand<void>("reveal_in_folder", { path });
  },
};

export async function subscribeDownloadEvents(handlers: {
  onProgress?: (event: DownloadProgressEvent) => void;
  onFinished?: (event: DownloadFinishedEvent) => void;
  onError?: (event: DownloadErrorEvent) => void;
}): Promise<() => void> {
  assertDesktopRuntime();
  const unlisteners: UnlistenFn[] = [];

  if (handlers.onProgress) {
    unlisteners.push(
      await listen<DownloadProgressEvent>("download-progress", (e) =>
        handlers.onProgress?.(e.payload),
      ),
    );
  }
  if (handlers.onFinished) {
    unlisteners.push(
      await listen<DownloadFinishedEvent>("download-finished", (e) =>
        handlers.onFinished?.(e.payload),
      ),
    );
  }
  if (handlers.onError) {
    unlisteners.push(
      await listen<DownloadErrorEvent>("download-error", (e) =>
        handlers.onError?.(e.payload),
      ),
    );
  }

  return () => {
    unlisteners.forEach((u) => u());
  };
}
