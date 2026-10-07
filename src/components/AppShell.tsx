import type { ReactNode } from "react";
import {
  Download,
  History,
  Link2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore, type AppView } from "@/stores/uiStore";

const navItems: { id: AppView; label: string; icon: typeof Link2 }[] = [
  { id: "analyze", label: "Analyze", icon: Link2 },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-sm">
        <div className="px-5 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Easy
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            Downloader
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            For content you own or are permitted to save.
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border px-5 py-4 text-xs text-muted-foreground">
          v0.1.0 · Desktop
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
