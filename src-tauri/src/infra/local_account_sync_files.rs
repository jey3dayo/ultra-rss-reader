use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::local_account_sync::{
    operation_file, parse_operation_file, LocalAccountSyncOperation, LocalSyncDeviceId,
};

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
    if path.exists() {
        return Err(DomainError::Persistence(format!(
            "Local sync operation file already exists: {}",
            redacted_sync_path_label(path)
        )));
    }
    let Some(parent) = path.parent() else {
        return Err(DomainError::Persistence(
            "Cannot determine local sync operation parent directory".to_string(),
        ));
    };
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
    if !dir.exists() {
        return Ok(report);
    }
    load_local_sync_operation_dir_inner(dir, &mut report)?;
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
        if path.is_dir() {
            load_local_sync_operation_dir_inner(&path, report)?;
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
            Ok(operation) => report.operations.push(operation),
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

fn read_local_sync_operation_file(path: &Path) -> DomainResult<LocalAccountSyncOperation> {
    let content = fs::read_to_string(path).map_err(|error| {
        DomainError::Persistence(format!(
            "Failed to read local sync operation file {}: {error}",
            redacted_sync_path_label(path)
        ))
    })?;
    parse_operation_file(&content).map(|file| file.operation)
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
mod tests {
    use chrono::DateTime;

    use crate::domain::local_account_sync::{
        operation_file, LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction,
        LocalSyncArticleKey, LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
        LOCAL_ACCOUNT_SYNC_SCHEMA_VERSION,
    };

    use super::*;

    fn operation(id: &str) -> LocalAccountSyncOperation {
        LocalAccountSyncOperation {
            sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
            operation_id: LocalSyncOperationId(id.to_string()),
            device_id: LocalSyncDeviceId("device-a".to_string()),
            occurred_at: DateTime::from_timestamp(1, 0).unwrap(),
            entity_key: LocalSyncEntityKey::Article {
                article_key: LocalSyncArticleKey("article-1".to_string()),
            },
            action: LocalSyncAction::SetRead { is_read: true },
        }
    }

    #[test]
    fn writes_operation_file_via_temp_path_without_overwriting_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_local_sync_operation_file(dir.path(), &operation("op-1"), 1)
            .expect("operation file should be written");
        let original_content = fs::read_to_string(&path).unwrap();

        assert!(path.exists());
        assert!(
            path.parent()
                .unwrap()
                .read_dir()
                .unwrap()
                .all(|entry| !entry
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".tmp")),
            "successful write should not leave a temp file behind"
        );
        assert!(write_local_sync_operation_file(dir.path(), &operation("op-2"), 1).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), original_content);
    }

    #[test]
    fn next_operation_sequence_appends_after_existing_json_files() {
        let dir = tempfile::tempdir().unwrap();
        let account_root = dir.path();
        write_local_sync_operation_file(account_root, &operation("op-1"), 1).unwrap();
        write_local_sync_operation_file(account_root, &operation("op-3"), 3).unwrap();
        let op_dir = account_root.join("ops").join("device-a");
        fs::write(op_dir.join("not-a-sequence.json"), "{}").unwrap();
        fs::write(op_dir.join("00000099.txt"), "{}").unwrap();

        let next = next_local_sync_operation_sequence(
            account_root,
            &LocalSyncDeviceId("device-a".to_string()),
        )
        .unwrap();

        assert_eq!(next, 4);
    }

    #[test]
    fn rejects_device_ids_that_are_not_safe_path_components() {
        let dir = tempfile::tempdir().unwrap();
        for device_id in [
            "",
            "../escape",
            "nested/device",
            "nested\\device",
            ".hidden",
        ] {
            let mut operation = operation("op-invalid-device");
            operation.device_id = LocalSyncDeviceId(device_id.to_string());

            let error = write_local_sync_operation_file(dir.path(), &operation, 1)
                .expect_err("unsafe device ID should be rejected");

            assert!(error
                .to_string()
                .contains("Local sync device ID cannot be used as a file path component"));
        }
    }

    #[test]
    fn load_operation_dir_reports_parse_schema_and_partial_files_without_failing() {
        let dir = tempfile::tempdir().unwrap();
        let account_root = dir.path();
        write_local_sync_operation_file(account_root, &operation("op-1"), 1).unwrap();
        let op_dir = account_root.join("ops").join("device-a");
        fs::write(op_dir.join("00000002.json"), "{not-json").unwrap();
        fs::write(op_dir.join(".00000003.json.tmp"), "{}").unwrap();
        fs::write(op_dir.join("00000004.json"), {
            let mut file = operation_file(operation("op-unsupported"));
            file.version = LOCAL_ACCOUNT_SYNC_SCHEMA_VERSION + 1;
            serde_json::to_string(&file).unwrap()
        })
        .unwrap();

        let report = load_local_sync_operation_dir(account_root).unwrap();

        assert_eq!(report.operations.len(), 1);
        assert_eq!(report.rejected_files.len(), 3);
        assert!(report
            .rejected_files
            .iter()
            .any(|file| file.reason == LocalSyncFileRejectReason::ParseError));
        assert!(report
            .rejected_files
            .iter()
            .any(|file| file.reason == LocalSyncFileRejectReason::UnsupportedSchemaVersion));
        assert!(report
            .rejected_files
            .iter()
            .any(|file| file.reason == LocalSyncFileRejectReason::PartialTemporaryFile));
    }

    #[test]
    fn conflicted_copy_detection_catches_dropbox_and_resilio_style_names() {
        assert!(is_local_sync_conflicted_copy(Path::new(
            "00000001 (alice's conflicted copy 2026-06-25).json"
        )));
        assert!(is_local_sync_conflicted_copy(Path::new(
            "00000002.sync-conflict.json"
        )));
        assert!(!is_local_sync_conflicted_copy(Path::new("00000003.json")));
    }

    #[test]
    fn conflicted_copy_is_reported_as_read_candidate() {
        let dir = tempfile::tempdir().unwrap();
        let op_dir = dir.path().join("ops").join("device-a");
        fs::create_dir_all(&op_dir).unwrap();
        fs::write(op_dir.join("00000001 (conflicted copy).json"), "{not-json").unwrap();

        let report = load_local_sync_operation_dir(dir.path()).unwrap();

        assert_eq!(report.conflicted_candidates.len(), 1);
        assert_eq!(report.rejected_files.len(), 1);
    }
}
