# Easy Downloader

Professional desktop download manager built with Tauri 2, React, TypeScript, and yt-dlp.

Use only for content you own, have permission to download, or are legally permitted to save.

## Stack

- React + TypeScript + Vite + Tailwind + shadcn-style UI
- Zustand state management
- Tauri 2 (Rust)
- SQLite (rusqlite)
- yt-dlp + FFmpeg

## Prerequisites

- Node.js 18+
- Rust (stable)
- Linux Tauri deps (Ubuntu/Zorin example):

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  patchelf libglib2.0-dev
```

- `yt-dlp` and `ffmpeg` on PATH (or configure absolute paths in Settings)

## Develop

```bash
npm install
npm run tauri:dev
```

Frontend only (no native APIs — shows the web landing):

```bash
npm run dev
```

## Deploy web UI on Vercel

The Vite frontend is a static SPA. Vercel hosts the landing page only — analyze/download still require the Tauri desktop app (yt-dlp + FFmpeg cannot run on Vercel).

1. Push this repo to GitHub/GitLab/Bitbucket
2. Import the project in [Vercel](https://vercel.com/new)
3. Framework preset: **Vite** (or leave defaults from `vercel.json`)
4. Build command: `npm run build` · Output: `dist` · Node 20+
5. Deploy

Local production check:

```bash
npm run build && npm run preview
```

## Quality checks

```bash
npm run typecheck
npm run lint
cd src-tauri && cargo check
```

## Architecture

| Layer | Path |
|-------|------|
| UI | `src/components`, `src/features` |
| State | `src/stores` |
| Typed IPC | `src/lib/tauri.ts` |
| Commands | `src-tauri/src/commands` |
| Engine | `src-tauri/src/engine` |
| Database | `src-tauri/src/db` |
| Media | `src-tauri/src/media` |

## MVP status

Implemented: analyze URL, select formats, single download with progress, history list, settings.

Later: multi-item queue, playlists, rich file management, installers.
