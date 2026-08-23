use super::dev_store_path::{
    dev_credentials_dir_for_kind_from_env, dev_credentials_path_for_platform,
    dev_credentials_path_for_platform_with_fs,
};
use crate::domain::error::DomainError;
use crate::platform::{platform_info_for_kind, PlatformKind};
use keyring::credential::CredentialPersistence;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

fn env_map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
    pairs
        .iter()
        .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
        .collect()
}

#[test]
fn dev_credentials_dir_prefers_local_app_data_on_windows() {
    let env = env_map(&[
        ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
        ("USERPROFILE", r"C:\Users\alice"),
        ("HOME", r"C:\Users\alice"),
    ]);

    let path =
        dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| env.get(key).cloned());

    assert_eq!(
        path,
        Some(PathBuf::from(
            r"C:\Users\alice\AppData\Local\ultra-rss-reader"
        ))
    );
}

#[test]
fn dev_credentials_dir_falls_back_to_user_profile_on_windows() {
    let env = env_map(&[
        ("USERPROFILE", r"C:\Users\alice"),
        ("HOME", r"C:\Users\alice"),
    ]);

    let path =
        dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| env.get(key).cloned());

    assert_eq!(
        path,
        Some(PathBuf::from(
            r"C:\Users\alice\AppData\Local\ultra-rss-reader"
        ))
    );
}

#[test]
fn dev_credentials_dir_falls_back_to_home_drive_and_home_path_on_windows() {
    let env = env_map(&[
        ("HOMEDRIVE", "C:"),
        ("HOMEPATH", r"\Users\alice"),
        ("HOME", r"C:\Users\alice"),
    ]);

    let path =
        dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| env.get(key).cloned());

    assert_eq!(
        path,
        Some(PathBuf::from(
            r"C:\Users\alice\AppData\Local\ultra-rss-reader"
        ))
    );
}

#[test]
fn dev_credentials_dir_prefers_xdg_data_home_on_linux() {
    let env = env_map(&[
        ("XDG_DATA_HOME", "/tmp/data-home"),
        ("HOME", "/Users/alice"),
    ]);

    let path =
        dev_credentials_dir_for_kind_from_env(PlatformKind::Linux, |key| env.get(key).cloned());

    assert_eq!(path, Some(PathBuf::from("/tmp/data-home/ultra-rss-reader")));
}

#[test]
fn dev_credentials_dir_falls_back_to_home_on_unknown_platform() {
    let env = env_map(&[("HOME", "/Users/alice")]);

    let path =
        dev_credentials_dir_for_kind_from_env(PlatformKind::Unknown, |key| env.get(key).cloned());

    assert_eq!(
        path,
        Some(PathBuf::from("/Users/alice/.local/share/ultra-rss-reader"))
    );
}

#[test]
fn dev_credentials_path_is_disabled_when_capability_is_off() {
    let info = platform_info_for_kind(PlatformKind::Windows);
    let env = env_map(&[
        ("DEV_CREDENTIALS", "1"),
        ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
    ]);

    let path = dev_credentials_path_for_platform(&info, |key| env.get(key).cloned());

    assert_eq!(path, None);
}

#[test]
fn dev_credentials_path_uses_platform_dir_when_capability_is_on() {
    let mut info = platform_info_for_kind(PlatformKind::Linux);
    info.capabilities.uses_dev_file_credentials = true;
    let env = env_map(&[
        ("DEV_CREDENTIALS", "1"),
        ("XDG_DATA_HOME", "/tmp/data-home"),
        ("HOME", "/Users/alice"),
    ]);

    let path = dev_credentials_path_for_platform(&info, |key| env.get(key).cloned());

    assert_eq!(
        path,
        Some(PathBuf::from(
            "/tmp/data-home/ultra-rss-reader/dev-credentials.json"
        ))
    );
}

#[test]
fn non_windows_uses_legacy_path_when_legacy_exists_and_preferred_is_missing() {
    let mut info = platform_info_for_kind(PlatformKind::Linux);
    info.capabilities.uses_dev_file_credentials = true;
    let env = env_map(&[
        ("DEV_CREDENTIALS", "1"),
        ("XDG_DATA_HOME", "/tmp/new-data-home"),
        ("HOME", "/Users/alice"),
    ]);
    let legacy = Path::new("/Users/alice/.local/share/ultra-rss-reader/dev-credentials.json");

    let path = dev_credentials_path_for_platform_with_fs(
        &info,
        |key| env.get(key).cloned(),
        |candidate| candidate == legacy,
    );

    assert_eq!(path, Some(legacy.to_path_buf()));
}

