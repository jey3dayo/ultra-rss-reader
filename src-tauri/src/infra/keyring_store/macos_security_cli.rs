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

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
enum CredentialKind {
    FreshRssPassword,
    CloudflareAccess,
    Other,
}

#[cfg(target_os = "macos")]
impl CredentialKind {
    fn label(self) -> &'static str {
        match self {
            Self::FreshRssPassword => "freshrss-password",
            Self::CloudflareAccess => "cloudflare-access",
            Self::Other => "other",
        }
    }
}

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
enum KeyringReadFailureReason {
    Spawn,
    Poll,
    ReadOutput,
    Timeout,
    CliExit,
    InvalidEncoding,
}

#[cfg(target_os = "macos")]
impl KeyringReadFailureReason {
    fn label(self) -> &'static str {
        match self {
            Self::Spawn => "spawn",
            Self::Poll => "poll",
            Self::ReadOutput => "read-output",
            Self::Timeout => "timeout",
            Self::CliExit => "cli-exit",
            Self::InvalidEncoding => "invalid-encoding",
        }
    }
}

#[cfg(target_os = "macos")]
fn log_keyring_read_failure(
    credential_kind: CredentialKind,
    mode: super::CredentialLookupMode,
    failure_reason: KeyringReadFailureReason,
    elapsed: Duration,
    timeout: Duration,
    os_error_code: Option<i32>,
    exit_code: Option<i32>,
) {
    let mode = match mode {
        super::CredentialLookupMode::Background => "background",
        super::CredentialLookupMode::Interactive => "interactive",
    };
    let mut diagnostic = format!(
        "event=keyring-read-failed credential_kind={} mode={} failure_reason={} elapsed_ms={} timeout_ms={}",
        credential_kind.label(),
        mode,
        failure_reason.label(),
        elapsed.as_millis(),
        timeout.as_millis()
    );
    if let Some(code) = os_error_code {
        diagnostic.push_str(&format!(" os_error_code={code}"));
    }
    if let Some(code) = exit_code {
        diagnostic.push_str(&format!(" exit_code={code}"));
    }
    log::warn!(target: "keyring_store::macos_security_cli", "{diagnostic}");
}

#[cfg(target_os = "macos")]
fn credential_kind_for_service(service: &str) -> CredentialKind {
    match service {
        super::SERVICE => CredentialKind::FreshRssPassword,
        super::cloudflare_access::SERVICE => CredentialKind::CloudflareAccess,
        _ => CredentialKind::Other,
    }
}

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

#[cfg(all(test, target_os = "macos"))]
pub(super) fn wait_for_security_cli_output(
    child: std::process::Child,
    timeout: Duration,
) -> DomainResult<std::process::Output> {
    wait_for_security_cli_output_with_failure(child, timeout)
        .map_err(|failure| DomainError::Keychain(failure.to_string()))
}

#[cfg(target_os = "macos")]
fn wait_for_security_cli_output_with_failure(
    mut child: std::process::Child,
    timeout: Duration,
) -> Result<std::process::Output, SecurityCliWaitFailure> {
    let started_at = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                return child
                    .wait_with_output()
                    .map_err(SecurityCliWaitFailure::ReadOutput);
            }
            Ok(None) if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(SecurityCliWaitFailure::Timeout);
            }
            Ok(None) => std::thread::sleep(
                KEYRING_SECURITY_CLI_RETRY_DELAY.min(timeout.saturating_sub(started_at.elapsed())),
            ),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(SecurityCliWaitFailure::Poll(error));
            }
        }
    }
}

#[cfg(target_os = "macos")]
pub(super) fn get_password_from_security_cli(
    account_id: &str,
    mode: super::CredentialLookupMode,
) -> DomainResult<String> {
    read_password_from_security_cli_command(
        std::process::Command::new("security"),
        account_id,
        mode,
        mode.timeout(),
    )
}

