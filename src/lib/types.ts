export type FormatKind = "video" | "audio" | "combined";

export interface FormatOption {
  formatId: string;
  ext: string;
  resolution?: string | null;
  fps?: number | null;
  vcodec?: string | null;
  acodec?: string | null;
  filesize?: number | null;
  tbr?: number | null;
  formatNote?: string | null;
  kind: FormatKind;
}

export interface MediaInfo {
  id: string;
  title: string;
  webpageUrl: string;
  thumbnail?: string | null;
  duration?: number | null;
  uploader?: string | null;
  formats: FormatOption[];
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  thumbnail?: string | null;
  duration?: number | null;
  uploader?: string | null;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  webpageUrl: string;
  uploader?: string | null;
  entries: PlaylistEntry[];
}

export type AnalyzeResult =
  | { kind: "media"; media: MediaInfo }
  | { kind: "playlist"; playlist: PlaylistInfo };

export interface StartDownloadRequest {
  url: string;
  formatId: string;
  title?: string | null;
  outputDir?: string | null;
  convertToMp3?: boolean;
}

export type DownloadStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  formatId: string;
  convertToMp3?: boolean;
  status: DownloadStatus;
  progress: number;
  speed?: string | null;
  eta?: string | null;
  outputPath?: string | null;
  error?: string | null;
  createdAt: string;
}

export interface DownloadProgressEvent {
  jobId: string;
  progress: number;
  speed?: string | null;
  eta?: string | null;
  status: DownloadStatus;
}

export interface DownloadFinishedEvent {
  jobId: string;
  outputPath?: string | null;
  status: DownloadStatus;
}

export interface DownloadErrorEvent {
  jobId: string;
  error: string;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  formatId: string;
  status: string;
  outputPath?: string | null;
  error?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  convertToMp3?: boolean;
}

export interface AppSettings {
  downloadDir: string;
  ytdlpPath: string;
  ffmpegPath: string;
  concurrentDownloads: number;
  openFolderOnComplete: boolean;
}

export interface CommandError {
  message: string;
}
