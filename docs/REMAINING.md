# Remaining work after MVP bootstrap

## Blocked on this machine

- Tauri native compile needs Linux packages (`libwebkit2gtk-4.1-dev`, `libglib2.0-dev`, etc.). `cargo check` failed with missing `gobject-2.0` because sudo install was unavailable in this environment.
- Install deps, then:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  patchelf libglib2.0-dev
npm run tauri:dev
```

- Ensure `yt-dlp` and `ffmpeg` are on PATH (or set paths in Settings).
- This environment has `yt-dlp` (`~/.local/bin`); `ffmpeg` is not installed yet — install via `sudo apt install ffmpeg` for merge/remux.

## Passed locally

- `npm run typecheck`
- `npm run lint`

## Post-MVP gaps

- Persist and run a multi-item download queue with concurrency
- Playlist detection and selective item download
- File manager actions (reveal in folder, delete file + history row)
- Pause/resume, richer empty/error states, keyboard shortcuts
- Installer / packaging polish (`icon.icns` for macOS)
