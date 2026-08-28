use std::fs;
use std::path::{Path, PathBuf};

use tracing::warn;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::local_account_sync::{
    operation_file, parse_operation_file, LocalAccountSyncOperation, LocalSyncDeviceId,
};

/// Recursion depth limit for scanning the local sync operation directory tree.
///
/// The expected shape is `<account_root>/ops/<device_id>/*.json`, which is only
/// 2 levels deep from the account root. 16 gives generous headroom for
/// unexpected nesting while still bounding stack usage against pathological or
/// adversarial directory trees (e.g. deeply nested or cyclical structures).
const MAX_LOCAL_SYNC_SCAN_DEPTH: usize = 16;

/// Maximum size accepted for a single local sync operation JSON file.
///
/// Real operation files are tiny JSON documents (well under a few KB). 32 MiB
/// is generous headroom that still prevents an oversized file from being
/// fully loaded into memory via `fs::read_to_string`.
const MAX_LOCAL_SYNC_OPERATION_FILE_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSyncLoadReport {
    pub operations: Vec<LocalAccountSyncOperation>,
    pub rejected_files: Vec<RejectedLocalSyncFile>,
    pub conflicted_candidates: Vec<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RejectedLocalSyncFile {
    pub path: PathBuf,
    pub reason: LocalSyncFileRejectReason,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalSyncFileRejectReason {
    ParseError,
    UnsupportedSchemaVersion,
    PartialTemporaryFile,
    /// Entry is a symlink (file or directory); skipped to avoid following
    /// links outside the account root or into a cycle.
    SymlinkSkipped,
    /// Directory recursion reached `MAX_LOCAL_SYNC_SCAN_DEPTH`; the subtree
    /// was not scanned further.
    MaxDepthExceeded,
    /// Operation JSON file exceeded `MAX_LOCAL_SYNC_OPERATION_FILE_BYTES` and
    /// was not read into memory.
    FileTooLarge,
}

pub fn local_sync_operation_path(
    account_root: &Path,
    device_id: &LocalSyncDeviceId,
    sequence: u64,
) -> DomainResult<PathBuf> {
    let device_dir = validated_device_dir_name(device_id)?;
    Ok(account_root
        .join("ops")
        .join(device_dir)
        .join(format!("{sequence:08}.json")))
}

pub fn write_local_sync_operation_file(
    account_root: &Path,
    operation: &LocalAccountSyncOperation,
    sequence: u64,
) -> DomainResult<PathBuf> {
    let path = local_sync_operation_path(account_root, &operation.device_id, sequence)?;
    write_local_sync_operation_file_at(&path, operation)?;
    Ok(path)
}

pub fn next_local_sync_operation_sequence(
    account_root: &Path,
    device_id: &LocalSyncDeviceId,
) -> DomainResult<u64> {
    let operation_dir = local_sync_operation_path(account_root, device_id, 1)?
        .parent()
        .ok_or_else(|| {
            DomainError::Persistence("Cannot determine local sync operation directory".to_string())
        })?
        .to_path_buf();
    let ops_dir = operation_dir.parent().ok_or_else(|| {
        DomainError::Persistence("Cannot determine local sync operations directory".to_string())
    })?;
    ensure_local_sync_directory_is_not_symlink(ops_dir)?;
    ensure_local_sync_directory_is_not_symlink(&operation_dir)?;
    if !operation_dir.exists() {
        return Ok(1);
    }

    let mut max_sequence = 0_u64;
    for entry in fs::read_dir(&operation_dir).map_err(|error| {
        DomainError::Persistence(format!(
            "Failed to read local sync operation directory {}: {error}",
            redacted_sync_path_label(&operation_dir)
        ))
    })? {
        let entry = entry.map_err(|error| {
            DomainError::Persistence(format!(
                "Failed to read local sync operation directory entry: {error}"
            ))
        })?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Some(sequence) = path
            .file_stem()
            .and_then(|value| value.to_str())
            .and_then(|stem| stem.parse::<u64>().ok())
        else {
            continue;
        };
        max_sequence = max_sequence.max(sequence);
    }

    Ok(max_sequence.saturating_add(1))
}

pub fn write_local_sync_operation_file_at(
    path: &Path,
    operation: &LocalAccountSyncOperation,
) -> DomainResult<()> {
    let Some(parent) = path.parent() else {
        return Err(DomainError::Persistence(
            "Cannot determine local sync operation parent directory".to_string(),
        ));
    };
    let ops_dir = parent.parent().ok_or_else(|| {
        DomainError::Persistence("Cannot determine local sync operations directory".to_string())
    })?;
    ensure_local_sync_directory_is_not_symlink(ops_dir)?;
    ensure_local_sync_directory_is_not_symlink(parent)?;
    if path.exists() {
        return Err(DomainError::Persistence(format!(
            "Local sync operation file already exists: {}",
            redacted_sync_path_label(path)
        )));
    }
    fs::create_dir_all(parent).map_err(|error| {
        DomainError::Persistence(format!(
            "Failed to create local sync operation directory {}: {error}",
            redacted_sync_path_label(parent)
        ))
    })?;

    let json =
        serde_json::to_string_pretty(&operation_file(operation.clone())).map_err(|error| {
            DomainError::Parse(format!("Failed to serialize local sync operation: {error}"))
        })?;
    let temp_path = temp_operation_path(path);
    if temp_path.exists() {
        fs::remove_file(&temp_path).map_err(|error| {
            DomainError::Persistence(format!(
                "Failed to remove stale local sync temp file {}: {error}",
                redacted_sync_path_label(&temp_path)
            ))
        })?;
    }
    fs::write(&temp_path, json).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        DomainError::Persistence(format!(
            "Failed to write local sync temp file {}: {error}",
            redacted_sync_path_label(&temp_path)
        ))
    })?;
    fs::hard_link(&temp_path, path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        DomainError::Persistence(format!(
            "Failed to finalize local sync operation file {}: {error}",
            redacted_sync_path_label(path)
        ))
    })?;
    fs::remove_file(&temp_path).map_err(|error| {
        DomainError::Persistence(format!(
            "Failed to remove finalized local sync temp file {}: {error}",
            redacted_sync_path_label(&temp_path)
        ))
    })?;
    Ok(())
}

