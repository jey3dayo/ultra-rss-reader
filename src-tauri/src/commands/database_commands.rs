use serde::Serialize;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::start_database_maintenance;
use crate::commands::try_lock_db;
use crate::commands::AppState;
use crate::infra::db::connection::{DatabaseInfo, DbManager};

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
            shm_size_bytes: 0,
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

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;

    use crate::commands::database_commands::{get_database_info_inner, vacuum_database_inner};
    use crate::commands::dto::AppError;
    use crate::commands::start_database_maintenance;
    use crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR;
    use crate::infra::db::connection::DbManager;

    #[test]
    fn vacuum_database_returns_syncing_error_before_trying_db_lock() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let _guard = db.lock().unwrap();
        let syncing = AtomicBool::new(true);

        let error = vacuum_database_inner(&db, &syncing).expect_err("syncing should block vacuum");

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, DATABASE_MAINTENANCE_BUSY_ERROR);
            }
            other => panic!("expected user-visible syncing error, got {other:?}"),
        }
    }

    #[test]
    fn get_database_info_returns_busy_error_when_db_is_locked() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let _guard = db.lock().unwrap();

        let error =
            get_database_info_inner(&db).expect_err("busy DB should return command-level error");

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(
                    message,
                    "Database is busy. Wait for the current operation to finish and try again."
                );
            }
            other => panic!("expected user-visible busy error, got {other:?}"),
        }
    }

    #[test]
    fn vacuum_database_returns_busy_error_when_not_syncing_and_db_is_locked() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let _guard = db.lock().unwrap();
        let syncing = AtomicBool::new(false);

        let error =
            vacuum_database_inner(&db, &syncing).expect_err("busy DB should return an error");

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(
                    message,
                    "Database is busy. Wait for the current operation to finish and try again."
                );
            }
            other => panic!("expected user-visible busy error, got {other:?}"),
        }

        assert!(
            !syncing.load(Ordering::SeqCst),
            "vacuum should release the maintenance flag after errors"
        );
    }

    #[test]
    fn database_maintenance_guard_blocks_new_sync_and_releases_on_drop() {
        let syncing = AtomicBool::new(false);

        {
            let _guard = start_database_maintenance(&syncing).unwrap();
            assert!(
                syncing.load(Ordering::SeqCst),
                "maintenance should reserve the shared sync flag"
            );
        }

        assert!(
            !syncing.load(Ordering::SeqCst),
            "maintenance should release the shared sync flag"
        );
    }

    #[test]
    fn database_maintenance_guard_returns_syncing_error_when_flag_is_reserved() {
        let syncing = AtomicBool::new(true);

        let error =
            start_database_maintenance(&syncing).expect_err("reserved flag should block vacuum");

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, DATABASE_MAINTENANCE_BUSY_ERROR);
            }
            other => panic!("expected user-visible syncing error, got {other:?}"),
        }
        assert!(
            syncing.load(Ordering::SeqCst),
            "failed maintenance start should not clear another operation's flag"
        );
    }
}
