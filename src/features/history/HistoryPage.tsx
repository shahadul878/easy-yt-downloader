import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDownloadStore } from "@/stores/downloadStore";

export function HistoryPage() {
  const history = useDownloadStore((s) => s.history);
  const refreshHistory = useDownloadStore((s) => s.refreshHistory);
  const retryDownload = useDownloadStore((s) => s.retryDownload);
  const openFolder = useDownloadStore((s) => s.openFolder);
  const starting = useDownloadStore((s) => s.starting);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">History</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent downloads stored locally in SQLite.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshHistory()}>
          Refresh
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>
            Retry failed downloads or open completed files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-border px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.url}
                    </p>
                    {entry.error ? (
                      <p className="mt-1 text-xs text-destructive">{entry.error}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {entry.status === "failed" || entry.status === "cancelled" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={starting}
                        onClick={() =>
                          retryDownload({
                            url: entry.url,
                            title: entry.title,
                            formatId: entry.formatId,
                            convertToMp3: entry.convertToMp3,
                          })
                        }
                      >
                        Retry
                      </Button>
                    ) : null}
                    {entry.outputPath ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openFolder(entry.outputPath!)}
                      >
                        Open folder
                      </Button>
                    ) : null}
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground">
                      {entry.status}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {entry.formatId}
                  {entry.outputPath ? ` · ${entry.outputPath}` : ""}
                  {" · "}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
