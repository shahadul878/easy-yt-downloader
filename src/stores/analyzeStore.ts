import { create } from "zustand";
import { api } from "@/lib/tauri";
import type {
  FormatOption,
  MediaInfo,
  PlaylistEntry,
  PlaylistInfo,
} from "@/lib/types";
import { validateMediaUrl } from "@/lib/validators";

/** Synthetic UI id — not a real yt-dlp format; maps to bestaudio + MP3 convert. */
export const MP3_FORMAT_ID = "__mp3_convert__";

export const MP3_FORMAT: FormatOption = {
  formatId: MP3_FORMAT_ID,
  ext: "mp3",
  formatNote: "MP3 (converted)",
  kind: "audio",
  acodec: "mp3",
};

export type PlaylistMode = "video" | "mp3";

interface AnalyzeState {
  url: string;
  media: MediaInfo | null;
  playlist: PlaylistInfo | null;
  selectedFormatId: string | null;
  convertToMp3: boolean;
  selectedEntryIds: string[];
  playlistMode: PlaylistMode;
  loading: boolean;
  error: string | null;
  setUrl: (url: string) => void;
  setSelectedFormatId: (id: string | null) => void;
  setConvertToMp3: (value: boolean) => void;
  setPlaylistMode: (mode: PlaylistMode) => void;
  toggleEntry: (id: string) => void;
  selectAllEntries: () => void;
  clearEntrySelection: () => void;
  analyze: () => Promise<void>;
  clear: () => void;
  selectedFormat: () => FormatOption | null;
  bestAudioFormatId: () => string | null;
  videoFormats: () => FormatOption[];
  audioFormats: () => FormatOption[];
  downloadFormatId: () => string | null;
  selectedEntries: () => PlaylistEntry[];
}

export const useAnalyzeStore = create<AnalyzeState>((set, get) => ({
  url: "",
  media: null,
  playlist: null,
  selectedFormatId: null,
  convertToMp3: true,
  selectedEntryIds: [],
  playlistMode: "mp3",
  loading: false,
  error: null,
  setUrl: (url) => set({ url, error: null }),
  setSelectedFormatId: (selectedFormatId) => {
    if (selectedFormatId === MP3_FORMAT_ID) {
      set({ selectedFormatId, convertToMp3: true });
      return;
    }
    set({
      selectedFormatId,
      convertToMp3: false,
    });
  },
  setConvertToMp3: (convertToMp3) => set({ convertToMp3 }),
  setPlaylistMode: (playlistMode) => set({ playlistMode }),
  toggleEntry: (id) => {
    const current = get().selectedEntryIds;
    set({
      selectedEntryIds: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  },
  selectAllEntries: () => {
    const entries = get().playlist?.entries ?? [];
    set({ selectedEntryIds: entries.map((e) => e.id) });
  },
  clearEntrySelection: () => set({ selectedEntryIds: [] }),
  clear: () =>
    set({
      media: null,
      playlist: null,
      selectedFormatId: null,
      convertToMp3: true,
      selectedEntryIds: [],
      playlistMode: "mp3",
      error: null,
      loading: false,
    }),
  selectedFormat: () => {
    const { media, selectedFormatId } = get();
    if (!selectedFormatId) return null;
    if (selectedFormatId === MP3_FORMAT_ID) return MP3_FORMAT;
    if (!media) return null;
    return media.formats.find((f) => f.formatId === selectedFormatId) ?? null;
  },
  bestAudioFormatId: () => {
    const audios = (get().media?.formats ?? []).filter((f) => f.kind === "audio");
    if (audios.length === 0) return null;
    // Prefer m4a/AAC (usually highest YouTube audio), then highest bitrate.
    const ranked = [...audios].sort((a, b) => {
      const score = (f: FormatOption) => {
        const extBonus = f.ext === "m4a" || f.acodec?.includes("mp4a") ? 1_000_000 : 0;
        return extBonus + (f.tbr ?? 0) + (f.filesize ?? 0) / 1_000_000;
      };
      return score(b) - score(a);
    });
    return ranked[0]?.formatId ?? null;
  },
  videoFormats: () => {
    const formats = get().media?.formats ?? [];
    return formats.filter((f) => f.kind === "video" || f.kind === "combined");
  },
  audioFormats: () => {
    const formats = (get().media?.formats ?? []).filter((f) => f.kind === "audio");
    if (formats.length === 0) return [];

    // Keep one best stream per container — avoids a long list of near-duplicates.
    const bestByExt = new Map<string, FormatOption>();
    for (const format of formats) {
      const key = format.ext.toLowerCase();
      const existing = bestByExt.get(key);
      if (!existing || (format.tbr ?? 0) > (existing.tbr ?? 0)) {
        bestByExt.set(key, format);
      }
    }
    const curated = [...bestByExt.values()].sort(
      (a, b) => (b.tbr ?? 0) - (a.tbr ?? 0),
    );
    return [MP3_FORMAT, ...curated];
  },
  downloadFormatId: () => {
    const { selectedFormatId } = get();
    if (!selectedFormatId) return null;
    if (selectedFormatId === MP3_FORMAT_ID) {
      // Let yt-dlp pick the best source for conversion (m4a preferred).
      return "bestaudio";
    }
    return selectedFormatId;
  },
  selectedEntries: () => {
    const { playlist, selectedEntryIds } = get();
    if (!playlist) return [];
    const selected = new Set(selectedEntryIds);
    return playlist.entries.filter((e) => selected.has(e.id));
  },
  analyze: async () => {
    const { url } = get();
    const validationError = validateMediaUrl(url);
    if (validationError) {
      set({
        error: validationError,
        media: null,
        playlist: null,
        selectedFormatId: null,
        selectedEntryIds: [],
      });
      return;
    }
    set({
      loading: true,
      error: null,
      media: null,
      playlist: null,
      selectedFormatId: null,
      selectedEntryIds: [],
    });
    try {
      const result = await api.analyzeUrl(url.trim());
      if (result.kind === "playlist") {
        set({
          playlist: result.playlist,
          media: null,
          selectedEntryIds: result.playlist.entries.map((e) => e.id),
          playlistMode: "mp3",
          loading: false,
        });
        return;
      }

      const media = result.media;
      const hasAudio = media.formats.some((f) => f.kind === "audio");
      const preferredId = hasAudio
        ? MP3_FORMAT_ID
        : (media.formats.find((f) => f.kind === "combined") ??
            media.formats.find((f) => f.kind === "video") ??
            media.formats[0])?.formatId ?? null;
      set({
        media,
        playlist: null,
        selectedFormatId: preferredId,
        convertToMp3: preferredId === MP3_FORMAT_ID,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Analyze failed",
      });
    }
  },
}));
