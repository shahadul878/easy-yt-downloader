use crate::models::{AppSettings, HistoryEntry};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("poisoned database lock")]
    Poisoned,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, DbError> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn migrate(&self) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::Poisoned)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY NOT NULL,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                format_id TEXT NOT NULL,
                status TEXT NOT NULL,
                output_path TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                finished_at TEXT,
                convert_to_mp3 INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
            "#,
        )?;

        // Older installs may lack convert_to_mp3; ignore if already present.
        let _ = conn.execute(
            "ALTER TABLE history ADD COLUMN convert_to_mp3 INTEGER NOT NULL DEFAULT 0",
            [],
        );

        Ok(())
    }

    pub fn get_settings(&self) -> Result<AppSettings, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::Poisoned)?;
        let value: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params!["app"],
                |row| row.get(0),
            )
            .optional()?;

        match value {
            Some(raw) => Ok(serde_json::from_str(&raw)?),
            None => {
                let defaults = AppSettings::default();
                drop(conn);
                self.update_settings(&defaults)?;
                Ok(defaults)
            }
        }
    }

    pub fn update_settings(&self, settings: &AppSettings) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::Poisoned)?;
        let raw = serde_json::to_string(settings)?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params!["app", raw],
        )?;
        Ok(())
    }

    pub fn insert_history(
        &self,
        id: &str,
        url: &str,
        title: &str,
        format_id: &str,
        status: &str,
        created_at: &str,
        convert_to_mp3: bool,
    ) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::Poisoned)?;
        conn.execute(
            "INSERT INTO history (id, url, title, format_id, status, created_at, convert_to_mp3)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                url,
                title,
                format_id,
                status,
                created_at,
                if convert_to_mp3 { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn finalize_history(
        &self,
        id: &str,
        status: &str,
        output_path: Option<&str>,
        error: Option<&str>,
        finished_at: &str,
    ) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::Poisoned)?;
        conn.execute(
            "UPDATE history
             SET status = ?1, output_path = ?2, error = ?3, finished_at = ?4
             WHERE id = ?5",
            params![status, output_path, error, finished_at, id],
        )?;
        Ok(())
    }

    pub fn list_history(&self, limit: i64) -> Result<Vec<HistoryEntry>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::Poisoned)?;
        let mut stmt = conn.prepare(
            "SELECT id, url, title, format_id, status, output_path, error, created_at, finished_at,
                    COALESCE(convert_to_mp3, 0)
             FROM history
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            let convert_flag: i64 = row.get(9)?;
            Ok(HistoryEntry {
                id: row.get(0)?,
                url: row.get(1)?,
                title: row.get(2)?,
                format_id: row.get(3)?,
                status: row.get(4)?,
                output_path: row.get(5)?,
                error: row.get(6)?,
                created_at: row.get(7)?,
                finished_at: row.get(8)?,
                convert_to_mp3: convert_flag != 0,
            })
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row?);
        }
        Ok(entries)
    }
}