#[test]
fn non_windows_keeps_preferred_path_when_preferred_exists() {
    let mut info = platform_info_for_kind(PlatformKind::Linux);
    info.capabilities.uses_dev_file_credentials = true;
    let env = env_map(&[
        ("DEV_CREDENTIALS", "1"),
        ("XDG_DATA_HOME", "/tmp/new-data-home"),
        ("HOME", "/Users/alice"),
    ]);
    let preferred = Path::new("/tmp/new-data-home/ultra-rss-reader/dev-credentials.json");
    let legacy = Path::new("/Users/alice/.local/share/ultra-rss-reader/dev-credentials.json");

    let path = dev_credentials_path_for_platform_with_fs(
        &info,
        |key| env.get(key).cloned(),
        |candidate| candidate == preferred || candidate == legacy,
    );

    assert_eq!(path, Some(preferred.to_path_buf()));
}

#[test]
fn windows_keeps_preferred_path_even_if_legacy_file_exists() {
    let mut info = platform_info_for_kind(PlatformKind::Windows);
    info.capabilities.uses_dev_file_credentials = true;
    let env = env_map(&[
        ("DEV_CREDENTIALS", "1"),
        ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
        ("HOME", r"C:\Users\alice"),
    ]);

    let path = dev_credentials_path_for_platform_with_fs(
        &info,
        |key| env.get(key).cloned(),
        |_candidate| true,
    );

    assert_eq!(
        path,
        Some(PathBuf::from(
            r"C:\Users\alice\AppData\Local\ultra-rss-reader\dev-credentials.json"
        ))
    );
}

#[test]
fn missing_password_error_guides_user_to_reenter_credentials() {
    let error = super::missing_password_error();

    assert!(matches!(error, DomainError::Validation(_)));
    assert_eq!(
        error.to_string(),
        "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again."
    );
}

#[test]
fn verify_saved_password_rejects_missing_readback() {
    let error = super::verify_saved_password_with_reader("acc-1", "secret", |_| {
        Err(super::missing_password_error())
    })
    .expect_err("missing readback should fail verification");

    assert_eq!(
        error.to_string(),
        "Keychain error: Failed to verify saved password: Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again."
    );
}

#[test]
fn verify_saved_password_rejects_mismatched_readback() {
    let error =
        super::verify_saved_password_with_reader("acc-1", "secret", |_| Ok("different".into()))
            .expect_err("mismatched readback should fail verification");

    assert_eq!(
        error.to_string(),
        "Keychain error: Failed to verify saved password: retrieved value did not match the saved credential"
    );
}

#[test]
fn keyring_force_delete_fallback_warning_includes_status_and_stderr() {
    let warning = super::macos_security_cli::keyring_force_delete_fallback_warning(
        "exit status: 44",
        " denied\n",
    );

    assert_eq!(
        warning,
        "keyring force-delete fallback failed status=exit status: 44 stderr=<redacted stderr bytes=8>"
    );
}

#[test]
fn keyring_force_delete_fallback_warning_redacts_control_characters() {
    let warning = super::macos_security_cli::keyring_force_delete_fallback_warning(
        "exit status: 44",
        " denied\u{7}\nsecret",
    );

    assert_eq!(
        warning,
        "keyring force-delete fallback failed status=exit status: 44 stderr=<redacted stderr bytes=15>"
    );
}

