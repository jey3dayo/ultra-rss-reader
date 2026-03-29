use std::fs;
use std::path::{Path, PathBuf};

use tracing::{info, warn};

use crate::domain::error::{DomainError, DomainResult};

/// Generate backup path: `<db_path>.backup-v<version>`
pub fn backup_path(db_path: &Path, schema_version: i32) -> PathBuf {
    let mut name = db_path.as_os_str().to_owned();
    name.push(format!(".backup-v{schema_version}"));
    PathBuf::from(name)
}

/// Generate WAL/SHM backup path by appending suffix to the full filename.
/// SQLite names auxiliary files by appending `-wal`/`-shm` to the full path,
/// so we must append rather than replace the extension.
fn auxiliary_backup_path(db_path: &Path, suffix: &str, schema_version: i32) -> PathBuf {
    let mut name = db_path.as_os_str().to_owned();
    name.push(format!("-{suffix}.backup-v{schema_version}"));
    PathBuf::from(name)
}

/// Copy the SQLite file to a backup location before migration.
/// WAL and SHM files are also copied if they exist.
pub fn create_backup(db_path: &Path, schema_version: i32) -> DomainResult<PathBuf> {
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
            let aux_dest = auxiliary_backup_path(db_path, suffix, schema_version);
            fs::copy(&src, &aux_dest).map_err(|e| {
                DomainError::Migration(format!("Failed to backup {}: {e}", src.display()))
            })?;
        }
    }

    Ok(dest)
}

/// Restore the database from a backup file, replacing the current DB.
/// `backup_version` is the schema version of the backup (used for WAL/SHM lookup).
pub fn restore_backup(db_path: &Path, backup: &Path, backup_version: i32) -> DomainResult<()> {
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
        let aux_backup = auxiliary_backup_path(db_path, suffix, backup_version);
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

/// Remove old backup files, keeping only the most recent `keep` backups.
pub fn cleanup_old_backups(db_path: &Path, keep: usize) -> DomainResult<()> {
    let dir = db_path
        .parent()
        .ok_or_else(|| DomainError::Migration("Cannot determine backup directory".to_string()))?;

    let db_name = db_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    let prefix = format!("{db_name}.backup-v");

    let mut versions: Vec<i32> = fs::read_dir(dir)
        .map_err(|e| DomainError::Migration(format!("Cannot read dir: {e}")))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            name.strip_prefix(&prefix)
                .and_then(|v| v.parse::<i32>().ok())
        })
        .collect();

    versions.sort();

    if versions.len() <= keep {
        return Ok(());
    }

    let to_remove = &versions[..versions.len() - keep];
    for v in to_remove {
        let bp = backup_path(db_path, *v);
        if let Err(e) = fs::remove_file(&bp) {
            warn!("Failed to remove old backup {}: {e}", bp.display());
        }
        // Also remove WAL/SHM backups
        for suffix in &["wal", "shm"] {
            let _ = fs::remove_file(auxiliary_backup_path(db_path, suffix, *v));
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
        assert_eq!(backup_path(path, 3), PathBuf::from("/tmp/app.db.backup-v3"));
    }

    #[test]
    fn auxiliary_backup_path_for_wal() {
        let path = Path::new("/tmp/app.db");
        assert_eq!(
            auxiliary_backup_path(path, "wal", 2),
            PathBuf::from("/tmp/app.db-wal.backup-v2")
        );
    }

    #[test]
    fn auxiliary_backup_path_works_for_non_db_extension() {
        let path = Path::new("/tmp/app.sqlite");
        assert_eq!(
            auxiliary_backup_path(path, "wal", 2),
            PathBuf::from("/tmp/app.sqlite-wal.backup-v2")
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
            fs::read(auxiliary_backup_path(&db_path, "wal", 2)).unwrap(),
            b"wal data"
        );
        assert_eq!(
            fs::read(auxiliary_backup_path(&db_path, "shm", 2)).unwrap(),
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
        restore_backup(&db_path, &bp, 1).unwrap();
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
        restore_backup(&db_path, &bp, 1).unwrap();
        // Stale WAL should be removed (no WAL backup existed for v1)
        assert!(!wal_path.exists());
    }

    #[test]
    fn cleanup_keeps_only_recent() {
        let (_dir, db_path) = setup_temp_db();
        // Create 4 backups
        for v in 1..=4 {
            let bp = backup_path(&db_path, v);
            fs::write(&bp, format!("backup-v{v}")).unwrap();
        }
        cleanup_old_backups(&db_path, 2).unwrap();

        // Only v3 and v4 should remain
        assert!(!backup_path(&db_path, 1).exists());
        assert!(!backup_path(&db_path, 2).exists());
        assert!(backup_path(&db_path, 3).exists());
        assert!(backup_path(&db_path, 4).exists());
    }
}
