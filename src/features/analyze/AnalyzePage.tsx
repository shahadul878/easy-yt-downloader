import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBytes, formatDuration } from "@/lib/utils";
import type { FormatOption } from "@/lib/types";
import { MP3_FORMAT_ID, useAnalyzeStore } from "@/stores/analyzeStore";
import { useDownloadStore } from "@/stores/downloadStore";
import { useUiStore } from "@/stores/uiStore";

function FormatRow({
  format,
  selected,
  onSelect,
}: {
  format: FormatOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const isMp3Option = format.formatId === MP3_FORMAT_ID;
  const kbps =
    format.tbr != null && format.tbr > 0 ? `${Math.round(format.tbr)} kbps` : null;
  const label = isMp3Option
    ? "MP3"
    : format.kind === "audio"
      ? format.ext.toUpperCase()
      : format.resolution ||
        format.formatNote ||
        format.ext.toUpperCase();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border hover:bg-accent/50"
      }`}
    >
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {isMp3Option
            ? "Best source → FFmpeg VBR MP3 · metadata embedded"
            : format.kind === "audio"
              ? `${format.formatId} · ${format.acodec ?? format.ext}${
                  kbps ? ` · ${kbps}` : ""
                }`
              : `${format.formatId} · ${format.ext}${
                  format.fps ? ` · ${Math.round(format.fps)}fps` : ""
                }${format.acodec ? ` · ${format.acodec}` : ""}`}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">
        {isMp3Option
          ? "Best quality"
          : format.kind === "audio" && kbps
            ? kbps
            : formatBytes(format.filesize)}
      </span>
    </button>
  );
}

export function AnalyzePage() {
  const url = useAnalyzeStore((s) => s.url);
  const media = useAnalyzeStore((s) => s.media);
  const playlist = useAnalyzeStore((s) => s.playlist);
  const selectedFormatId = useAnalyzeStore((s) => s.selectedFormatId);
  const convertToMp3 = useAnalyzeStore((s) => s.convertToMp3);
  const selectedEntryIds = useAnalyzeStore((s) => s.selectedEntryIds);
  const playlistMode = useAnalyzeStore((s) => s.playlistMode);
  const loading = useAnalyzeStore((s) => s.loading);
  const error = useAnalyzeStore((s) => s.error);
  const setUrl = useAnalyzeStore((s) => s.setUrl);
  const setSelectedFormatId = useAnalyzeStore((s) => s.setSelectedFormatId);
  const setPlaylistMode = useAnalyzeStore((s) => s.setPlaylistMode);
  const toggleEntry = useAnalyzeStore((s) => s.toggleEntry);
  const selectAllEntries = useAnalyzeStore((s) => s.selectAllEntries);
  const clearEntrySelection = useAnalyzeStore((s) => s.clearEntrySelection);
  const analyze = useAnalyzeStore((s) => s.analyze);
  const selectedFormat = useAnalyzeStore((s) => s.selectedFormat);
  const downloadFormatId = useAnalyzeStore((s) => s.downloadFormatId);
  const selectedEntries = useAnalyzeStore((s) => s.selectedEntries);
  const videoFormats = useAnalyzeStore((s) => s.videoFormats);
  const audioFormats = useAnalyzeStore((s) => s.audioFormats);

  const startDownload = useDownloadStore((s) => s.startDownload);
  const startPlaylistDownloads = useDownloadStore((s) => s.startPlaylistDownloads);
  const starting = useDownloadStore((s) => s.starting);
  const downloadError = useDownloadStore((s) => s.error);
  const setView = useUiStore((s) => s.setView);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await analyze();
  };

  const onDownload = async () => {
    if (!media) return;
    const formatId = downloadFormatId();
    if (!formatId) return;
    const format = selectedFormat();
    const asMp3 =
      selectedFormatId === MP3_FORMAT_ID ||
      Boolean(convertToMp3 && format?.kind === "audio");
    await startDownload({
      url: media.webpageUrl || url.trim(),
      formatId,
      title: media.title,
      convertToMp3: asMp3,
    });
    setView("downloads");
  };

  const onPlaylistDownload = async () => {
    const entries = selectedEntries();
    await startPlaylistDownloads({
      entries: entries.map((e) => ({ url: e.url, title: e.title })),
      mode: playlistMode,
    });
    setView("downloads");
  };

  const willDownloadMp3 =
    selectedFormatId === MP3_FORMAT_ID ||
    Boolean(convertToMp3 && selectedFormat()?.kind === "audio");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Analyze</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a media or playlist URL to inspect and download.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Media URL</CardTitle>
          <CardDescription>
            Use only URLs for content you own or may legally save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="media-url" className="sr-only">
                Media URL
              </Label>
              <Input
                id="media-url"
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </form>
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {playlist ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="leading-snug">{playlist.title}</CardTitle>
              <CardDescription>
                {playlist.uploader ?? "Playlist"} · {playlist.entries.length} items ·{" "}
                {selectedEntryIds.length} selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Download as</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={playlistMode === "mp3" ? "default" : "outline"}
                    onClick={() => setPlaylistMode("mp3")}
                  >
                    MP3
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={playlistMode === "video" ? "default" : "outline"}
                    onClick={() => setPlaylistMode("video")}
                  >
                    Best video
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={selectedEntryIds.length === 0 || starting}
                onClick={onPlaylistDownload}
              >
                {starting
                  ? "Queuing…"
                  : `Download ${selectedEntryIds.length} as ${
                      playlistMode === "mp3" ? "MP3" : "video"
                    }`}
              </Button>
              {downloadError ? (
                <p className="text-xs text-destructive">{downloadError}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>Playlist items</CardTitle>
                <CardDescription>Select which videos to download.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectAllEntries}>
                  All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={clearEntrySelection}
                >
                  None
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[28rem] space-y-2 overflow-auto">
              {playlist.entries.map((entry, index) => {
                const checked = selectedEntryIds.includes(entry.id);
                return (
                  <label
                    key={`${entry.id}-${index}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 ${
                      checked
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      checked={checked}
                      onChange={() => toggleEntry(entry.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {index + 1}. {entry.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {entry.uploader ?? "Unknown"}
                        {entry.duration != null
                          ? ` · ${formatDuration(entry.duration)}`
                          : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {media ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="overflow-hidden">
            {media.thumbnail ? (
              <img
                src={media.thumbnail}
                alt=""
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
                No thumbnail
              </div>
            )}
            <CardHeader>
              <CardTitle className="leading-snug">{media.title}</CardTitle>
              <CardDescription>
                {media.uploader ?? "Unknown uploader"} · {formatDuration(media.duration)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                disabled={!downloadFormatId() || starting}
                onClick={onDownload}
              >
                {starting
                  ? "Starting…"
                  : willDownloadMp3
                    ? "Download as MP3"
                    : "Download selected"}
              </Button>
              {downloadError ? (
                <p className="mt-2 text-xs text-destructive">{downloadError}</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Video formats</CardTitle>
                <CardDescription>Video-only and combined streams</CardDescription>
              </CardHeader>
              <CardContent className="max-h-72 space-y-2 overflow-auto">
                {videoFormats().length === 0 ? (
                  <p className="text-sm text-muted-foreground">No video formats found.</p>
                ) : (
                  videoFormats().map((format) => (
                    <FormatRow
                      key={format.formatId}
                      format={format}
                      selected={selectedFormatId === format.formatId}
                      onSelect={() => setSelectedFormatId(format.formatId)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audio formats</CardTitle>
                <CardDescription>
                  MP3 converts the best available source. Other rows keep the original container
                  (one best stream per type).
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-72 space-y-2 overflow-auto">
                {audioFormats().length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audio formats found.</p>
                ) : (
                  audioFormats().map((format) => (
                    <FormatRow
                      key={format.formatId}
                      format={format}
                      selected={selectedFormatId === format.formatId}
                      onSelect={() => setSelectedFormatId(format.formatId)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
