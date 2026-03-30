use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use tracing::{info, warn};

use crate::domain::error::{DomainError, DomainResult};

/// Return the `backups/` subdirectory next to the DB file.
fn backups_dir(db_path: &Path) -> DomainResult<PathBuf> {
    let parent = db_path
        .parent()
        .ok_or_else(|| DomainError::Migration("Cannot determine DB parent directory".into()))?;
    Ok(parent.join("backups"))
}

/// Derive the stem used in backup filenames (e.g. `ultra-rss-reader`).
fn db_stem(db_path: &Path) -> &str {
    db_path.file_stem().and_then(|s| s.to_str()).unwrap_or("db")
}

/// Generate a timestamped backup filename.
/// Format: `<stem>_v<version>_<YYYYMMDD>T<HHMMSS>.db`
fn timestamped_backup_name(db_path: &Path, schema_version: i32) -> String {
    let stem = db_stem(db_path);
    let ts = Local::now().format("%Y%m%dT%H%M%S");
    format!("{stem}_v{schema_version}_{ts}.db")
}

/// Generate backup path inside `backups/` subdirectory: `<parent>/backups/<stem>_v<version>_<timestamp>.db`
pub fn backup_path(db_path: &Path, schema_version: i32) -> PathBuf {
    let dir = backups_dir(db_path).unwrap_or_else(|_| db_path.to_path_buf());
    dir.join(timestamped_backup_name(db_path, schema_version))
}

/// Generate WAL/SHM backup path by appending suffix inside `backups/`.
fn auxiliary_backup_path(base_backup: &Path, suffix: &str) -> PathBuf {
    let mut name = base_backup.as_os_str().to_owned();
    name.push(format!("-{suffix}"));
    PathBuf::from(name)
}

/// Copy the SQLite file to a backup location before migration.
/// WAL and SHM files are also copied if they exist.
/// Returns the path to the backup file.
pub fn create_backup(db_path: &Path, schema_version: i32) -> DomainResult<PathBuf> {
    let dir = backups_dir(db_path)?;
    fs::create_dir_all(&dir).map_err(|e| {
        DomainError::Migration(format!(
            "Failed to create backup directory {}: {e}",
            dir.display()
        ))
    })?;

    let dest = backup_path(db_path, schema_version);

    info!(
        "Creating DB backup: {} -> {}",
        db_path.display(),
        dest.display()
    );

    fs::copy(db_path, &dest).map_err(|e| {
        DomainError::Migration(format!(
            "Failed to backup database {}: {e}",
            db_path.display()
        ))
    })?;

    // Copy WAL and SHM if they exist (SQLite WAL mode)
    for suffix in &["wal", "shm"] {
        let mut src_name = db_path.as_os_str().to_owned();
        src_name.push(format!("-{suffix}"));
        let src = PathBuf::from(src_name);
        if src.exists() {
            let aux_dest = auxiliary_backup_path(&dest, suffix);
            fs::copy(&src, &aux_dest).map_err(|e| {
                DomainError::Migration(format!("Failed to backup {}: {e}", src.display()))
            })?;
        }
    }

    Ok(dest)
}

/// Restore the database from a backup file, replacing the current DB.
pub fn restore_backup(db_path: &Path, backup: &Path) -> DomainResult<()> {
    info!(
        "Restoring DB from backup: {} -> {}",
        backup.display(),
        db_path.display()
    );

    fs::copy(backup, db_path).map_err(|e| {
        DomainError::Migration(format!(
            "Failed to restore database from {}: {e}",
            backup.display()
        ))
    })?;

    // Restore or remove WAL/SHM
    for suffix in &["wal", "shm"] {
        let mut aux_name = db_path.as_os_str().to_owned();
        aux_name.push(format!("-{suffix}"));
        let aux_current = PathBuf::from(aux_name);
        let aux_backup = auxiliary_backup_path(backup, suffix);
        if aux_backup.exists() {
            fs::copy(&aux_backup, &aux_current).map_err(|e| {
                DomainError::Migration(format!("Failed to restore {}: {e}", aux_current.display()))
            })?;
        } else {
            // Remove stale WAL/SHM that doesn't match the backup
            let _ = fs::remove_file(&aux_current);
        }
    }

    Ok(())
}

