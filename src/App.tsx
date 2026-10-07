import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { AppShell } from "@/components/AppShell";
import { AnalyzePage } from "@/features/analyze/AnalyzePage";
import { DownloadsPage } from "@/features/downloads/DownloadsPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { WebLanding } from "@/features/web/WebLanding";
import { useDownloadStore } from "@/stores/downloadStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";

function ViewRouter() {
  const view = useUiStore((s) => s.view);
  switch (view) {
    case "analyze":
      return <AnalyzePage />;
    case "downloads":
      return <DownloadsPage />;
    case "history":
      return <HistoryPage />;
    case "settings":
      return <SettingsPage />;
  }
}

export default function App() {
  const initDownloads = useDownloadStore((s) => s.init);
  const loadSettings = useSettingsStore((s) => s.load);
  const [desktop, setDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const inDesktop = isTauri();
    setDesktop(inDesktop);
    if (!inDesktop) return;
    void initDownloads();
    void loadSettings();
  }, [initDownloads, loadSettings]);

  if (desktop === null) {
    return <div className="h-full bg-background" aria-busy="true" />;
  }

  if (!desktop) {
    return <WebLanding />;
  }

  return (
    <AppShell>
      <ViewRouter />
    </AppShell>
  );
}