#[cfg(target_os = "macos")]
fn read_password_from_security_cli_command(
    mut command: std::process::Command,
    account_id: &str,
    mode: super::CredentialLookupMode,
    timeout: Duration,
) -> DomainResult<String> {
    validate_dev_credential_account_id(account_id)?;
    command.args([
        "find-generic-password",
        "-s",
        super::SERVICE,
        "-a",
        account_id,
        "-w",
    ]);
    let output = run_keyring_read_command(command, timeout).map_err(|failure| {
        failure.log(CredentialKind::FreshRssPassword, mode, timeout);
        failure.password_error()
    })?;

    if output.output.status.success() {
        let password = String::from_utf8(output.output.stdout)
            .map_err(|error| {
                log_keyring_read_failure(
                    CredentialKind::FreshRssPassword,
                    mode,
                    KeyringReadFailureReason::InvalidEncoding,
                    output.elapsed,
                    timeout,
                    None,
                    None,
                );
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

    log_keyring_read_failure(
        CredentialKind::FreshRssPassword,
        mode,
        KeyringReadFailureReason::CliExit,
        output.elapsed,
        timeout,
        None,
        output.output.status.code(),
    );
    Err(DomainError::Keychain(format!(
        "macOS Keychain CLI failed status={} stderr={}",
        redact_diagnostic_text(&output.output.status.to_string()),
        redact_stderr_text(&String::from_utf8_lossy(&output.output.stderr))
    )))
}

#[cfg(target_os = "macos")]
pub(super) fn get_credential_from_security_cli(
    service: &str,
    account_id: &str,
    mode: super::CredentialLookupMode,
) -> DomainResult<Option<String>> {
    read_credential_from_security_cli_command(
        std::process::Command::new("security"),
        service,
        account_id,
        mode,
        mode.timeout(),
    )
}

#[cfg(target_os = "macos")]
fn read_credential_from_security_cli_command(
    mut command: std::process::Command,
    service: &str,
    account_id: &str,
    mode: super::CredentialLookupMode,
    timeout: Duration,
) -> DomainResult<Option<String>> {
    let credential_kind = credential_kind_for_service(service);
    command.args([
        "find-generic-password",
        "-s",
        service,
        "-a",
        account_id,
        "-w",
    ]);
    let output = run_keyring_read_command(command, timeout).map_err(|failure| {
        failure.log(credential_kind, mode, timeout);
        failure.credential_error()
    })?;
    decode_credential_output_with_failure(output.output).map_err(|failure| {
        log_keyring_read_failure(
            credential_kind,
            mode,
            failure.reason(),
            output.elapsed,
            timeout,
            None,
            failure.exit_code(),
        );
        failure.into_domain_error()
    })
}

#[cfg(all(test, target_os = "macos"))]
fn decode_credential_output(output: std::process::Output) -> DomainResult<Option<String>> {
    decode_credential_output_with_failure(output).map_err(|failure| failure.into_domain_error())
}

#[cfg(target_os = "macos")]
fn decode_credential_output_with_failure(
    output: std::process::Output,
) -> Result<Option<String>, CredentialOutputFailure> {
    if output.status.success() {
        let value = String::from_utf8(output.stdout)
            .map_err(|_| CredentialOutputFailure::InvalidEncoding)?;
        // `security -w` appends one newline; preserve opaque credential bytes.
        return Ok(Some(value.strip_suffix('\n').unwrap_or(&value).to_string()));
    }
    if output.status.code() == Some(44) {
        return Ok(None);
    }
    Err(CredentialOutputFailure::CliExit(output.status.code()))
}

#[cfg(target_os = "macos")]
struct SecurityCliReadOutput {
    output: std::process::Output,
    elapsed: Duration,
}

#[cfg(target_os = "macos")]
enum SecurityCliWaitFailure {
    ReadOutput(std::io::Error),
    Timeout,
    Poll(std::io::Error),
}

#[cfg(target_os = "macos")]
impl SecurityCliWaitFailure {
    fn reason(&self) -> KeyringReadFailureReason {
        match self {
            Self::ReadOutput(_) => KeyringReadFailureReason::ReadOutput,
            Self::Timeout => KeyringReadFailureReason::Timeout,
            Self::Poll(_) => KeyringReadFailureReason::Poll,
        }
    }

    fn os_error_code(&self) -> Option<i32> {
        match self {
            Self::ReadOutput(error) | Self::Poll(error) => error.raw_os_error(),
            Self::Timeout => None,
        }
    }
}

#[cfg(target_os = "macos")]
impl std::fmt::Display for SecurityCliWaitFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ReadOutput(error) => {
                write!(
                    f,
                    "Failed to read password from macOS Keychain CLI: {error}"
                )
            }
            Self::Timeout => write!(f, "Timed out reading password from macOS Keychain CLI"),
            Self::Poll(error) => {
                write!(f, "Failed to poll macOS Keychain CLI: {error}")
            }
        }
    }
}

