use super::dev_store_file::validate_dev_credential_account_id;
use super::redaction::redact_diagnostic_text;
#[cfg(any(target_os = "macos", test))]
use super::redaction::redact_stderr_text;
use crate::domain::error::{DomainError, DomainResult};
#[cfg(target_os = "macos")]
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
pub(super) const KEYRING_SECURITY_CLI_TIMEOUT: Duration = Duration::from_secs(5);
#[cfg(target_os = "macos")]
const KEYRING_SECURITY_CLI_RETRY_DELAY: Duration = Duration::from_millis(25);

#[cfg(any(target_os = "macos", test))]
pub(super) fn keyring_force_delete_fallback_warning(status: &str, stderr: &str) -> String {
    format!(
        "keyring force-delete fallback failed status={} stderr={}",
        redact_diagnostic_text(status),
        redact_stderr_text(stderr)
    )
}

/// Delete a keychain entry via the `security` CLI, bypassing ACL restrictions
/// that prevent the keyring crate from deleting entries created by a differently-signed binary.
#[cfg(target_os = "macos")]
pub(super) fn force_delete_keychain_entry(account_id: &str) {
    match std::process::Command::new("security")
        .args([
            "delete-generic-password",
            "-s",
            super::SERVICE,
            "-a",
            account_id,
        ])
        .output()
    {
        Ok(output) if output.status.success() => {}
        Ok(output) => tracing::warn!(
            "{}",
            keyring_force_delete_fallback_warning(
                &output.status.to_string(),
                &String::from_utf8_lossy(&output.stderr)
            )
        ),
        Err(error) => tracing::warn!("keyring force-delete fallback failed to run: {error}"),
    }
}

#[cfg(not(target_os = "macos"))]
pub(super) fn force_delete_keychain_entry(_account_id: &str) {}

#[cfg(target_os = "macos")]
pub(super) fn wait_for_security_cli_output(
    mut child: std::process::Child,
    timeout: Duration,
) -> DomainResult<std::process::Output> {
    let started_at = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                return child.wait_with_output().map_err(|error| {
                    DomainError::Keychain(format!(
                        "Failed to read password from macOS Keychain CLI: {error}"
                    ))
                });
            }
            Ok(None) if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(DomainError::Keychain(
                    "Timed out reading password from macOS Keychain CLI".to_string(),
                ));
            }
            Ok(None) => std::thread::sleep(KEYRING_SECURITY_CLI_RETRY_DELAY),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(DomainError::Keychain(format!(
                    "Failed to poll macOS Keychain CLI: {error}"
                )));
            }
        }
    }
}

#[cfg(target_os = "macos")]
pub(super) fn get_password_from_security_cli(account_id: &str) -> DomainResult<String> {
    validate_dev_credential_account_id(account_id)?;
    let child = std::process::Command::new("security")
        .args([
            "find-generic-password",
            "-s",
            super::SERVICE,
            "-a",
            account_id,
            "-w",
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| {
            DomainError::Keychain(format!("Failed to run macOS Keychain CLI: {error}"))
        })?;
    let output = wait_for_security_cli_output(child, KEYRING_SECURITY_CLI_TIMEOUT)?;

    if output.status.success() {
        let password = String::from_utf8(output.stdout)
            .map_err(|error| {
                DomainError::Keychain(format!(
                    "Failed to decode password from macOS Keychain CLI: {error}"
                ))
            })?
            .trim_end_matches(['\r', '\n'])
            .to_string();
        if password.is_empty() {
            return Err(super::missing_password_error());
        }
        return Ok(password);
    }

    Err(DomainError::Keychain(format!(
        "macOS Keychain CLI failed status={} stderr={}",
        redact_diagnostic_text(&output.status.to_string()),
        redact_stderr_text(&String::from_utf8_lossy(&output.stderr))
    )))
}
