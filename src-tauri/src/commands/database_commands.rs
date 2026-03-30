use serde::Serialize;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;

#[derive(Debug, Serialize)]
pub struct DatabaseInfoDto {
    /// Main DB file size in bytes
    pub db_size_bytes: u64,
    /// WAL file size in bytes (0 if not present)
    pub wal_size_bytes: u64,
    /// Total size (db + wal) in bytes
    pub total_size_bytes: u64,
}

#[tauri::command]
pub fn get_database_info(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let db_path: String = db
        .reader()
        .query_row("PRAGMA database_list", [], |row| row.get(2))
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to get database path: {e}"),
        })?;

    let path = std::path::Path::new(&db_path);
    let db_size_bytes = path.metadata().map(|m| m.len()).unwrap_or(0);

    let wal_path = path.with_extension("db-wal");
    let wal_size_bytes = wal_path.metadata().map(|m| m.len()).unwrap_or(0);

    Ok(DatabaseInfoDto {
        db_size_bytes,
        wal_size_bytes,
        total_size_bytes: db_size_bytes + wal_size_bytes,
    })
}

#[tauri::command]
pub fn vacuum_database(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;

    db.writer()
        .execute_batch("VACUUM")
        .map_err(|e| AppError::UserVisible {
            message: format!("VACUUM failed: {e}"),
        })?;

    // Return updated info after VACUUM
    let db_path: String = db
        .reader()
        .query_row("PRAGMA database_list", [], |row| row.get(2))
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to get database path: {e}"),
        })?;

    let path = std::path::Path::new(&db_path);
    let db_size_bytes = path.metadata().map(|m| m.len()).unwrap_or(0);

    let wal_path = path.with_extension("db-wal");
    let wal_size_bytes = wal_path.metadata().map(|m| m.len()).unwrap_or(0);

    Ok(DatabaseInfoDto {
        db_size_bytes,
        wal_size_bytes,
        total_size_bytes: db_size_bytes + wal_size_bytes,
    })
}