#[cfg(target_os = "macos")]
#[test]
fn security_cli_wait_returns_completed_output() {
    let child = std::process::Command::new("sh")
        .args(["-c", "printf ok"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();

    let output = super::macos_security_cli::wait_for_security_cli_output(
        child,
        super::macos_security_cli::KEYRING_SECURITY_CLI_TIMEOUT,
    )
    .expect("completed process should return output");

    assert!(output.status.success());
    assert_eq!(output.stdout, b"ok");
}

#[cfg(target_os = "macos")]
#[test]
fn security_cli_wait_times_out_and_kills_child() {
    let child = std::process::Command::new("sh")
        .args(["-c", "sleep 1"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();

    let error = super::macos_security_cli::wait_for_security_cli_output(
        child,
        std::time::Duration::from_millis(10),
    )
    .expect_err("slow process should time out");

    assert_eq!(
        error.to_string(),
        "Keychain error: Timed out reading password from macOS Keychain CLI"
    );
}

#[test]
fn delete_dev_password_at_path_is_idempotent_for_missing_entries() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let mut store = HashMap::new();
    store.insert("existing-account".to_string(), "secret".to_string());
    super::dev_store_file::write_dev_store(&path, &store)
        .expect("dev credential fixture should be writable");

    super::dev_store_lock::delete_dev_password_at_path(&path, "missing-account")
        .expect("missing dev credential cleanup should be a no-op");
    super::dev_store_lock::delete_dev_password_at_path(&path, "missing-account")
        .expect("repeated missing dev credential cleanup should stay a no-op");

    assert_eq!(super::dev_store_file::read_dev_store(&path).unwrap(), store);
}

#[test]
fn write_dev_store_replaces_via_temp_file_without_leaving_staging_copy() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let mut first_store = HashMap::new();
    first_store.insert("account-a".to_string(), "secret-a".to_string());
    let mut second_store = HashMap::new();
    second_store.insert("account-b".to_string(), "secret-b".to_string());

    super::dev_store_file::write_dev_store(&path, &first_store)
        .expect("initial dev credential store write should succeed");
    super::dev_store_file::write_dev_store(&path, &second_store)
        .expect("replacement dev credential store write should succeed");

    assert_eq!(
        super::dev_store_file::read_dev_store(&path).unwrap(),
        second_store
    );
    assert!(
        dir.path().read_dir().unwrap().all(|entry| !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .ends_with(".tmp")),
        "successful atomic replacement should not leave the staging file behind"
    );
}

#[test]
fn dev_store_temp_path_stays_next_to_final_store() {
    let path = Path::new("/tmp/ultra-rss-reader/dev-credentials.json");
    let temp_path = super::dev_store_file::dev_store_temp_path(path);

    assert_eq!(temp_path.parent(), path.parent());
    assert!(temp_path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with(".dev-credentials.json."));
    assert!(temp_path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .ends_with(".tmp"));
}

#[test]
fn dev_store_lock_path_stays_next_to_final_store() {
    let path = Path::new("/tmp/ultra-rss-reader/dev-credentials.json");

    assert_eq!(
        super::dev_store_file::dev_store_lock_path(path),
        PathBuf::from("/tmp/ultra-rss-reader/.dev-credentials.json.lock")
    );
}

#[test]
fn dev_credentials_store_survives_restart_readback_by_account_id() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let mut first_process_store = HashMap::new();
    first_process_store.insert("account-a".to_string(), "secret-a".to_string());
    first_process_store.insert("account-b".to_string(), "secret-b".to_string());

    super::dev_store_file::write_dev_store(&path, &first_process_store)
        .expect("dev credential fixture should be writable");

    let restarted_process_store = super::dev_store_file::read_dev_store(&path)
        .expect("dev credential store should be readable after restart");

    assert_eq!(
        restarted_process_store.get("account-a"),
        Some(&"secret-a".to_string())
    );
    assert_eq!(
        restarted_process_store.get("account-b"),
        Some(&"secret-b".to_string())
    );
    assert_eq!(restarted_process_store.get("missing-account"), None);
}

#[test]
fn dev_credentials_store_rejects_invalid_account_id_keys() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    std::fs::write(&path, r#"{"": "secret"}"#).unwrap();

    let error = super::dev_store_file::read_dev_store(&path)
        .expect_err("empty account id key should be rejected");

    assert!(error.to_string().contains(
        "Keychain error: Failed to validate dev store account id: account id cannot be empty"
    ));
    assert!(error
        .to_string()
        .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));

    let mut store = HashMap::new();
    store.insert("account\nid".to_string(), "secret".to_string());
    let error = super::dev_store_file::write_dev_store(&path, &store)
        .expect_err("control characters should be rejected before writing");

    assert!(error.to_string().contains(
        "Keychain error: Failed to validate dev store account id: account id cannot contain control characters"
    ));
}

