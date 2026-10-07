import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDownloadStore } from "@/stores/downloadStore";

export function DownloadsPage() {
  const jobs = useDownloadStore((s) => s.jobs);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const retryDownload = useDownloadStore((s) => s.retryDownload);
  const openFolder = useDownloadStore((s) => s.openFolder);
  const starting = useDownloadStore((s) => s.starting);
  const error = useDownloadStore((s) => s.error);

  const active = jobs.filter(
    (j) => j.status === "running" || j.status === "queued",
  );
  const recent = jobs.filter(
    (j) => j.status !== "running" && j.status !== "queued",
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Downloads</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Active transfers and recent session jobs.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Active</CardTitle>
          <CardDescription>
            Queue and playlist downloads appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active downloads.</p>
          ) : (
            active.map((job) => (
              <div
                key={job.id}
                className="rounded-md border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.formatId}
                      {job.speed ? ` · ${job.speed}` : ""}
                      {job.eta ? ` · ETA ${job.eta}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelDownload(job.id)}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="mt-3 space-y-1">
                  <Progress value={job.progress} />
                  <p className="text-xs text-muted-foreground">
                    {job.progress.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finished jobs yet.</p>
          ) : (
            recent.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {job.status}
                    {job.outputPath ? ` · ${job.outputPath}` : ""}
                    {job.error ? ` · ${job.error}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {job.status === "failed" || job.status === "cancelled" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={starting}
                      onClick={() =>
                        retryDownload({
                          url: job.url,
                          title: job.title,
                          formatId: job.formatId,
                          convertToMp3: job.convertToMp3,
                        })
                      }
                    >
                      Retry
                    </Button>
                  ) : null}
                  {job.status === "completed" && job.outputPath ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openFolder(job.outputPath!)}
                    >
                      Open folder
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
