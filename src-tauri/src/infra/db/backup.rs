use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use tracing::{info, warn};

use crate::domain::error::{DomainError, DomainResult};

const SQLITE_AUXILIARY_SUFFIXES: [&str; 2] = ["wal", "shm"];

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

fn backup_path_with_collision_suffix(base_path: &Path, collision_index: usize) -> PathBuf {
    if collision_index == 0 {
        return base_path.to_path_buf();
    }

    let stem = base_path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("db");
    let extension = base_path.extension().and_then(|name| name.to_str());
    let file_name = match extension {
        Some(extension) => format!("{stem}_{collision_index}.{extension}"),
        None => format!("{stem}_{collision_index}"),
    };

    base_path.with_file_name(file_name)
}

fn available_backup_path(db_path: &Path, schema_version: i32) -> PathBuf {
    let base_path = backup_path(db_path, schema_version);
    (0..)
        .map(|collision_index| backup_path_with_collision_suffix(&base_path, collision_index))
        .find(|candidate| {
            !candidate.exists()
                && SQLITE_AUXILIARY_SUFFIXES
                    .iter()
                    .all(|suffix| !auxiliary_backup_path(candidate, suffix).exists())
        })
        .unwrap_or(base_path)
}

/// Generate WAL/SHM backup path by appending suffix inside `backups/`.
fn auxiliary_backup_path(base_backup: &Path, suffix: &str) -> PathBuf {
    let mut name = base_backup.as_os_str().to_owned();
    name.push(format!("-{suffix}"));
    PathBuf::from(name)
}

fn temp_backup_path(final_path: &Path) -> PathBuf {
    let mut name = final_path.as_os_str().to_owned();
    name.push(".tmp");
    PathBuf::from(name)
}

fn restore_old_path(final_path: &Path) -> PathBuf {
    let mut name = final_path.as_os_str().to_owned();
    name.push(".restore-old");
    PathBuf::from(name)
}

pub(crate) fn redacted_path_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| format!("[redacted parent]/{name}"))
        .unwrap_or_else(|| "[redacted path]".to_string())
}

fn copy_backup_file_atomic(src: &Path, dest: &Path) -> DomainResult<()> {
    let temp_dest = temp_backup_path(dest);
    if temp_dest.exists() {
        fs::remove_file(&temp_dest).map_err(|e| {
            DomainError::Migration(format!(
                "Failed to remove stale temporary backup {}: {e}",
                redacted_path_label(&temp_dest)
            ))
        })?;
    }
    fs::copy(src, &temp_dest).map_err(|e| {
        let _ = fs::remove_file(&temp_dest);
        DomainError::Migration(format!(
            "Failed to backup {}: {e}",
            redacted_path_label(src)
        ))
    })?;
    fs::rename(&temp_dest, dest).map_err(|e| {
        let _ = fs::remove_file(&temp_dest);
        DomainError::Migration(format!(
            "Failed to finalize backup {}: {e}",
            redacted_path_label(dest)
        ))
    })?;
    Ok(())
}