/// Remove old backup files in `backups/`, keeping only the most recent `keep` backups.
/// Backups are sorted by filename (which embeds a timestamp) in ascending order.
pub fn cleanup_old_backups(db_path: &Path, keep: usize) -> DomainResult<()> {
    let dir = backups_dir(db_path)?;
    if !dir.exists() {
        return Ok(());
    }

    let stem = db_stem(db_path);
    // Match main backup files: <stem>_v<N>_<timestamp>.db  (exclude WAL/SHM aux files)
    let prefix = format!("{stem}_v");
    let suffix = ".db";

    let mut backups: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| DomainError::Migration(format!("Cannot read backup dir: {e}")))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&prefix)
                && name.ends_with(suffix)
                && !name.contains("-wal")
                && !name.contains("-shm")
            {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    // Sort ascending by name (timestamp embedded, so lexicographic == chronological)
    backups.sort();

    if backups.len() <= keep {
        return Ok(());
    }

    let to_remove = &backups[..backups.len() - keep];
    for name in to_remove {
        let bp = dir.join(name);
        if let Err(e) = fs::remove_file(&bp) {
            warn!("Failed to remove old backup {}: {e}", bp.display());
        }
        // Also remove WAL/SHM backups
        for aux_suffix in &["wal", "shm"] {
            let _ = fs::remove_file(auxiliary_backup_path(&bp, aux_suffix));
        }
    }

    info!("Cleaned up {} old backup(s), kept {keep}", to_remove.len());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_temp_db() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        fs::write(&db_path, b"test database content").unwrap();
        (dir, db_path)
    }

    #[test]
    fn backup_path_includes_version() {
        let path = Path::new("/tmp/app.db");
        let backup = backup_path(path, 3);

        assert_eq!(backup.parent(), Some(Path::new("/tmp/backups")));
        let file_name = backup.file_name().and_then(|name| name.to_str()).unwrap();
        assert!(file_name.starts_with("app_v3_"));
        assert!(file_name.ends_with(".db"));
    }

    #[test]
    fn auxiliary_backup_path_for_wal() {
        let path = Path::new("/tmp/backups/app_v2_20260330T000000.db");
        assert_eq!(
            auxiliary_backup_path(path, "wal"),
            PathBuf::from("/tmp/backups/app_v2_20260330T000000.db-wal")
        );
    }

    #[test]
    fn auxiliary_backup_path_works_for_non_db_extension() {
        let path = Path::new("/tmp/backups/app.sqlite");
        assert_eq!(
            auxiliary_backup_path(path, "wal"),
            PathBuf::from("/tmp/backups/app.sqlite-wal")
        );
    }

    #[test]
    fn create_backup_copies_file() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        assert!(bp.exists());
        assert_eq!(fs::read(&bp).unwrap(), b"test database content");
    }

    #[test]
    fn create_backup_copies_wal_and_shm() {
        let (_dir, db_path) = setup_temp_db();
        // SQLite appends -wal/-shm to the full filename
        let mut wal_name = db_path.as_os_str().to_owned();
        wal_name.push("-wal");
        let wal_path = PathBuf::from(wal_name);
        let mut shm_name = db_path.as_os_str().to_owned();
        shm_name.push("-shm");
        let shm_path = PathBuf::from(shm_name);
        fs::write(&wal_path, b"wal data").unwrap();
        fs::write(&shm_path, b"shm data").unwrap();

        let bp = create_backup(&db_path, 2).unwrap();
        assert!(bp.exists());
        assert_eq!(
            fs::read(auxiliary_backup_path(&bp, "wal")).unwrap(),
            b"wal data"
        );
        assert_eq!(
            fs::read(auxiliary_backup_path(&bp, "shm")).unwrap(),
            b"shm data"
        );
    }

    #[test]
    fn create_backup_fails_if_db_missing() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("nonexistent.db");
        let result = create_backup(&db_path, 1);
        assert!(result.is_err());
    }

    #[test]
    fn restore_backup_replaces_db() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        // Corrupt the original
        fs::write(&db_path, b"corrupted").unwrap();
        restore_backup(&db_path, &bp).unwrap();
        assert_eq!(fs::read(&db_path).unwrap(), b"test database content");
    }

    #[test]
    fn restore_removes_stale_wal_shm() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        // Create stale WAL that has no backup counterpart
        let mut wal_name = db_path.as_os_str().to_owned();
        wal_name.push("-wal");
        let wal_path = PathBuf::from(wal_name);
        fs::write(&wal_path, b"stale wal").unwrap();
        restore_backup(&db_path, &bp).unwrap();
        // Stale WAL should be removed (no WAL backup existed for v1)
        assert!(!wal_path.exists());
    }

    #[test]
    fn cleanup_keeps_only_recent() {
        let (_dir, db_path) = setup_temp_db();
        let backup_dir = backups_dir(&db_path).unwrap();
        fs::create_dir_all(&backup_dir).unwrap();
        let backups = [
            "test_v1_20240101T000001.db",
            "test_v2_20240101T000002.db",
            "test_v3_20240101T000003.db",
            "test_v4_20240101T000004.db",
        ];
        for backup in backups {
            fs::write(backup_dir.join(backup), backup).unwrap();
        }
        cleanup_old_backups(&db_path, 2).unwrap();

        // Only v3 and v4 should remain
        assert!(!backup_dir.join("test_v1_20240101T000001.db").exists());
        assert!(!backup_dir.join("test_v2_20240101T000002.db").exists());
        assert!(backup_dir.join("test_v3_20240101T000003.db").exists());
        assert!(backup_dir.join("test_v4_20240101T000004.db").exists());
    }
}