pub fn load_local_sync_operation_dir(dir: &Path) -> DomainResult<LocalSyncLoadReport> {
    let mut report = LocalSyncLoadReport {
        operations: Vec::new(),
        rejected_files: Vec::new(),
        conflicted_candidates: Vec::new(),
    };
    ensure_local_sync_directory_is_not_symlink(dir)?;
    if !dir.exists() {
        return Ok(report);
    }
    load_local_sync_operation_dir_inner(dir, &mut report, 0)?;
    report.operations.sort_by(|left, right| {
        left.occurred_at
            .cmp(&right.occurred_at)
            .then_with(|| left.operation_id.cmp(&right.operation_id))
    });
    report.conflicted_candidates.sort();
    Ok(report)
}

pub fn is_local_sync_conflicted_copy(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    let lower = name.to_ascii_lowercase();
    lower.contains("conflicted copy")
        || lower.contains("conflict")
        || lower.contains("sync-conflict")
        || lower.contains(".sync-conflict")
}

fn load_local_sync_operation_dir_inner(
    dir: &Path,
    report: &mut LocalSyncLoadReport,
    depth: usize,
) -> DomainResult<()> {
    for entry in fs::read_dir(dir).map_err(|error| {
        DomainError::Persistence(format!(
            "Failed to read local sync operation directory {}: {error}",
            redacted_sync_path_label(dir)
        ))
    })? {
        let entry = entry.map_err(|error| {
            DomainError::Persistence(format!(
                "Failed to read local sync directory entry: {error}"
            ))
        })?;
        let path = entry.path();

        let file_type = entry.file_type().map_err(|error| {
            DomainError::Persistence(format!(
                "Failed to read local sync directory entry type {}: {error}",
                redacted_sync_path_label(&path)
            ))
        })?;

        if file_type.is_symlink() {
            warn!(
                path = %redacted_sync_path_label(&path),
                "Skipping symlinked entry while scanning local sync operation directory"
            );
            report.rejected_files.push(RejectedLocalSyncFile {
                path,
                reason: LocalSyncFileRejectReason::SymlinkSkipped,
            });
            continue;
        }

        if file_type.is_dir() {
            if depth >= MAX_LOCAL_SYNC_SCAN_DEPTH {
                warn!(
                    path = %redacted_sync_path_label(&path),
                    depth,
                    "Skipping local sync operation subdirectory beyond max scan depth"
                );
                report.rejected_files.push(RejectedLocalSyncFile {
                    path,
                    reason: LocalSyncFileRejectReason::MaxDepthExceeded,
                });
                continue;
            }
            load_local_sync_operation_dir_inner(&path, report, depth + 1)?;
            continue;
        }
        if is_local_sync_conflicted_copy(&path) {
            report.conflicted_candidates.push(path.clone());
        }
        if path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| name.starts_with('.') && name.ends_with(".tmp"))
        {
            report.rejected_files.push(RejectedLocalSyncFile {
                path,
                reason: LocalSyncFileRejectReason::PartialTemporaryFile,
            });
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        match read_local_sync_operation_file(&path) {
            Ok(Some(operation)) => report.operations.push(operation),
            Ok(None) => {
                warn!(
                    path = %redacted_sync_path_label(&path),
                    "Skipping oversized local sync operation file"
                );
                report.rejected_files.push(RejectedLocalSyncFile {
                    path,
                    reason: LocalSyncFileRejectReason::FileTooLarge,
                });
            }
            Err(error) => {
                let reason = if error
                    .to_string()
                    .contains("Unsupported local sync operation version")
                {
                    LocalSyncFileRejectReason::UnsupportedSchemaVersion
                } else {
                    LocalSyncFileRejectReason::ParseError
                };
                report
                    .rejected_files
                    .push(RejectedLocalSyncFile { path, reason });
            }
        }
    }
    Ok(())
}

