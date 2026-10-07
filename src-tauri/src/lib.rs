mod commands;
mod db;
mod engine;
mod media;
mod models;

use db::Database;
use engine::DownloadEngine;
use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub db: Arc<Database>,
    pub engine: Arc<DownloadEngine>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data)?;

            let db_path = app_data.join("easy-downloader.db");
            let db = Arc::new(Database::open(&db_path)?);
            db.migrate()?;

            let engine = Arc::new(DownloadEngine::new(db.clone()));
            app.manage(AppState {
                db,
                engine,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_url,
            commands::start_download,
            commands::cancel_download,
            commands::list_history,
            commands::get_settings,
            commands::update_settings,
            commands::list_active_downloads,
            commands::reveal_in_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Easy Downloader");
}
