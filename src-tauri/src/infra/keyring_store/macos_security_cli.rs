#[cfg(target_os = "macos")]
use super::dev_store_file::validate_dev_credential_account_id;
#[cfg(target_os = "macos")]
use super::diagnostics::CredentialKind;
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
const SECURITY_CLI_PATH: &str = "/usr/bin/security";

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
enum KeyringReadFailureReason {
    Spawn,
    Poll,
    ReadOutput,
    Timeout,
    CliExit,
    InvalidEncoding,
    ParseOutput,
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
            Self::ParseOutput => "parse-output",
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
        std::process::Command::new(SECURITY_CLI_PATH),
        super::SERVICE,
        account_id,
        mode,
        mode.timeout(),
    )
}

#[cfg(target_os = "macos")]
fn read_password_from_security_cli_command(
    mut command: std::process::Command,
    service: &str,
    account_id: &str,
    mode: super::CredentialLookupMode,
    timeout: Duration,
) -> DomainResult<String> {
    validate_dev_credential_account_id(account_id)?;
    command.args([
        "find-generic-password",
        "-s",
        service,
        "-a",
        account_id,
        "-g",
    ]);
    let output = run_keyring_read_command(command, timeout).map_err(|failure| {
        failure.log(CredentialKind::FreshRssPassword, mode, timeout);
        failure.password_error()
    })?;

    if output.output.status.success() {
        let password = parse_security_cli_password(&output.output.stderr).map_err(|failure| {
            log_keyring_read_failure(
                CredentialKind::FreshRssPassword,
                mode,
                failure.reason(),
                output.elapsed,
                timeout,
                None,
                None,
            );
            failure.into_password_error()
        })?;
        if password.is_empty() {
            return Err(super::missing_password_error());
        }
        return Ok(password);
    }

    if output.output.status.code() == Some(ERR_SEC_ITEM_NOT_FOUND_EXIT_CODE) {
        return Err(super::missing_password_error());
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
    credential_kind: CredentialKind,
    service: &str,
    account_id: &str,
    mode: super::CredentialLookupMode,
) -> DomainResult<Option<String>> {
    read_credential_from_security_cli_command(
        std::process::Command::new(SECURITY_CLI_PATH),
        credential_kind,
        service,
        account_id,
        mode,
        mode.timeout(),
    )
}

#[cfg(target_os = "macos")]
fn read_credential_from_security_cli_command(
    mut command: std::process::Command,
    credential_kind: CredentialKind,
    service: &str,
    account_id: &str,
    mode: super::CredentialLookupMode,
    timeout: Duration,
) -> DomainResult<Option<String>> {
    command.args([
        "find-generic-password",
        "-s",
        service,
        "-a",
        account_id,
        "-g",
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
        return parse_security_cli_password(&output.stderr)
            .map(Some)
            .map_err(CredentialOutputFailure::from);
    }
    if output.status.code() == Some(ERR_SEC_ITEM_NOT_FOUND_EXIT_CODE) {
        return Ok(None);
    }
    Err(CredentialOutputFailure::CliExit(output.status.code()))
}

#[cfg(target_os = "macos")]
const ERR_SEC_ITEM_NOT_FOUND_EXIT_CODE: i32 = 44;

#[cfg(target_os = "macos")]
enum PasswordParseFailure {
    Unparseable,
    InvalidEncoding,
}

#[cfg(target_os = "macos")]
impl PasswordParseFailure {
    fn reason(&self) -> KeyringReadFailureReason {
        match self {
            Self::Unparseable => KeyringReadFailureReason::ParseOutput,
            Self::InvalidEncoding => KeyringReadFailureReason::InvalidEncoding,
        }
    }

    fn into_password_error(self) -> DomainError {
        DomainError::Keychain(
            match self {
                Self::Unparseable => "Failed to parse password from macOS Keychain CLI output",
                Self::InvalidEncoding => "Failed to decode password from macOS Keychain CLI",
            }
            .into(),
        )
    }
}

/// Parses the `password:` line that `security -g` writes to stderr. `-w` is not
/// used because it prints non-ASCII or backslash-containing values as bare hex.
/// Errors carry no output bytes because the line holds the secret.
#[cfg(target_os = "macos")]
fn parse_security_cli_password(stderr: &[u8]) -> Result<String, PasswordParseFailure> {
    let remainder = stderr
        .split(|byte| *byte == b'\n')
        .find_map(|line| line.strip_prefix(b"password:"))
        .ok_or(PasswordParseFailure::Unparseable)?;
    let remainder = remainder.strip_prefix(b" ").unwrap_or(remainder);
    let bytes = match remainder.first() {
        None => Vec::new(),
        Some(b'"') => {
            let end = remainder
                .iter()
                .rposition(|byte| *byte == b'"')
                .filter(|end| *end > 0)
                .ok_or(PasswordParseFailure::Unparseable)?;
            remainder[1..end].to_vec()
        }
        Some(_) => decode_hex_password(remainder)?,
    };
    String::from_utf8(bytes).map_err(|_| PasswordParseFailure::InvalidEncoding)
}

#[cfg(target_os = "macos")]
fn decode_hex_password(remainder: &[u8]) -> Result<Vec<u8>, PasswordParseFailure> {
    let digits = remainder
        .strip_prefix(b"0x")
        .ok_or(PasswordParseFailure::Unparseable)?;
    let digits = digits
        .split(|byte| byte.is_ascii_whitespace())
        .next()
        .unwrap_or_default();
    if digits.is_empty() || digits.len() % 2 != 0 {
        return Err(PasswordParseFailure::Unparseable);
    }
    let (pairs, _) = digits.as_chunks::<2>();
    pairs
        .iter()
        .map(|pair| {
            let high = hex_digit_value(pair[0])?;
            let low = hex_digit_value(pair[1])?;
            Ok(high << 4 | low)
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn hex_digit_value(digit: u8) -> Result<u8, PasswordParseFailure> {
    char::from(digit)
        .to_digit(16)
        .and_then(|value| u8::try_from(value).ok())
        .ok_or(PasswordParseFailure::Unparseable)
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
    ParseOutput,
    CliExit(Option<i32>),
}

#[cfg(target_os = "macos")]
impl From<PasswordParseFailure> for CredentialOutputFailure {
    fn from(failure: PasswordParseFailure) -> Self {
        match failure {
            PasswordParseFailure::Unparseable => Self::ParseOutput,
            PasswordParseFailure::InvalidEncoding => Self::InvalidEncoding,
        }
    }
}

#[cfg(target_os = "macos")]
impl CredentialOutputFailure {
    fn reason(&self) -> KeyringReadFailureReason {
        match self {
            Self::InvalidEncoding => KeyringReadFailureReason::InvalidEncoding,
            Self::ParseOutput => KeyringReadFailureReason::ParseOutput,
            Self::CliExit(_) => KeyringReadFailureReason::CliExit,
        }
    }

    fn exit_code(&self) -> Option<i32> {
        match self {
            Self::InvalidEncoding | Self::ParseOutput => None,
            Self::CliExit(code) => *code,
        }
    }

    fn into_domain_error(self) -> DomainError {
        match self {
            Self::InvalidEncoding => {
                DomainError::Keychain("Invalid OS keyring entry encoding".into())
            }
            Self::ParseOutput => {
                DomainError::Keychain("Failed to parse OS keyring entry output".into())
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

    fn parse(stderr: &str) -> Option<String> {
        super::parse_security_cli_password(stderr.as_bytes()).ok()
    }

    #[test]
    fn parses_quoted_and_hex_password_lines_from_security_g_output() {
        for (stderr, expected) in [
            ("password: \"0x41\"\n", "0x41"),
            ("password: \"c3a9\"\n", "c3a9"),
            (
                "password: \"{\"client_id\":\"x\",\"client_secret\":\"y\"}\"\n",
                "{\"client_id\":\"x\",\"client_secret\":\"y\"}",
            ),
            (
                "keychain: \"/x\"\nversion: 512\npassword: 0x70C3A4737377C3B672642DE38386E382B9E38388  \"p\\303\\244ssw\\303\\266rd-\\343\\203\\206\\343\\202\\271\\343\\203\\210\"\n",
                "pässwörd-テスト",
            ),
            (
                "password: 0x77697468202271756F74652220616E64205C6261636B  \"with \"quote\" and \\134back\"\n",
                "with \"quote\" and \\back",
            ),
            ("password: 0x6162\n", "ab"),
            ("password: \n", ""),
        ] {
            assert_eq!(parse(stderr).as_deref(), Some(expected), "{stderr}");
        }
    }

    #[test]
    fn malformed_security_g_output_fails_without_leaking_stderr() {
        let sentinel = "leak-sentinel";
        for stderr in [
            format!("{sentinel}\n"),
            String::new(),
            format!("password: 0x123 {sentinel}\n"),
            format!("password: 0xZZ {sentinel}\n"),
            format!("password: 0x {sentinel}\n"),
            format!("password: {sentinel}\n"),
            format!("password: \"{sentinel}\n"),
        ] {
            let Err(failure) = super::parse_security_cli_password(stderr.as_bytes()) else {
                panic!("expected parse failure for {stderr:?}");
            };
            let message = format!("{}", failure.into_password_error());
            assert!(!message.contains(sentinel), "{message}");
        }
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
        let output = |code, stderr: &[u8]| std::process::Output {
            status: std::process::ExitStatus::from_raw(code << 8),
            stdout: vec![],
            stderr: stderr.to_vec(),
        };
        assert_eq!(
            super::decode_credential_output(output(44, b"")).unwrap(),
            None
        );
        assert_eq!(
            super::decode_credential_output(output(0, b"password: \"dummy-json\"\n"))
                .unwrap()
                .as_deref(),
            Some("dummy-json")
        );
        for response in [
            output(36, b"cfast_dummy_secret"),
            output(0, b"cfast_dummy_secret"),
            output(0, b"password: 0xFF\n"),
        ] {
            let error = super::decode_credential_output(response).unwrap_err();
            assert!(!format!("{error:?} {error}").contains("cfast_dummy_secret"));
        }
    }
}

#[cfg(all(test, target_os = "macos"))]
#[path = "macos_security_cli_diagnostics_tests.rs"]
mod diagnostics_tests;

#[cfg(all(test, target_os = "macos"))]
#[path = "macos_security_cli_real_keychain_tests.rs"]
mod real_keychain_tests;