/// Reads and parses a local sync operation JSON file.
///
/// Returns `Ok(None)` when the file exceeds `MAX_LOCAL_SYNC_OPERATION_FILE_BYTES`
/// so the caller can record it as a skipped/rejected file instead of loading
/// an attacker-sized file fully into memory.
fn read_local_sync_operation_file(path: &Path) -> DomainResult<Option<LocalAccountSyncOperation>> {
    let metadata = fs::metadata(path).map_err(|error| {
        DomainError::Persistence(format!(
            "Failed to read local sync operation file metadata {}: {error}",
            redacted_sync_path_label(path)
        ))
    })?;
    if metadata.len() > MAX_LOCAL_SYNC_OPERATION_FILE_BYTES {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(|error| {
        DomainError::Persistence(format!(
            "Failed to read local sync operation file {}: {error}",
            redacted_sync_path_label(path)
        ))
    })?;
    parse_operation_file(&content).map(|file| Some(file.operation))
}

fn validated_device_dir_name(device_id: &LocalSyncDeviceId) -> DomainResult<&str> {
    let value = device_id.0.as_str();
    if value.is_empty()
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(DomainError::Validation(
            "Local sync device ID cannot be used as a file path component".to_string(),
        ));
    }
    Ok(value)
}

/// Rejects a configured local-sync directory when its path entry is a symlink.
///
/// Export and import must inspect the path itself without following links so a
/// sync folder cannot redirect operation files outside its configured root.
fn ensure_local_sync_directory_is_not_symlink(path: &Path) -> DomainResult<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(DomainError::Persistence(
            "Refusing local sync operation directory symlink; choose a real directory".to_string(),
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(DomainError::Persistence(format!(
            "Failed to inspect local sync operation directory: {error}"
        ))),
    }
}

fn temp_operation_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("operation.json");
    let suffix = uuid::Uuid::new_v4();
    path.with_file_name(format!(".{file_name}.{suffix}.tmp"))
}

fn redacted_sync_path_label(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| format!("[redacted parent]/{name}"))
        .unwrap_or_else(|| "[redacted path]".to_string())
}

#[cfg(test)]
mod tests;
