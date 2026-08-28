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

#[test]
fn scan_stops_recursing_beyond_max_depth_without_panicking() {
    let dir = tempfile::tempdir().unwrap();
    let account_root = dir.path();

    // Build a chain nested deeper than MAX_LOCAL_SYNC_SCAN_DEPTH.
    let mut current = account_root.to_path_buf();
    for level in 0..(MAX_LOCAL_SYNC_SCAN_DEPTH + 4) {
        current = current.join(format!("level-{level}"));
        fs::create_dir_all(&current).unwrap();
        if level == 2 {
            // Within the depth limit: should still be scanned.
            fs::write(
                current.join("00000001.json"),
                serde_json::to_string(&operation_file(operation("op-within-limit"))).unwrap(),
            )
            .unwrap();
        }
    }
    // Deepest file, beyond the depth limit: should be skipped.
    fs::write(
        current.join("00000002.json"),
        serde_json::to_string(&operation_file(operation("op-beyond-limit"))).unwrap(),
    )
    .unwrap();

    let report = load_local_sync_operation_dir(account_root)
        .expect("scan should complete without panicking or erroring");

    assert_eq!(report.operations.len(), 1);
    assert_eq!(
        report.operations[0].operation_id,
        LocalSyncOperationId("op-within-limit".to_string())
    );
    assert!(report
        .rejected_files
        .iter()
        .any(|file| file.reason == LocalSyncFileRejectReason::MaxDepthExceeded));
}

#[cfg(unix)]
#[test]
fn scan_skips_symlinked_entries_without_following_them() {
    use std::os::unix::fs::symlink;

    let dir = tempfile::tempdir().unwrap();
    let account_root = dir.path();
    let op_dir = account_root.join("ops").join("device-a");
    fs::create_dir_all(&op_dir).unwrap();
    fs::write(
        op_dir.join("00000001.json"),
        serde_json::to_string(&operation_file(operation("op-real"))).unwrap(),
    )
    .unwrap();

    // A symlinked directory pointing back at the account root, which
    // would cause infinite recursion if followed.
    symlink(account_root, op_dir.join("loop-link")).unwrap();

    let report = load_local_sync_operation_dir(account_root)
        .expect("scan should complete without following the symlink");

    assert_eq!(report.operations.len(), 1);
    assert!(report.rejected_files.iter().any(|file| file.reason
        == LocalSyncFileRejectReason::SymlinkSkipped
        && file.path.file_name().and_then(|name| name.to_str()) == Some("loop-link")));
}

#[cfg(unix)]
#[test]
fn export_rejects_symlinked_ops_directory_without_writing_outside_account_root() {
    use std::os::unix::fs::symlink;

    let dir = tempfile::tempdir().unwrap();
    let account_root = dir.path().join("account");
    let external_dir = dir.path().join("external");
    fs::create_dir_all(&account_root).unwrap();
    fs::create_dir_all(&external_dir).unwrap();
    symlink(&external_dir, account_root.join("ops")).unwrap();

    let error = write_local_sync_operation_file(&account_root, &operation("op-ops-link"), 1)
        .expect_err("export should reject an ops directory symlink");

    assert!(error
        .to_string()
        .contains("Refusing local sync operation directory symlink"));
    assert!(external_dir.read_dir().unwrap().next().is_none());
}

#[cfg(unix)]
#[test]
fn export_rejects_symlinked_device_directory_without_writing_outside_account_root() {
    use std::os::unix::fs::symlink;

    let dir = tempfile::tempdir().unwrap();
    let account_root = dir.path().join("account");
    let external_dir = dir.path().join("external");
    fs::create_dir_all(account_root.join("ops")).unwrap();
    fs::create_dir_all(&external_dir).unwrap();
    symlink(&external_dir, account_root.join("ops").join("device-a")).unwrap();

    let error = write_local_sync_operation_file(&account_root, &operation("op-device-link"), 1)
        .expect_err("export should reject a device directory symlink");

    assert!(error
        .to_string()
        .contains("Refusing local sync operation directory symlink"));
    assert!(external_dir.read_dir().unwrap().next().is_none());
}

#[test]
fn scan_skips_oversized_operation_files() {
    let dir = tempfile::tempdir().unwrap();
    let account_root = dir.path();
    let op_dir = account_root.join("ops").join("device-a");
    fs::create_dir_all(&op_dir).unwrap();

    fs::write(
        op_dir.join("00000001.json"),
        serde_json::to_string(&operation_file(operation("op-normal"))).unwrap(),
    )
    .unwrap();

    let oversized = vec![b'a'; (MAX_LOCAL_SYNC_OPERATION_FILE_BYTES + 1) as usize];
    fs::write(op_dir.join("00000002.json"), &oversized).unwrap();

    let report = load_local_sync_operation_dir(account_root).unwrap();

    assert_eq!(report.operations.len(), 1);
    assert_eq!(
        report.operations[0].operation_id,
        LocalSyncOperationId("op-normal".to_string())
    );
    assert!(report
        .rejected_files
        .iter()
        .any(|file| file.reason == LocalSyncFileRejectReason::FileTooLarge));
}
