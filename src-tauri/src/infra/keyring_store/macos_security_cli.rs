#[cfg(target_os = "macos")]
use super::dev_store_file::validate_dev_credential_account_id;
#[cfg(any(target_os = "macos", test))]
use super::redaction::redact_diagnostic_text;
#[cfg(any(target_os = "macos", test))]
use super::redaction::redact_stderr_text;
#[cfg(target_os = "macos")]
use crate::domain::error::{DomainError, DomainResult};
#[cfg(target_os = "macos")]
use std::time::{Duration, Instant};

#[cfg(all(test, target_os = "macos"))]
pub(super) const KEYRING_SECURITY_CLI_TIMEOUT: Duration = Duration::from_secs(5);
#[cfg(target_os = "macos")]
const KEYRING_SECURITY_CLI_RETRY_DELAY: Duration = Duration::from_millis(25);

#[cfg(test)]
pub(super) fn keyring_force_delete_fallback_warning(status: &str, stderr: &str) -> String {
    format!(
        "keyring force-delete fallback failed status={} stderr={}",
        redact_diagnostic_text(status),
        redact_stderr_text(stderr)
    )
}

/// Delete a keychain entry via the `security` CLI, bypassing ACL restrictions
/// that prevent the keyring crate from deleting entries created by a differently-signed binary.
#[cfg(all(test, target_os = "macos"))]
fn run_force_delete_keychain_entry(mut command: std::process::Command, timeout: Duration) {
    let child = match command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            tracing::warn!("keyring force-delete fallback failed to run: {error}");
            return;
        }
    };

    match wait_for_security_cli_output(child, timeout) {
        Ok(output) if output.status.success() => {}
        Ok(output) => tracing::warn!(
            "{}",
            keyring_force_delete_fallback_warning(
                &output.status.to_string(),
                &String::from_utf8_lossy(&output.stderr)
            )
        ),
        Err(error) => tracing::warn!("keyring force-delete fallback failed: {error}"),
    }
}

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
            Ok(None) => std::thread::sleep(
                KEYRING_SECURITY_CLI_RETRY_DELAY.min(timeout.saturating_sub(started_at.elapsed())),
            ),
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
pub(super) fn get_password_from_security_cli(
    account_id: &str,
    timeout: Duration,
) -> DomainResult<String> {
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
    let output = wait_for_security_cli_output(child, timeout)?;

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

#[cfg(target_os = "macos")]
pub(super) fn get_credential_from_security_cli(
    service: &str,
    account_id: &str,
    timeout: Duration,
) -> DomainResult<Option<String>> {
    let child = std::process::Command::new("security")
        .args([
            "find-generic-password",
            "-s",
            service,
            "-a",
            account_id,
            "-w",
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|_| DomainError::Keychain("Could not read OS keyring entry".into()))?;
    let output = wait_for_security_cli_output(child, timeout)?;
    decode_credential_output(output)
}

#[cfg(target_os = "macos")]
fn decode_credential_output(output: std::process::Output) -> DomainResult<Option<String>> {
    if output.status.success() {
        let value = String::from_utf8(output.stdout)
            .map_err(|_| DomainError::Keychain("Invalid OS keyring entry encoding".into()))?;
        // `security -w` appends one newline; preserve opaque credential bytes.
        return Ok(Some(value.strip_suffix('\n').unwrap_or(&value).to_string()));
    }
    if output.status.code() == Some(44) {
        return Ok(None);
    }
    Err(DomainError::Keychain(
        "Could not read OS keyring entry. Allow keyring access and try again.".into(),
    ))
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::run_force_delete_keychain_entry;

    fn delayed_child() -> std::process::Child {
        std::process::Command::new("/bin/sleep")
            .arg("0.15")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .expect("dummy permission child should start")
    }

    #[test]
    fn interactive_lookup_allows_permission_delay_beyond_background_deadline() {
        use crate::infra::keyring_store::CredentialLookupMode;
        let background_timeout = CredentialLookupMode::Background.timeout().div_f64(100.0);
        let interactive_timeout = CredentialLookupMode::Interactive.timeout().div_f64(100.0);
        let background_error =
            super::wait_for_security_cli_output(delayed_child(), background_timeout)
                .expect_err("background lookup should retain its shorter deadline");
        assert!(background_error.to_string().contains("Timed out"));
        let interactive = super::wait_for_security_cli_output(delayed_child(), interactive_timeout)
            .expect("interactive lookup should wait long enough for permission success");
        assert!(interactive.status.success());
    }

    #[test]
    fn deadline_reaps_child_and_allows_a_fresh_retry() {
        let child = delayed_child();
        let child_id = child.id().to_string();
        let error =
            super::wait_for_security_cli_output(child, std::time::Duration::from_millis(10))
                .expect_err("deadline should kill and reap the permission child");
        assert!(error.to_string().contains("Timed out"));
        let still_exists = std::process::Command::new("/bin/kill")
            .args(["-0", &child_id])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .expect("dummy child existence check should run");
        assert!(
            !still_exists.success(),
            "deadline must leave no live or unreaped child"
        );
        assert!(super::wait_for_security_cli_output(
            delayed_child(),
            std::time::Duration::from_millis(600)
        )
        .expect("fresh retry should not inherit the first child's deadline")
        .status
        .success());
    }

    #[test]
    fn force_delete_keychain_entry_ignores_cli_timeout() {
        let mut command = std::process::Command::new("sh");
        command.args(["-c", "sleep 1"]);

        run_force_delete_keychain_entry(command, std::time::Duration::from_millis(10));
    }
    #[test]
    fn cloudflare_access_security_output_distinguishes_absence_and_redacts_failures() {
        use std::os::unix::process::ExitStatusExt;
        let output = |code, stdout: Vec<u8>| std::process::Output {
            status: std::process::ExitStatus::from_raw(code << 8),
            stdout,
            stderr: b"cfast_dummy_secret".to_vec(),
        };
        assert_eq!(
            super::decode_credential_output(output(44, vec![])).unwrap(),
            None
        );
        assert_eq!(
            super::decode_credential_output(output(0, b"dummy-json\n".to_vec()))
                .unwrap()
                .as_deref(),
            Some("dummy-json")
        );
        for response in [output(36, vec![]), output(0, vec![0xff])] {
            let error = super::decode_credential_output(response).unwrap_err();
            assert!(!format!("{error:?} {error}").contains("cfast_dummy_secret"));
        }
    }
}
