use crate::db::Database;
use crate::media::{self, MediaError};
use crate::models::{
    DownloadErrorEvent, DownloadFinishedEvent, DownloadJob, DownloadProgressEvent, DownloadStatus,
    StartDownloadRequest,
};
use chrono::Utc;
use parking_lot::Mutex;
use regex::Regex;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::Child;
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("{0}")]
    Media(#[from] MediaError),
    #[error("database error: {0}")]
    Db(String),
    #[error("download not found: {0}")]
    NotFound(String),
    #[error("invalid request: {0}")]
    Invalid(String),
}

struct ActiveDownload {
    child: Child,
}

pub struct DownloadEngine {
    db: Arc<Database>,
    active: Arc<Mutex<HashMap<String, ActiveDownload>>>,
    jobs: Arc<Mutex<HashMap<String, DownloadJob>>>,
}

impl DownloadEngine {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            active: Arc::new(Mutex::new(HashMap::new())),
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn list_active(&self) -> Vec<DownloadJob> {
        self.jobs.lock().values().cloned().collect()
    }

    pub fn start(
        &self,
        app: AppHandle,
        request: StartDownloadRequest,
    ) -> Result<DownloadJob, EngineError> {
        if request.url.trim().is_empty() {
            return Err(EngineError::Invalid("URL is required".into()));
        }
        if request.format_id.trim().is_empty() {
            return Err(EngineError::Invalid("formatId is required".into()));
        }

        let settings = self
            .db
            .get_settings()
            .map_err(|e| EngineError::Db(e.to_string()))?;

        let output_dir = request
            .output_dir
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| settings.download_dir.clone());

        std::fs::create_dir_all(&output_dir)
            .map_err(|e| EngineError::Invalid(format!("cannot create output dir: {e}")))?;

        let ytdlp = media::resolve_binary(&settings.ytdlp_path, &["yt-dlp", "yt_dlp"])?;
        let ffmpeg = media::resolve_binary(&settings.ffmpeg_path, &["ffmpeg"]).ok();

        if request.convert_to_mp3 && ffmpeg.is_none() {
            return Err(EngineError::Invalid(
                "FFmpeg is required to convert to MP3. Install ffmpeg or set its path in Settings."
                    .into(),
            ));
        }

        let job_id = Uuid::new_v4().to_string();
        let title = request
            .title
            .filter(|t| !t.trim().is_empty())
            .unwrap_or_else(|| "Download".to_string());
        let created_at = Utc::now();

        let job = DownloadJob {
            id: job_id.clone(),
            url: request.url.clone(),
            title: title.clone(),
            format_id: request.format_id.clone(),
            convert_to_mp3: request.convert_to_mp3,
            status: DownloadStatus::Running,
            progress: 0.0,
            speed: None,
            eta: None,
            output_path: None,
            error: None,
            created_at,
        };

        self.db
            .insert_history(
                &job.id,
                &job.url,
                &job.title,
                &job.format_id,
                "running",
                &created_at.to_rfc3339(),
                request.convert_to_mp3,
            )
            .map_err(|e| EngineError::Db(e.to_string()))?;

        let output_template = PathBuf::from(&output_dir)
            .join("%(title).200B [%(id)s].%(ext)s")
            .to_string_lossy()
            .to_string();

        let args = media::build_download_args(
            &request.url,
            &request.format_id,
            &output_template,
            ffmpeg.as_deref(),
            request.convert_to_mp3,
        )?;