#[cfg(unix)]
#[test]
fn dev_credentials_permission_failure_is_keychain_error() {
    let path = Path::new("/tmp/dev-credentials.json");

    let error =
        super::dev_store_lock::set_dev_store_owner_only_permissions_with(path, |_path, _perms| {
            Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "permission denied",
            ))
        })
        .expect_err("dev credential permission failure must be observable");

    assert!(matches!(error, DomainError::Keychain(_)));
    assert!(error
        .to_string()
        .contains("Keychain error: Failed to restrict dev store permissions: permission denied"));
    assert!(error
        .to_string()
        .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
}

#[test]
fn read_dev_store_ignores_stale_temp_file_next_to_valid_store() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let temp_path = super::dev_store_file::dev_store_temp_path(&path);
    let mut store = HashMap::new();
    store.insert("account".to_string(), "secret".to_string());
    super::dev_store_file::write_dev_store(&path, &store)
        .expect("valid dev credential store should be saved");
    std::fs::write(&temp_path, "{not-json").unwrap();

    assert_eq!(super::dev_store_file::read_dev_store(&path).unwrap(), store);
    assert_eq!(std::fs::read_to_string(&temp_path).unwrap(), "{not-json");
}

#[test]
fn read_dev_store_rejects_corrupted_json_without_overwriting_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    std::fs::write(&path, "{not-json").unwrap();

    let error = super::dev_store_file::read_dev_store(&path)
        .expect_err("corrupted dev credentials must fail closed");

    assert!(matches!(error, DomainError::Keychain(_)));
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "{not-json");
}

#[test]
fn read_dev_store_rejects_non_object_json() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    std::fs::write(&path, r#"["secret"]"#).unwrap();

    let error = super::dev_store_file::read_dev_store(&path)
        .expect_err("dev credentials must stay a JSON object");

    assert!(error
        .to_string()
        .contains("Keychain error: Failed to parse dev store: expected JSON object"));
    assert!(error
        .to_string()
        .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
}

#[test]
fn read_dev_store_rejects_non_string_values() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    std::fs::write(&path, r#"{"account":123}"#).unwrap();

    let error = super::dev_store_file::read_dev_store(&path)
        .expect_err("dev credential values must stay strings");

    assert!(error.to_string().contains(
        "Keychain error: Failed to parse dev store: value for key 'account' must be a string"
    ));
    assert!(error
        .to_string()
        .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
}

#[test]
fn read_dev_store_rejects_oversized_json() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    std::fs::write(
        &path,
        "x".repeat(super::dev_store_file::DEV_CREDENTIALS_MAX_BYTES as usize + 1),
    )
    .unwrap();

    let error = super::dev_store_file::read_dev_store(&path)
        .expect_err("oversized dev credentials must fail closed");

    assert!(error
        .to_string()
        .contains("Keychain error: Dev store exceeds maximum size of 65536 bytes"));
    assert!(error
        .to_string()
        .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
}

#[test]
fn dev_store_is_oversized_detects_only_files_above_limit() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");

    std::fs::write(
        &path,
        "x".repeat(super::dev_store_file::DEV_CREDENTIALS_MAX_BYTES as usize),
    )
    .unwrap();
    assert!(!super::dev_store_file::dev_store_is_oversized(&path).unwrap());

    std::fs::write(
        &path,
        "x".repeat(super::dev_store_file::DEV_CREDENTIALS_MAX_BYTES as usize + 1),
    )
    .unwrap();
    assert!(super::dev_store_file::dev_store_is_oversized(&path).unwrap());
}

#[test]
fn move_dev_store_recovery_artifacts_moves_store_lock_and_tmp_only() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let lock_path = dir.path().join(".dev-credentials.json.lock");
    let temp_path = dir.path().join(".dev-credentials.json.123.thread.tmp");
    let unrelated_path = dir.path().join(".dev-credentials.json.notes");
    let backup_dir = dir.path().join("backup");
    std::fs::write(&path, "store").unwrap();
    std::fs::write(&lock_path, "lock").unwrap();
    std::fs::write(&temp_path, "tmp").unwrap();
    std::fs::write(&unrelated_path, "notes").unwrap();

    let moved = super::dev_store_file::move_dev_store_recovery_artifacts(&path, &backup_dir)
        .expect("artifacts move");

    assert!(moved);
    assert!(!path.exists());
    assert!(!lock_path.exists());
    assert!(!temp_path.exists());
    assert!(unrelated_path.exists());
    assert_eq!(
        std::fs::read_to_string(backup_dir.join("dev-credentials.json")).unwrap(),
        "store"
    );
    assert_eq!(
        std::fs::read_to_string(backup_dir.join(".dev-credentials.json.lock")).unwrap(),
        "lock"
    );
    assert_eq!(
        std::fs::read_to_string(backup_dir.join(".dev-credentials.json.123.thread.tmp")).unwrap(),
        "tmp"
    );
}

