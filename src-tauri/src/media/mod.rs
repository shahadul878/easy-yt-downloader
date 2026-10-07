use crate::models::{
    AnalyzeResult, FormatKind, FormatOption, MediaInfo, PlaylistEntry, PlaylistInfo,
};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use thiserror::Error;
use which::which;

#[derive(Debug, Error)]
pub enum MediaError {
    #[error("binary not found: {0}")]
    BinaryNotFound(String),
    #[error("process failed: {0}")]
    Process(String),
    #[error("failed to parse yt-dlp JSON: {0}")]
    Parse(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub fn resolve_binary(configured: &str, fallback_names: &[&str]) -> Result<PathBuf, MediaError> {
    let configured = configured.trim();
    if !configured.is_empty() {
        let as_path = Path::new(configured);
        if as_path.is_file() {
            return Ok(as_path.to_path_buf());
        }
        if let Ok(found) = which(configured) {
            return Ok(found);
        }
    }

    for name in fallback_names {
        if let Ok(found) = which(name) {
            return Ok(found);
        }
    }

    Err(MediaError::BinaryNotFound(
        configured
            .to_string()
            .if_empty(fallback_names.first().copied().unwrap_or("binary")),
    ))
}

trait IfEmpty {
    fn if_empty(self, fallback: &str) -> String;
}

impl IfEmpty for String {
    fn if_empty(self, fallback: &str) -> String {
        if self.is_empty() {
            fallback.to_string()
        } else {
            self
        }
    }
}

fn run_ytdlp_json(binary: &Path, args: &[&str]) -> Result<Value, MediaError> {
    let output = Command::new(binary)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::Process(stderr.trim().to_string()));
    }

    serde_json::from_slice(&output.stdout).map_err(|e| MediaError::Parse(e.to_string()))
}

pub fn analyze_url(ytdlp_path: &str, url: &str) -> Result<AnalyzeResult, MediaError> {
    let binary = resolve_binary(ytdlp_path, &["yt-dlp", "yt_dlp"])?;

    // Flat playlist first — fast listing when the URL is a playlist.
    let flat = run_ytdlp_json(
        &binary,
        &[
            "--flat-playlist",
            "--no-warnings",
            "--dump-single-json",
            "--no-download",
            url,
        ],
    )?;

    let type_name = flat.get("_type").and_then(|v| v.as_str()).unwrap_or("");
    let entries = flat.get("entries").and_then(|v| v.as_array());
    let looks_like_playlist = type_name == "playlist"
        || (entries.is_some()
            && flat
                .get("formats")
                .and_then(|v| v.as_array())
                .map(|a| a.is_empty())
                .unwrap_or(true));

    if looks_like_playlist {
        if let Some(playlist) = parse_playlist_info(&flat, url)? {
            if !playlist.entries.is_empty() {
                return Ok(AnalyzeResult::Playlist { playlist });
            }
        }
    }

    // Single media (ignore surrounding playlist if present on watch URLs).
    let value = run_ytdlp_json(
        &binary,
        &[
            "--no-playlist",
            "--no-warnings",
            "--dump-single-json",
            "--no-download",
            url,
        ],
    )?;
    let media = parse_media_info(&value)?;
    Ok(AnalyzeResult::Media { media })
}

