use std::collections::BTreeSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use chrono::Local;
use rusqlite::{params, Connection, OpenFlags};
use sha2::{Digest, Sha256};
use tracing::{info, warn};

use crate::domain::error::{DomainError, DomainResult};

const SQLITE_AUXILIARY_SUFFIXES: [&str; 2] = ["wal", "shm"];
const BACKUP_METADATA_FORMAT_VERSION: i32 = 1;
const SOURCE_APP_IDENTIFIER: &str = "com.jey3dayo.ultra-rss-reader";

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

fn backup_checksum(path: &Path) -> DomainResult<String> {
    let mut file = fs::File::open(path).map_err(|e| {
        DomainError::Migration(format!(
            "Failed to read backup checksum {}: {e}",
            redacted_path_label(path)
        ))
    })?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = file.read(&mut buffer).map_err(|e| {
            DomainError::Migration(format!(
                "Failed to read backup checksum {}: {e}",
                redacted_path_label(path)
            ))
        })?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn checkpoint_wal(db_path: &Path) -> DomainResult<()> {
    let conn = Connection::open(db_path)?;
    conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))
        .map_err(|e| {
            DomainError::Migration(format!(
                "Failed to checkpoint WAL for {}: {e}",
                redacted_path_label(db_path)
            ))
        })?;
    Ok(())
}

fn ensure_integrity_ok(db_path: &Path, operation: &str) -> DomainResult<()> {
    let conn =
        Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| {
            DomainError::Migration(format!(
                "Failed to open {} for SQLite integrity_check {operation}: {e}",
                redacted_path_label(db_path)
            ))
        })?;
    let result: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| {
            DomainError::Migration(format!(
                "Failed to run SQLite integrity_check {operation} for {}: {e}",
                redacted_path_label(db_path)
            ))
        })?;
    if result == "ok" {
        return Ok(());
    }

    Err(DomainError::Migration(format!(
        "SQLite integrity_check failed {operation} for {}: {result}",
        redacted_path_label(db_path)
    )))
}

fn write_backup_metadata(backup_path: &Path, schema_version: i32) -> DomainResult<()> {
    let checksum = backup_checksum(backup_path)?;
    let conn = Connection::open(backup_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS __ultra_rss_backup_metadata (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            metadata_format_version INTEGER NOT NULL,
            app_version TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            source_app_identifier TEXT NOT NULL,
            data_checksum_sha256 TEXT NOT NULL
        );",
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO __ultra_rss_backup_metadata (
            id,
            metadata_format_version,
            app_version,
            schema_version,
            created_at,
            source_app_identifier,
            data_checksum_sha256
        ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            BACKUP_METADATA_FORMAT_VERSION,
            env!("CARGO_PKG_VERSION"),
            schema_version,
            Local::now().to_rfc3339(),
            SOURCE_APP_IDENTIFIER,
            checksum,
        ],
    )?;
    Ok(())
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

    ensure_integrity_ok(db_path, "before backup")?;
    checkpoint_wal(db_path)?;

    info!(
        "Creating DB backup: {} -> {}",
        redacted_path_label(db_path),
        redacted_path_label(&dest)
    );

    copy_backup_file_atomic(db_path, &dest)?;
    write_backup_metadata(&dest, schema_version)?;
    ensure_integrity_ok(&dest, "after backup")?;

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

pub(crate) fn manual_restore_instruction() -> &'static str {
    "Close the application before copying files. macOS: copy the newest backup from ~/Library/Application Support/com.jey3dayo.ultra-rss-reader/backups/ over ~/Library/Application Support/com.jey3dayo.ultra-rss-reader/ultra-rss-reader.db. Windows: copy the newest backup from %APPDATA%\\com.jey3dayo.ultra-rss-reader\\backups\\ over %APPDATA%\\com.jey3dayo.ultra-rss-reader\\ultra-rss-reader.db. If permission is denied, check file ownership and try again while the app is closed."
}

/// Restore the database from a backup file, replacing the current DB.
pub fn restore_backup(db_path: &Path, backup: &Path) -> DomainResult<()> {
    info!(
        "Restoring DB from backup: {} -> {}",
        redacted_path_label(backup),
        redacted_path_label(db_path)
    );

    ensure_integrity_ok(backup, "before restore")?;

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

    checkpoint_wal(db_path)?;
    ensure_integrity_ok(db_path, "after restore")?;

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
            let message = format!(
                "Failed to remove old backup {}: {e}",
                redacted_path_label(&bp)
            );
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
                redacted_path_label(&aux_path)
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
mod tests;
