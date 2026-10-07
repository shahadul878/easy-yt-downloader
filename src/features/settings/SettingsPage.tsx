import { isTauri } from "@tauri-apps/api/core";
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
import { useSettingsStore } from "@/stores/settingsStore";

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const loading = useSettingsStore((s) => s.loading);
  const saving = useSettingsStore((s) => s.saving);
  const error = useSettingsStore((s) => s.error);
  const update = useSettingsStore((s) => s.update);

  if (loading || !settings) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading settings…</div>
    );
  }

  const pickDirectory = async () => {
    if (!isTauri()) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose download folder",
    });
    if (typeof selected === "string") {
      await update({ downloadDir: selected });
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paths and download defaults for this machine.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Downloads</CardTitle>
          <CardDescription>Where completed files are written.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="download-dir">Download folder</Label>
            <div className="flex gap-2">
              <Input
                id="download-dir"
                value={settings.downloadDir}
                onChange={(e) =>
                  useSettingsStore.setState({
                    settings: { ...settings, downloadDir: e.target.value },
                  })
                }
                onBlur={() => update({ downloadDir: settings.downloadDir })}
              />
              <Button type="button" variant="outline" onClick={pickDirectory}>
                Browse
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="concurrent">Concurrent downloads</Label>
            <Input
              id="concurrent"
              type="number"
              min={1}
              max={8}
              value={settings.concurrentDownloads}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: {
                    ...settings,
                    concurrentDownloads: Number(e.target.value) || 1,
                  },
                })
              }
              onBlur={() =>
                update({ concurrentDownloads: settings.concurrentDownloads })
              }
            />
            <p className="text-xs text-muted-foreground">
              MVP runs one at a time; higher values reserved for the queue phase.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary"
              checked={settings.openFolderOnComplete}
              onChange={(e) => update({ openFolderOnComplete: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium">
                Open folder when download completes
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Reveals the file’s folder in your file manager after a successful download.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media tools</CardTitle>
          <CardDescription>
            Binary names or absolute paths. Never paste shell snippets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ytdlp">yt-dlp</Label>
            <Input
              id="ytdlp"
              value={settings.ytdlpPath}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: { ...settings, ytdlpPath: e.target.value },
                })
              }
              onBlur={() => update({ ytdlpPath: settings.ytdlpPath })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ffmpeg">FFmpeg</Label>
            <Input
              id="ffmpeg"
              value={settings.ffmpegPath}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: { ...settings, ffmpegPath: e.target.value },
                })
              }
              onBlur={() => update({ ffmpegPath: settings.ffmpegPath })}
            />
          </div>
          <Button disabled={saving} onClick={() => update(settings)}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