fn parse_playlist_info(value: &Value, fallback_url: &str) -> Result<Option<PlaylistInfo>, MediaError> {
    let Some(arr) = value.get("entries").and_then(|v| v.as_array()) else {
        return Ok(None);
    };

    let id = value
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("playlist")
        .to_string();
    let title = value
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Playlist")
        .to_string();
    let webpage_url = value
        .get("webpage_url")
        .or_else(|| value.get("original_url"))
        .and_then(|v| v.as_str())
        .unwrap_or(fallback_url)
        .to_string();
    let uploader = value
        .get("uploader")
        .or_else(|| value.get("channel"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut entries = Vec::new();
    for (index, entry) in arr.iter().enumerate() {
        if entry.is_null() {
            continue;
        }
        let entry_id = entry
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("item-{index}"));
        let entry_title = entry
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled")
            .to_string();
        let entry_url = entry
            .get("url")
            .or_else(|| entry.get("webpage_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                if entry_id.starts_with("http") {
                    Some(entry_id.clone())
                } else {
                    Some(format!("https://www.youtube.com/watch?v={entry_id}"))
                }
            })
            .unwrap_or_default();
        if entry_url.is_empty() {
            continue;
        }
        entries.push(PlaylistEntry {
            id: entry_id,
            title: entry_title,
            url: entry_url,
            thumbnail: entry
                .get("thumbnail")
                .or_else(|| {
                    entry
                        .get("thumbnails")
                        .and_then(|t| t.as_array())
                        .and_then(|a| a.last())
                        .and_then(|t| t.get("url"))
                })
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            duration: entry.get("duration").and_then(|v| v.as_f64()),
            uploader: entry
                .get("uploader")
                .or_else(|| entry.get("channel"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        });
    }

    Ok(Some(PlaylistInfo {
        id,
        title,
        webpage_url,
        uploader,
        entries,
    }))
}

fn parse_media_info(value: &Value) -> Result<MediaInfo, MediaError> {
    let id = value
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let title = value
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();
    let webpage_url = value
        .get("webpage_url")
        .or_else(|| value.get("original_url"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let thumbnail = value
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let duration = value.get("duration").and_then(|v| v.as_f64());
    let uploader = value
        .get("uploader")
        .or_else(|| value.get("channel"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut formats = Vec::new();
    if let Some(arr) = value.get("formats").and_then(|v| v.as_array()) {
        for fmt in arr {
            if let Some(option) = parse_format(fmt) {
                formats.push(option);
            }
        }
    }

    formats.sort_by(|a, b| {
        b.tbr
            .partial_cmp(&a.tbr)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(MediaInfo {
        id,
        title,
        webpage_url,
        thumbnail,
        duration,
        uploader,
        formats,
    })
}

fn parse_format(fmt: &Value) -> Option<FormatOption> {
    let format_id = fmt.get("format_id")?.as_str()?.to_string();
    let ext = fmt
        .get("ext")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let vcodec = fmt
        .get("vcodec")
        .and_then(|v| v.as_str())
        .filter(|s| *s != "none")
        .map(|s| s.to_string());
    let acodec = fmt
        .get("acodec")
        .and_then(|v| v.as_str())
        .filter(|s| *s != "none")
        .map(|s| s.to_string());

    let kind = match (vcodec.is_some(), acodec.is_some()) {
        (true, true) => FormatKind::Combined,
        (true, false) => FormatKind::Video,
        (false, true) => FormatKind::Audio,
        (false, false) => return None,
    };

    let height = fmt.get("height").and_then(|v| v.as_u64());
    let width = fmt.get("width").and_then(|v| v.as_u64());
    let resolution = match (width, height) {
        (Some(w), Some(h)) => Some(format!("{w}x{h}")),
        (None, Some(h)) => Some(format!("{h}p")),
        _ => fmt
            .get("resolution")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };

    Some(FormatOption {
        format_id,
        ext,
        resolution,
        fps: fmt.get("fps").and_then(|v| v.as_f64()),
        vcodec,
        acodec,
        filesize: fmt
            .get("filesize")
            .or_else(|| fmt.get("filesize_approx"))
            .and_then(|v| v.as_i64()),
        tbr: fmt.get("tbr").and_then(|v| v.as_f64()),
        format_note: fmt
            .get("format_note")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        kind,
    })
}

pub fn build_download_args(
    url: &str,
    format_id: &str,
    output_template: &str,
    ffmpeg_path: Option<&Path>,
    convert_to_mp3: bool,
) -> Result<Vec<String>, MediaError> {
    let mut args = vec![
        "--no-playlist".to_string(),
        "--newline".to_string(),
        "--progress".to_string(),
        "-o".to_string(),
        output_template.to_string(),
        "--no-mtime".to_string(),
    ];

    if convert_to_mp3 {
        if ffmpeg_path.is_none() {
            return Err(MediaError::BinaryNotFound(
                "ffmpeg (required for MP3 conversion)".to_string(),
            ));
        }
        // Prefer high-bitrate AAC when available, then any best audio, then best overall.
        let audio_selector = if format_id.is_empty()
            || format_id == "bestaudio"
            || format_id.starts_with("bestaudio")
        {
            "bestaudio[ext=m4a]/bestaudio/best".to_string()
        } else {
            format_id.to_string()
        };
        args.push("-f".to_string());
        args.push(audio_selector);
        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
        // 0 = best VBR quality for MP3 (yt-dlp / FFmpeg).
        args.push("--audio-quality".to_string());
        args.push("0".to_string());
        args.push("--embed-metadata".to_string());
    } else {
        let format_selector = if format_id.contains('+')
            || format_id.contains('*')
            || format_id.starts_with("best")
        {
            format_id.to_string()
        } else {
            // Prefer pairing video-only picks with best audio when FFmpeg can merge.
            format!("{format_id}+bestaudio/{format_id}")
        };
        args.push("-f".to_string());
        args.push(format_selector);
    }

    if let Some(ffmpeg) = ffmpeg_path {
        args.push("--ffmpeg-location".to_string());
        args.push(ffmpeg.to_string_lossy().to_string());
    }

    args.push(url.to_string());
    Ok(args)
}

pub fn spawn_download(
    ytdlp_path: &Path,
    args: &[String],
) -> Result<std::process::Child, MediaError> {
    Command::new(ytdlp_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(MediaError::from)
}

/// Open a file or folder in the system file manager (argv only, never shell).
pub fn reveal_in_file_manager(path: &Path) -> Result<(), MediaError> {
    if !path.exists() {
        return Err(MediaError::Process(format!(
            "path does not exist: {}",
            path.display()
        )));
    }

    let folder = if path.is_file() {
        path.parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| path.to_path_buf())
    } else {
        path.to_path_buf()
    };

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&folder)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(MediaError::from)?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&folder)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(MediaError::from)?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&folder)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(MediaError::from)?;
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        return Err(MediaError::Process(
            "opening folders is not supported on this platform".into(),
        ));
    }

    Ok(())
}
