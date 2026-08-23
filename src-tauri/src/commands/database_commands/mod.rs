use serde::Serialize;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::start_database_maintenance;
use crate::commands::try_lock_db;
use crate::commands::AppState;
use crate::infra::db::connection::{DatabaseInfo, DbManager};

#[cfg(test)]
mod contracts;
#[cfg(test)]
pub(crate) use contracts::*;

#[derive(Debug, Serialize)]
pub struct DatabaseInfoDto {
    /// Main DB file size in bytes
    pub db_size_bytes: u64,
    /// WAL file size in bytes (0 if not present)
    pub wal_size_bytes: u64,
    /// SHM file size in bytes (0 if not present or unavailable)
    pub shm_size_bytes: u64,
    /// Display total size (db + wal + shm) in bytes
    pub total_size_bytes: u64,
}

impl From<DatabaseInfo> for DatabaseInfoDto {
    fn from(info: DatabaseInfo) -> Self {
        Self {
            db_size_bytes: info.db_size_bytes,
            wal_size_bytes: info.wal_size_bytes,
            shm_size_bytes: info.shm_size_bytes,
            total_size_bytes: info.total_size_bytes,
        }
    }
}

#[tauri::command]
pub fn get_database_info(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    get_database_info_inner(&state.db)
}

fn get_database_info_inner(db: &Mutex<DbManager>) -> Result<DatabaseInfoDto, AppError> {
    let db = try_lock_db(db)?;
    Ok(db.database_info().map_err(AppError::from)?.into())
}

#[tauri::command]
pub fn vacuum_database(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    vacuum_database_inner(&state.db, &state.syncing)
}

fn vacuum_database_inner(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
) -> Result<DatabaseInfoDto, AppError> {
    let _maintenance_guard = start_database_maintenance(syncing)?;

    let mut db = try_lock_db(db)?;
    Ok(db.vacuum().map_err(AppError::from)?.into())
}

#[tauri::command]
pub fn backup_database(state: State<'_, AppState>) -> Result<(), AppError> {
    backup_database_inner(&state.db, &state.syncing)
}

fn backup_database_inner(db: &Mutex<DbManager>, syncing: &AtomicBool) -> Result<(), AppError> {
    let _maintenance_guard = start_database_maintenance(syncing)?;

    let mut db = try_lock_db(db)?;
    db.create_manual_backup().map_err(AppError::from)?;
    Ok(())
}

#[cfg(test)]
mod tests;