        let mut child = media::spawn_download(&ytdlp, &args)?;
        // yt-dlp writes progress and status lines to stderr.
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| EngineError::Invalid("missing stderr".into()))?;

        self.jobs.lock().insert(job_id.clone(), job.clone());
        self.active
            .lock()
            .insert(job_id.clone(), ActiveDownload { child });

        let db = self.db.clone();
        let jobs = self.jobs.clone();
        let active = self.active.clone();

        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            let progress_re = Regex::new(r"\[download\]\s+(\d+(?:\.\d+)?)%").expect("progress regex");
            let speed_re = Regex::new(r"at\s+(\S+)").expect("speed regex");
            let eta_re = Regex::new(r"ETA\s+(\S+)").expect("eta regex");
            let dest_re =
                Regex::new(r"\[download\] Destination: (.+)").expect("destination regex");
            let merge_re =
                Regex::new(r#"\[Merger\] Merging formats into "(.+)""#).expect("merge regex");
            let extract_re =
                Regex::new(r"\[ExtractAudio\] Destination: (.+)").expect("extract regex");
            let already_re = Regex::new(r"\[download\] (.+) has already been downloaded")
                .expect("already regex");

            let mut last_output: Option<String> = None;
            let mut error_lines: Vec<String> = Vec::new();

            for line in reader.lines().flatten() {
                if let Some(caps) = dest_re.captures(&line) {
                    last_output = Some(caps[1].to_string());
                }
                if let Some(caps) = merge_re.captures(&line) {
                    last_output = Some(caps[1].to_string());
                }
                if let Some(caps) = extract_re.captures(&line) {
                    last_output = Some(caps[1].to_string());
                }
                if let Some(caps) = already_re.captures(&line) {
                    last_output = Some(caps[1].to_string());
                }

                let lower = line.to_lowercase();
                if lower.contains("error")
                    || lower.contains("unable")
                    || lower.contains("failed")
                    || lower.contains("http error")
                {
                    if error_lines.len() < 8 {
                        error_lines.push(line.clone());
                    }
                }

                if let Some(caps) = progress_re.captures(&line) {
                    if let Ok(progress) = caps[1].parse::<f64>() {
                        let speed = speed_re.captures(&line).map(|c| c[1].to_string());
                        let eta = eta_re.captures(&line).map(|c| c[1].to_string());

                        if let Some(job) = jobs.lock().get_mut(&job_id) {
                            job.progress = progress;
                            job.speed = speed.clone();
                            job.eta = eta.clone();
                            job.status = DownloadStatus::Running;
                        }

                        let _ = app.emit(
                            "download-progress",
                            DownloadProgressEvent {
                                job_id: job_id.clone(),
                                progress,
                                speed,
                                eta,
                                status: DownloadStatus::Running,
                            },
                        );
                    }
                }
            }

            let exit_ok = {
                let mut guard = active.lock();
                if let Some(mut entry) = guard.remove(&job_id) {
                    entry.child.wait().map(|s| s.success()).unwrap_or(false)
                } else {
                    // Cancelled — child already reaped
                    false
                }
            };

            let cancelled = jobs
                .lock()
                .get(&job_id)
                .map(|j| j.status == DownloadStatus::Cancelled)
                .unwrap_or(false);

            if cancelled {
                let _ = app.emit(
                    "download-finished",
                    DownloadFinishedEvent {
                        job_id,
                        output_path: None,
                        status: DownloadStatus::Cancelled,
                    },
                );
                return;
            }

            let finished_at = Utc::now().to_rfc3339();
            let (status, error) = if exit_ok {
                (DownloadStatus::Completed, None)
            } else {
                let detail = if error_lines.is_empty() {
                    "Download process exited with an error".to_string()
                } else {
                    format!(
                        "Download process exited with an error: {}",
                        error_lines.join(" | ")
                    )
                };
                (DownloadStatus::Failed, Some(detail))
            };

            let status_str = match status {
                DownloadStatus::Completed => "completed",
                DownloadStatus::Failed => "failed",
                DownloadStatus::Cancelled => "cancelled",
                _ => "failed",
            };

            let _ = db.finalize_history(
                &job_id,
                status_str,
                last_output.as_deref(),
                error.as_deref(),
                &finished_at,
            );

            if let Some(job) = jobs.lock().get_mut(&job_id) {
                job.status = status.clone();
                job.output_path = last_output.clone();
                job.error = error.clone();
                if exit_ok {
                    job.progress = 100.0;
                }
            }

            if exit_ok {
                let _ = app.emit(
                    "download-finished",
                    DownloadFinishedEvent {
                        job_id,
                        output_path: last_output,
                        status,
                    },
                );
            } else {
                let _ = app.emit(
                    "download-error",
                    DownloadErrorEvent {
                        job_id,
                        error: error.unwrap_or_else(|| "Unknown error".into()),
                    },
                );
            }
        });

        Ok(job)
    }

    pub fn cancel(&self, job_id: &str) -> Result<(), EngineError> {
        let mut active = self.active.lock();
        let Some(mut entry) = active.remove(job_id) else {
            return Err(EngineError::NotFound(job_id.to_string()));
        };
        let _ = entry.child.kill();
        let _ = entry.child.wait();
        drop(active);

        if let Some(job) = self.jobs.lock().get_mut(job_id) {
            job.status = DownloadStatus::Cancelled;
        }

        let _ = self.db.finalize_history(
            job_id,
            "cancelled",
            None,
            Some("Cancelled by user"),
            &Utc::now().to_rfc3339(),
        );

        Ok(())
    }
}