#[test]
fn valid_dev_store_does_not_trigger_oversized_recovery() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let backup_dir = dir.path().join("backup");
    let mut store = HashMap::new();
    store.insert("account".to_string(), "secret".to_string());
    super::dev_store_file::write_dev_store(&path, &store).expect("valid store should be writable");

    if super::dev_store_file::dev_store_is_oversized(&path).unwrap() {
        super::dev_store_file::move_dev_store_recovery_artifacts(&path, &backup_dir).unwrap();
    }

    assert!(path.exists());
    assert!(!backup_dir.exists());
    assert_eq!(super::dev_store_file::read_dev_store(&path).unwrap(), store);
}

#[test]
fn write_dev_store_rejects_oversized_json() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let mut store = HashMap::new();
    store.insert(
        "account".to_string(),
        "x".repeat(super::dev_store_file::DEV_CREDENTIALS_MAX_BYTES as usize),
    );

    let error = super::dev_store_file::write_dev_store(&path, &store)
        .expect_err("oversized dev credentials must not be written");

    assert!(error
        .to_string()
        .contains("Keychain error: Dev store exceeds maximum size of 65536 bytes"));
    assert!(error
        .to_string()
        .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
    assert!(!path.exists());
}

#[test]
fn dev_store_file_lock_blocks_concurrent_process_writers() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let first_lock = super::dev_store_lock::DevStoreFileLock::acquire(&path)
        .expect("first process should acquire the dev store lock");

    let error = super::dev_store_lock::DevStoreFileLock::acquire_with_timeout(
        &path,
        std::time::Duration::from_millis(5),
        std::time::Duration::from_millis(1),
    )
    .expect_err("second process should observe the existing lock");

    assert!(error.to_string().contains(
        "Keychain error: Timed out waiting for dev store lock .dev-credentials.json.lock owner=pid="
    ));
    assert!(
        !error
            .to_string()
            .contains(dir.path().to_string_lossy().as_ref()),
        "lock timeout diagnostics should not expose the store directory"
    );
    assert!(error
        .to_string()
        .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
    drop(first_lock);
    super::dev_store_lock::DevStoreFileLock::acquire(&path)
        .expect("dev store lock should be reusable after release");
}

#[test]
fn dev_store_file_lock_recovers_stale_lock_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    let lock_path = super::dev_store_file::dev_store_lock_path(&path);
    std::fs::write(&lock_path, "pid=/Users/alice/secret\ncreated_unix_ms=1\n").unwrap();

    let lock = super::dev_store_lock::DevStoreFileLock::acquire_with_timeout_and_stale_after(
        &path,
        std::time::Duration::from_millis(5),
        std::time::Duration::from_millis(1),
        std::time::Duration::ZERO,
    )
    .expect("stale dev store lock should be recovered");

    assert!(lock_path.exists());
    let owner = std::fs::read_to_string(&lock_path).unwrap();
    assert!(owner.contains("pid="));
    assert!(!owner.contains("/Users/alice/secret"));
    drop(lock);
    assert!(!lock_path.exists());
}

#[test]
fn delete_dev_password_at_path_rejects_corrupted_json_without_overwriting_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("dev-credentials.json");
    std::fs::write(&path, "{not-json").unwrap();

    let error = super::dev_store_lock::delete_dev_password_at_path(&path, "account")
        .expect_err("corrupted dev credentials should block writes");

    assert!(matches!(error, DomainError::Keychain(_)));
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "{not-json");
}

#[test]
fn desktop_builds_use_persistent_keyring_backends() {
    let persistence = keyring::default::default_credential_builder().persistence();

    assert!(
        matches!(persistence, CredentialPersistence::UntilDelete),
        "desktop builds must use a persistent keyring backend; got non-persistent storage"
    );
}