/// Copy the SQLite file to a backup location before migration.
/// WAL and SHM files are also copied if they exist.
/// Returns the path to the backup file.
pub fn create_backup(db_path: &Path, schema_version: i32) -> DomainResult<PathBuf> {
    let dir = backups_dir(db_path)?;
    fs::create_dir_all(&dir).map_err(|e| {
        DomainError::Migration(format!(
            "Failed to create backup directory {}: {e}",
            redacted_path_label(&dir)
        ))
    })?;

    let dest = available_backup_path(db_path, schema_version);

    info!(
        "Creating DB backup: {} -> {}",
        db_path.display(),
        dest.display()
    );

    copy_backup_file_atomic(db_path, &dest)?;

    // Copy WAL and SHM if they exist (SQLite WAL mode)
    for suffix in SQLITE_AUXILIARY_SUFFIXES {
        let mut src_name = db_path.as_os_str().to_owned();
        src_name.push(format!("-{suffix}"));
        let src = PathBuf::from(src_name);
        if src.exists() {
            let aux_dest = auxiliary_backup_path(&dest, suffix);
            copy_backup_file_atomic(&src, &aux_dest)?;
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

    let mut restore_set = vec![(backup.to_path_buf(), db_path.to_path_buf())];
    let mut remove_if_missing = Vec::new();

    for suffix in SQLITE_AUXILIARY_SUFFIXES {
        let mut aux_name = db_path.as_os_str().to_owned();
        aux_name.push(format!("-{suffix}"));
        let aux_current = PathBuf::from(aux_name);
        let aux_backup = auxiliary_backup_path(backup, suffix);
        if aux_backup.exists() {
            restore_set.push((aux_backup, aux_current));
        } else {
            remove_if_missing.push(aux_current);
        }
    }

    let mut staged_paths = Vec::new();
    for (src, dest) in &restore_set {
        let temp_dest = temp_backup_path(dest);
        if temp_dest.exists() {
            fs::remove_file(&temp_dest).map_err(|e| {
                DomainError::Migration(format!(
                    "Failed to remove stale temporary restore {}: {e}",
                    redacted_path_label(&temp_dest)
                ))
            })?;
        }
        fs::copy(src, &temp_dest).map_err(|e| {
            for staged_path in &staged_paths {
                let _ = fs::remove_file(staged_path);
            }
            DomainError::Migration(format!(
                "Failed to stage restore {}: {e}",
                redacted_path_label(src)
            ))
        })?;
        staged_paths.push(temp_dest);
    }

    let mut restore_targets: Vec<PathBuf> = restore_set
        .iter()
        .map(|(_, dest)| dest.to_path_buf())
        .collect();
    restore_targets.extend(remove_if_missing);

    let mut old_paths = Vec::new();
    for dest in restore_targets {
        let old_path = restore_old_path(&dest);
        if old_path.exists() {
            fs::remove_file(&old_path).map_err(|e| {
                DomainError::Migration(format!(
                    "Failed to remove stale restore rollback file {}: {e}",
                    redacted_path_label(&old_path)
                ))
            })?;
        }
        if dest.exists() {
            fs::rename(&dest, &old_path).map_err(|e| {
                for staged_path in &staged_paths {
                    let _ = fs::remove_file(staged_path);
                }
                for (rollback_dest, rollback_old_path) in old_paths.iter().rev() {
                    let _ = fs::rename(rollback_old_path, rollback_dest);
                }
                DomainError::Migration(format!(
                    "Failed to prepare restore {}: {e}",
                    redacted_path_label(&dest)
                ))
            })?;
            old_paths.push((dest, old_path));
        }
    }

    let finalize_result = restore_set.iter().try_for_each(|(_, dest)| {
        fs::rename(temp_backup_path(dest), dest).map_err(|e| {
            DomainError::Migration(format!(
                "Failed to finalize restore {}: {e}",
                redacted_path_label(dest)
            ))
        })
    });

    if let Err(error) = finalize_result {
        for (dest, old_path) in old_paths.iter().rev() {
            let _ = fs::remove_file(dest);
            let _ = fs::rename(old_path, dest);
        }
        for staged_path in &staged_paths {
            let _ = fs::remove_file(staged_path);
        }
        return Err(error);
    }

    for (_, old_path) in old_paths {
        let _ = fs::remove_file(old_path);
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

    let backup_entries: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| DomainError::Migration(format!("Cannot read backup dir: {e}")))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect();
    let mut backups: Vec<String> = backup_entries
        .iter()
        .filter(|name| {
            name.starts_with(&prefix)
                && name.ends_with(suffix)
                && !name.contains("-wal")
                && !name.contains("-shm")
        })
        .cloned()
        .collect();

    // Sort ascending by name (timestamp embedded, so lexicographic == chronological)
    backups.sort();

    let to_remove_count = backups.len().saturating_sub(keep);
    let to_remove = &backups[..to_remove_count];
    let kept: BTreeSet<&str> = backups[to_remove_count..]
        .iter()
        .map(String::as_str)
        .collect();
    let to_remove_set: BTreeSet<&str> = to_remove.iter().map(String::as_str).collect();
    let mut removal_errors = Vec::new();

    for name in to_remove {
        let bp = dir.join(name);
        if let Err(e) = fs::remove_file(&bp) {
            let message = format!("Failed to remove old backup {}: {e}", bp.display());
            warn!("{message}");
            removal_errors.push(message);
        }
    }

    for entry_name in backup_entries {
        let Some((main_backup_name, _)) = entry_name.rsplit_once('-') else {
            continue;
        };
        let is_aux_backup = SQLITE_AUXILIARY_SUFFIXES
            .iter()
            .any(|aux_suffix| entry_name.ends_with(&format!("-{aux_suffix}")));
        if !is_aux_backup
            || !main_backup_name.starts_with(&prefix)
            || !main_backup_name.ends_with(suffix)
        {
            continue;
        }
        if kept.contains(main_backup_name) {
            continue;
        }

        let aux_path = dir.join(&entry_name);
        let reason = if to_remove_set.contains(main_backup_name) {
            "old backup generation"
        } else {
            "orphan backup generation"
        };
        if let Err(e) = fs::remove_file(&aux_path) {
            let message = format!(
                "Failed to remove {reason} auxiliary backup {}: {e}",
                aux_path.display()
            );
            warn!("{message}");
            removal_errors.push(message);
        }
    }

    if !removal_errors.is_empty() {
        return Err(DomainError::Migration(format!(
            "Backup cleanup failed: {}",
            removal_errors.join("; ")
        )));
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
    fn temp_backup_path_pairs_with_final_backup_name() {
        let path = Path::new("/tmp/backups/app_v2_20260330T000000.db");
        assert_eq!(
            temp_backup_path(path),
            PathBuf::from("/tmp/backups/app_v2_20260330T000000.db.tmp")
        );
    }

    #[test]
    fn redacted_path_label_keeps_only_file_name_for_user_facing_diagnostics() {
        assert_eq!(
            redacted_path_label(Path::new("/Users/example/app/backups/app_v2.db")),
            "[redacted parent]/app_v2.db"
        );
    }

    #[test]
    fn create_backup_copies_file() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        assert!(bp.exists());
        assert_eq!(fs::read(&bp).unwrap(), b"test database content");
        assert!(!temp_backup_path(&bp).exists());
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
        assert!(!temp_backup_path(&auxiliary_backup_path(&bp, "wal")).exists());
        assert!(!temp_backup_path(&auxiliary_backup_path(&bp, "shm")).exists());
    }

    #[test]
    fn create_backup_uses_unique_name_when_timestamp_collides() {
        let (_dir, db_path) = setup_temp_db();
        let first = create_backup(&db_path, 1).unwrap();
        fs::write(&db_path, b"second database content").unwrap();

        let second = create_backup(&db_path, 1).unwrap();

        assert_ne!(first, second);
        assert!(first.exists());
        assert!(second.exists());
        assert_eq!(fs::read(first).unwrap(), b"test database content");
        assert_eq!(fs::read(second).unwrap(), b"second database content");
    }

    #[test]
    fn create_backup_uses_unique_name_when_auxiliary_backup_collides() {
        let (_dir, db_path) = setup_temp_db();
        let base = backup_path(&db_path, 1);
        fs::create_dir_all(base.parent().unwrap()).unwrap();
        fs::write(auxiliary_backup_path(&base, "wal"), b"existing wal backup").unwrap();

        let backup = create_backup(&db_path, 1).unwrap();

        assert_ne!(backup, base);
        assert!(backup.exists());
        assert!(auxiliary_backup_path(&base, "wal").exists());
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
    fn restore_backup_replaces_db_wal_and_shm_as_one_set() {
        let (_dir, db_path) = setup_temp_db();
        let wal_path = PathBuf::from(format!("{}-wal", db_path.display()));
        let shm_path = PathBuf::from(format!("{}-shm", db_path.display()));
        fs::write(&wal_path, b"backup wal").unwrap();
        fs::write(&shm_path, b"backup shm").unwrap();

        let bp = create_backup(&db_path, 1).unwrap();

        fs::write(&db_path, b"current database content").unwrap();
        fs::write(&wal_path, b"current wal").unwrap();
        fs::write(&shm_path, b"current shm").unwrap();

        restore_backup(&db_path, &bp).unwrap();

        assert_eq!(fs::read(&db_path).unwrap(), b"test database content");
        assert_eq!(fs::read(&wal_path).unwrap(), b"backup wal");
        assert_eq!(fs::read(&shm_path).unwrap(), b"backup shm");
        assert!(!temp_backup_path(&db_path).exists());
        assert!(!restore_old_path(&db_path).exists());
        assert!(!temp_backup_path(&wal_path).exists());
        assert!(!restore_old_path(&wal_path).exists());
        assert!(!temp_backup_path(&shm_path).exists());
        assert!(!restore_old_path(&shm_path).exists());
    }

    #[test]
    fn restore_removes_stale_wal_shm() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        // Create stale WAL/SHM files that have no backup counterparts.
        let mut wal_name = db_path.as_os_str().to_owned();
        wal_name.push("-wal");
        let wal_path = PathBuf::from(wal_name);
        let mut shm_name = db_path.as_os_str().to_owned();
        shm_name.push("-shm");
        let shm_path = PathBuf::from(shm_name);
        fs::write(&wal_path, b"stale wal").unwrap();
        fs::write(&shm_path, b"stale shm").unwrap();
        restore_backup(&db_path, &bp).unwrap();
        // Stale WAL/SHM should be removed (no aux backup existed for v1).
        assert!(!wal_path.exists());
        assert!(!shm_path.exists());
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

    #[test]
    fn cleanup_removes_wal_and_shm_with_their_main_backup_generation() {
        let (_dir, db_path) = setup_temp_db();
        let backup_dir = backups_dir(&db_path).unwrap();
        fs::create_dir_all(&backup_dir).unwrap();
        let backups = [
            "test_v1_20240101T000001.db",
            "test_v2_20240101T000002.db",
            "test_v3_20240101T000003.db",
        ];
        for backup in backups {
            let path = backup_dir.join(backup);
            fs::write(&path, backup).unwrap();
            fs::write(auxiliary_backup_path(&path, "wal"), format!("{backup}-wal")).unwrap();
            fs::write(auxiliary_backup_path(&path, "shm"), format!("{backup}-shm")).unwrap();
        }

        cleanup_old_backups(&db_path, 1).unwrap();

        for removed in &["test_v1_20240101T000001.db", "test_v2_20240101T000002.db"] {
            let path = backup_dir.join(removed);
            assert!(!path.exists());
            assert!(!auxiliary_backup_path(&path, "wal").exists());
            assert!(!auxiliary_backup_path(&path, "shm").exists());
        }

        let kept = backup_dir.join("test_v3_20240101T000003.db");
        assert!(kept.exists());
        assert!(auxiliary_backup_path(&kept, "wal").exists());
        assert!(auxiliary_backup_path(&kept, "shm").exists());
    }

    #[test]
    fn cleanup_removes_orphan_auxiliary_backups_without_touching_kept_generation() {
        let (_dir, db_path) = setup_temp_db();
        let backup_dir = backups_dir(&db_path).unwrap();
        fs::create_dir_all(&backup_dir).unwrap();
        let kept = backup_dir.join("test_v3_20240101T000003.db");
        let orphan = backup_dir.join("test_v2_20240101T000002.db");
        fs::write(&kept, b"kept").unwrap();
        fs::write(auxiliary_backup_path(&kept, "wal"), b"kept wal").unwrap();
        fs::write(auxiliary_backup_path(&kept, "shm"), b"kept shm").unwrap();
        fs::write(auxiliary_backup_path(&orphan, "wal"), b"orphan wal").unwrap();
        fs::write(auxiliary_backup_path(&orphan, "shm"), b"orphan shm").unwrap();

        cleanup_old_backups(&db_path, 1).unwrap();

        assert!(kept.exists());
        assert!(auxiliary_backup_path(&kept, "wal").exists());
        assert!(auxiliary_backup_path(&kept, "shm").exists());
        assert!(!auxiliary_backup_path(&orphan, "wal").exists());
        assert!(!auxiliary_backup_path(&orphan, "shm").exists());
    }
}
