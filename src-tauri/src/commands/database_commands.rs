use serde::Serialize;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::try_lock_db;
use crate::commands::AppState;
use crate::infra::db::connection::DatabaseInfo;

#[derive(Debug, Serialize)]
pub struct DatabaseInfoDto {
    /// Main DB file size in bytes
    pub db_size_bytes: u64,
    /// WAL file size in bytes (0 if not present)
    pub wal_size_bytes: u64,
    /// Total size (db + wal) in bytes
    pub total_size_bytes: u64,
}

impl From<DatabaseInfo> for DatabaseInfoDto {
    fn from(info: DatabaseInfo) -> Self {
        Self {
            db_size_bytes: info.db_size_bytes,
            wal_size_bytes: info.wal_size_bytes,
            total_size_bytes: info.total_size_bytes,
        }
    }
}

#[tauri::command]
pub fn get_database_info(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    let db = try_lock_db(&state.db)?;
    Ok(db.database_info().map_err(AppError::from)?.into())
}

#[tauri::command]
pub fn vacuum_database(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    if state.syncing.load(std::sync::atomic::Ordering::SeqCst) {
        return Err(AppError::UserVisible {
            message: "Database optimization is unavailable while syncing. Try again after sync completes.".to_string(),
        });
    }

    let mut db = try_lock_db(&state.db)?;
    Ok(db.vacuum().map_err(AppError::from)?.into())
}
