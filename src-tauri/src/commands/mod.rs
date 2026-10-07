use crate::models::{
    AnalyzeResult, AppSettings, DownloadJob, HistoryEntry, StartDownloadRequest,
};
use crate::AppState;
use std::path::{Path, PathBuf};
use tauri::State;
use url::Url;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub message: String,
}

impl From<String> for CommandError {
    fn from(message: String) -> Self {
        Self { message }
    }
}

impl From<&str> for CommandError {
    fn from(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

fn validate_http_url(raw: &str) -> Result<String, CommandError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("URL is required".into());
    }
    if trimmed.len() > 2048 {
        return Err("URL is too long".into());
    }
    let parsed = Url::parse(trimmed).map_err(|_| "Invalid URL".to_string())?;
    match parsed.scheme() {
        "http" | "https" => Ok(trimmed.to_string()),
        _ => Err("Only http and https URLs are supported".into()),
    }
}

fn resolve_reveal_path(raw: &str, download_dir: &str) -> Result<PathBuf, CommandError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 4096 {
        return Err("Invalid path".into());
    }
    if trimmed.contains('\0') {
        return Err("Invalid path".into());
    }

    let path = PathBuf::from(trimmed);
    let canonical = path
        .canonicalize()
        .map_err(|_| format!("Path not found: {trimmed}"))?;

    let base = Path::new(download_dir);
    let base_canonical = base.canonicalize().unwrap_or_else(|_| base.to_path_buf());

    if !canonical.starts_with(&base_canonical) && canonical != base_canonical {
        return Err("Path is outside the download folder".into());
    }

    Ok(canonical)
}

#[tauri::command]
pub fn analyze_url(state: State<'_, AppState>, url: String) -> Result<AnalyzeResult, CommandError> {
    let url = validate_http_url(&url)?;
    let settings = state
        .db
        .get_settings()
        .map_err(|e| CommandError::from(e.to_string()))?;
    crate::media::analyze_url(&settings.ytdlp_path, &url)
        .map_err(|e| CommandError::from(e.to_string()))
}

#[tauri::command]
pub fn start_download(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: StartDownloadRequest,
) -> Result<DownloadJob, CommandError> {
    let url = validate_http_url(&request.url)?;
    let format_id = request.format_id.trim().to_string();
    if format_id.is_empty() || format_id.len() > 128 {
        return Err("Invalid formatId".into());
    }
    if let Some(ref dir) = request.output_dir {
        let dir = dir.trim();
        if dir.is_empty() || dir.len() > 1024 {
            return Err("Invalid output directory".into());
        }
    }

    let req = StartDownloadRequest {
        url,
        format_id,
        title: request.title,
        output_dir: request.output_dir,
        convert_to_mp3: request.convert_to_mp3,
    };

    state
        .engine
        .start(app, req)
        .map_err(|e| CommandError::from(e.to_string()))
}

#[tauri::command]
pub fn cancel_download(state: State<'_, AppState>, job_id: String) -> Result<(), CommandError> {
    let job_id = job_id.trim();
    if job_id.is_empty() || job_id.len() > 64 {
        return Err("Invalid job id".into());
    }
    state
        .engine
        .cancel(job_id)
        .map_err(|e| CommandError::from(e.to_string()))
}

#[tauri::command]
pub fn list_history(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<HistoryEntry>, CommandError> {
    let limit = limit.unwrap_or(100).clamp(1, 500);
    state
        .db
        .list_history(limit)
        .map_err(|e| CommandError::from(e.to_string()))
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, CommandError> {
    state
        .db
        .get_settings()
        .map_err(|e| CommandError::from(e.to_string()))
}

#[tauri::command]
pub fn update_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, CommandError> {
    if settings.download_dir.trim().is_empty() || settings.download_dir.len() > 1024 {
        return Err("Invalid download directory".into());
    }
    if settings.ytdlp_path.trim().is_empty() || settings.ytdlp_path.len() > 512 {
        return Err("Invalid yt-dlp path".into());
    }
    if settings.ffmpeg_path.trim().is_empty() || settings.ffmpeg_path.len() > 512 {
        return Err("Invalid FFmpeg path".into());
    }
    if !(1..=8).contains(&settings.concurrent_downloads) {
        return Err("concurrentDownloads must be between 1 and 8".into());
    }

    let cleaned = AppSettings {
        download_dir: settings.download_dir.trim().to_string(),
        ytdlp_path: settings.ytdlp_path.trim().to_string(),
        ffmpeg_path: settings.ffmpeg_path.trim().to_string(),
        concurrent_downloads: settings.concurrent_downloads,
        open_folder_on_complete: settings.open_folder_on_complete,
    };

    state
        .db
        .update_settings(&cleaned)
        .map_err(|e| CommandError::from(e.to_string()))?;
    Ok(cleaned)
}

#[tauri::command]
pub fn list_active_downloads(state: State<'_, AppState>) -> Result<Vec<DownloadJob>, CommandError> {
    Ok(state.engine.list_active())
}

#[tauri::command]
pub fn reveal_in_folder(state: State<'_, AppState>, path: String) -> Result<(), CommandError> {
    let settings = state
        .db
        .get_settings()
        .map_err(|e| CommandError::from(e.to_string()))?;
    let resolved = resolve_reveal_path(&path, &settings.download_dir)?;
    crate::media::reveal_in_file_manager(&resolved)
        .map_err(|e| CommandError::from(e.to_string()))
}