#[cfg(target_os = "macos")]
enum SecurityCliRunFailure {
    Spawn(std::io::Error, Duration),
    Wait(SecurityCliWaitFailure, Duration),
}

#[cfg(target_os = "macos")]
impl SecurityCliRunFailure {
    fn log(
        &self,
        credential_kind: CredentialKind,
        mode: super::CredentialLookupMode,
        timeout: Duration,
    ) {
        let (reason, elapsed, os_error_code) = match self {
            Self::Spawn(error, elapsed) => (
                KeyringReadFailureReason::Spawn,
                *elapsed,
                error.raw_os_error(),
            ),
            Self::Wait(failure, elapsed) => (failure.reason(), *elapsed, failure.os_error_code()),
        };
        log_keyring_read_failure(
            credential_kind,
            mode,
            reason,
            elapsed,
            timeout,
            os_error_code,
            None,
        );
    }

    fn password_error(self) -> DomainError {
        match self {
            Self::Spawn(error, _) => {
                DomainError::Keychain(format!("Failed to run macOS Keychain CLI: {error}"))
            }
            Self::Wait(failure, _) => DomainError::Keychain(failure.to_string()),
        }
    }

    fn credential_error(self) -> DomainError {
        match self {
            Self::Spawn(_, _) => DomainError::Keychain("Could not read OS keyring entry".into()),
            Self::Wait(failure, _) => DomainError::Keychain(failure.to_string()),
        }
    }
}

#[cfg(target_os = "macos")]
fn run_keyring_read_command(
    mut command: std::process::Command,
    timeout: Duration,
) -> Result<SecurityCliReadOutput, SecurityCliRunFailure> {
    let started_at = Instant::now();
    let child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| SecurityCliRunFailure::Spawn(error, started_at.elapsed()))?;
    let output = wait_for_security_cli_output_with_failure(child, timeout)
        .map_err(|failure| SecurityCliRunFailure::Wait(failure, started_at.elapsed()))?;
    Ok(SecurityCliReadOutput {
        output,
        elapsed: started_at.elapsed(),
    })
}

#[cfg(target_os = "macos")]
enum CredentialOutputFailure {
    InvalidEncoding,
    CliExit(Option<i32>),
}

#[cfg(target_os = "macos")]
impl CredentialOutputFailure {
    fn reason(&self) -> KeyringReadFailureReason {
        match self {
            Self::InvalidEncoding => KeyringReadFailureReason::InvalidEncoding,
            Self::CliExit(_) => KeyringReadFailureReason::CliExit,
        }
    }

    fn exit_code(&self) -> Option<i32> {
        match self {
            Self::InvalidEncoding => None,
            Self::CliExit(code) => *code,
        }
    }

    fn into_domain_error(self) -> DomainError {
        match self {
            Self::InvalidEncoding => {
                DomainError::Keychain("Invalid OS keyring entry encoding".into())
            }
            Self::CliExit(_) => DomainError::Keychain(
                "Could not read OS keyring entry. Allow keyring access and try again.".into(),
            ),
        }
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use std::time::Duration;

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

        super::run_force_delete_keychain_entry(command, Duration::from_millis(10));
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

#[cfg(all(test, target_os = "macos"))]
#[path = "macos_security_cli_diagnostics_tests.rs"]
mod diagnostics_tests;
