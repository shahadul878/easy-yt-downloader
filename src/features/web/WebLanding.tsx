import { Download, Monitor, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  "Clone the repo and install Node 20+",
  "Install Rust, yt-dlp, and FFmpeg",
  "Run npm install && npm run tauri:dev",
];

export function WebLanding() {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 15% 10%, hsl(199 50% 22% / 0.45), transparent), radial-gradient(ellipse 50% 40% at 90% 80%, hsl(220 25% 14% / 0.7), transparent)",
        }}
      />

      <header className="relative z-10 px-6 py-5 sm:px-10">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Easy
        </p>
        <p className="text-lg font-semibold tracking-tight">Downloader</p>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-16 pt-8 sm:px-10">
        <p className="text-sm font-medium text-primary">Desktop download manager</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Easy Downloader
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Analyze permitted media URLs, pick formats, and download with yt-dlp and FFmpeg —
          on your machine, not in the browser.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a href="#get-desktop">
              <Monitor className="h-4 w-4" aria-hidden />
              Get the desktop app
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#why-desktop">
              <Shield className="h-4 w-4" aria-hidden />
              Why desktop only
            </a>
          </Button>
        </div>

        <section id="why-desktop" className="mt-16 scroll-mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Why this site is not the app</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Downloads need a local process (yt-dlp), FFmpeg, and your filesystem. Vercel hosts
            this UI only — the full product runs as a Tauri desktop window.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Download,
                title: "Local media tools",
                body: "yt-dlp and FFmpeg run on your computer with argv-only process spawning.",
              },
              {
                icon: Shield,
                title: "Your files stay local",
                body: "SQLite history and downloads never leave the machine you control.",
              },
              {
                icon: Monitor,
                title: "Native shell",
                body: "Tauri provides the desktop runtime this UI talks to over typed IPC.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  <p className="mt-3 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="get-desktop" className="mt-14 scroll-mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Run it locally</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-xs font-medium text-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <pre className="mt-5 overflow-x-auto rounded-lg border border-border bg-card/80 p-4 text-xs leading-relaxed text-foreground">
            <code>{`npm install\nnpm run tauri:dev`}</code>
          </pre>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 px-6 py-4 text-xs text-muted-foreground sm:px-10">
        Use only for content you own, have permission to download, or may legally save.
      </footer>
    </div>
  );
}
