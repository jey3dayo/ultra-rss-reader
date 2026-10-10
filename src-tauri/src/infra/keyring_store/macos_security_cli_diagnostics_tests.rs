use super::CredentialKind;
use super::{read_credential_from_security_cli_command, read_password_from_security_cli_command};
use std::time::Duration;

const LOG_CHILD_ENV: &str = "URR_KEYRING_DIAGNOSTIC_LOG_SCENARIO";
const ACCOUNT_SENTINEL: &str = "account-id-sentinel";
const SERVICE_URL_SENTINEL: &str = "https://url-sentinel.invalid/tenant";
const SECRET_SENTINEL: &str = "secret-sentinel";
const STDOUT_SENTINEL: &str = "stdout-sentinel";
const STDERR_SENTINEL: &str = "stderr-sentinel";

struct CapturingLogger;

impl log::Log for CapturingLogger {
    fn enabled(&self, metadata: &log::Metadata<'_>) -> bool {
        metadata.level() <= log::Level::Warn
    }

    fn log(&self, record: &log::Record<'_>) {
        if self.enabled(record.metadata()) {
            println!("{}", record.args());
        }
    }

    fn flush(&self) {}
}

static CAPTURING_LOGGER: CapturingLogger = CapturingLogger;

#[test]
fn read_failure_events_are_emitted_safely_in_isolated_subprocesses() {
    if let Some(scenario) = std::env::var_os(LOG_CHILD_ENV) {
        log::set_logger(&CAPTURING_LOGGER)
            .expect("isolated diagnostic child should install its logger");
        log::set_max_level(log::LevelFilter::Warn);
        exercise_read_failure_scenario(
            scenario
                .to_str()
                .expect("test scenario name should be valid UTF-8"),
        );
        return;
    }

    let test_name = format!(
        "{}::read_failure_events_are_emitted_safely_in_isolated_subprocesses",
        module_path!()
            .split_once("::")
            .expect("diagnostic module path should include the crate name")
            .1
    );
    for (scenario, expected_reason, expected_kind, expected_mode, expected_exit_code) in [
        (
            "spawn",
            Some("spawn"),
            "cloudflare-access",
            "background",
            None,
        ),
        (
            "timeout",
            Some("timeout"),
            "cloudflare-access",
            "background",
            None,
        ),
        (
            "interactive-timeout",
            Some("timeout"),
            "cloudflare-access",
            "interactive",
            None,
        ),
        (
            "cli-exit",
            Some("cli-exit"),
            "cloudflare-access",
            "background",
            Some(23),
        ),
        (
            "invalid-encoding",
            Some("invalid-encoding"),
            "cloudflare-access",
            "background",
            None,
        ),
        (
            "parse-output",
            Some("parse-output"),
            "cloudflare-access",
            "background",
            None,
        ),
        (
            "fresh-parse-output",
            Some("parse-output"),
            "freshrss-password",
            "background",
            None,
        ),
        (
            "fresh-missing",
            None,
            "freshrss-password",
            "background",
            None,
        ),
        (
            "fresh-cli-exit",
            Some("cli-exit"),
            "freshrss-password",
            "background",
            Some(23),
        ),
        (
            "other-cli-exit",
            Some("cli-exit"),
            "cloudflare-access",
            "background",
            Some(23),
        ),
        ("missing", None, "cloudflare-access", "background", None),
    ] {
        let output = std::process::Command::new(
            std::env::current_exe().expect("test binary path should be available"),
        )
        .arg("--exact")
        .arg(&test_name)
        .arg("--nocapture")
        .env(LOG_CHILD_ENV, scenario)
        .output()
        .expect("isolated diagnostic test subprocess should start");
        assert!(
            output.status.success(),
            "diagnostic scenario {scenario} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let stdout = String::from_utf8(output.stdout)
            .expect("captured diagnostic subprocess output should be UTF-8");
        assert!(
            stdout.lines().any(|line| line == "running 1 test"),
            "scenario {scenario} should run exactly one child test: {stdout}"
        );
        assert!(
            stdout.contains("test result: ok. 1 passed; 0 failed;"),
            "scenario {scenario} should complete its child test: {stdout}"
        );
        let events = stdout
            .lines()
            .filter(|line| line.contains("event=keyring-read-failed"))
            .collect::<Vec<_>>();

        if let Some(expected_reason) = expected_reason {
            assert_eq!(events.len(), 1, "scenario {scenario} should log once");
            let event = events[0];
            assert!(event.contains("event=keyring-read-failed"));
            assert!(
                event.contains(&format!("credential_kind={expected_kind}")),
                "scenario {scenario} expected credential_kind={expected_kind}: {event}"
            );
            assert!(
                event.contains(&format!("mode={expected_mode}")),
                "scenario {scenario} expected mode={expected_mode}: {event}"
            );
            assert!(
                event.contains(&format!("failure_reason={expected_reason}")),
                "scenario {scenario} expected failure_reason={expected_reason}: {event}"
            );
            assert!(event.contains("elapsed_ms="));
            assert!(event.contains("timeout_ms="));
            for field in ["elapsed_ms", "timeout_ms"] {
                let value = event
                    .split_whitespace()
                    .find_map(|part| part.strip_prefix(&format!("{field}=")))
                    .expect("required duration field should be present");
                value
                    .parse::<u128>()
                    .expect("duration field should contain only a number");
            }
            if let Some(expected_exit_code) = expected_exit_code {
                assert!(event.contains(&format!("exit_code={expected_exit_code}")));
            }
            for sentinel in [
                ACCOUNT_SENTINEL,
                SERVICE_URL_SENTINEL,
                SECRET_SENTINEL,
                STDOUT_SENTINEL,
                STDERR_SENTINEL,
                "/tmp/path-sentinel",
                super::super::cloudflare_access::SERVICE,
            ] {
                assert!(
                    !event.contains(sentinel),
                    "diagnostic event leaked sentinel {sentinel}: {event}"
                );
            }
        } else {
            assert!(
                events.is_empty(),
                "normal missing optional Access should not log a failure"
            );
        }
    }
}

fn exercise_read_failure_scenario(scenario: &str) {
    let timeout = match scenario {
        "timeout" | "interactive-timeout" => Duration::from_millis(30),
        _ => super::super::CredentialLookupMode::Background.timeout(),
    };
    let command = match scenario {
        "spawn" => std::process::Command::new("/missing/keyring-cli-sentinel"),
        "timeout" | "interactive-timeout" => {
            let mut command = std::process::Command::new("/bin/sh");
            command.args(["-c", "exec /bin/sleep 2", "test-command"]);
            command
        }
        "invalid-encoding" => {
            let mut command = std::process::Command::new("/bin/sh");
            command.args([
                "-c",
                "printf 'stdout-sentinel'; printf 'password: 0xFF' >&2",
                "test-command",
            ]);
            command
        }
        "parse-output" | "fresh-parse-output" => {
            let mut command = std::process::Command::new("/bin/sh");
            command.args([
                "-c",
                "printf 'stdout-sentinel'; printf 'stderr-sentinel secret-sentinel' >&2",
                "test-command",
            ]);
            command
        }
        "missing" | "fresh-missing" => {
            let mut command = std::process::Command::new("/bin/sh");
            command.args(["-c", "exit 44", "test-command"]);
            command
        }
        "cli-exit" | "fresh-cli-exit" | "other-cli-exit" => {
            let mut command = std::process::Command::new("/bin/sh");
            command.args([
                    "-c",
                    "printf 'stdout-sentinel'; printf 'stderr-sentinel https://url-sentinel.invalid/tenant /tmp/path-sentinel secret-sentinel' >&2; exit 23",
                    "test-command",
                ]);
            command
        }
        _ => panic!("unexpected diagnostic test scenario: {scenario}"),
    };

    let result = if scenario.starts_with("fresh-") {
        read_password_from_security_cli_command(
            command,
            super::super::SERVICE,
            ACCOUNT_SENTINEL,
            super::super::CredentialLookupMode::Background,
            timeout,
        )
        .map(|_| None)
    } else {
        let mode = if scenario == "interactive-timeout" {
            super::super::CredentialLookupMode::Interactive
        } else {
            super::super::CredentialLookupMode::Background
        };
        let service = if scenario == "other-cli-exit" {
            SERVICE_URL_SENTINEL
        } else {
            super::super::cloudflare_access::SERVICE
        };
        read_credential_from_security_cli_command(
            command,
            CredentialKind::CloudflareAccess,
            service,
            ACCOUNT_SENTINEL,
            mode,
            timeout,
        )
    };

    if scenario == "fresh-missing" {
        let error = result.expect_err("exit 44 should report a missing password");
        assert!(error.to_string().contains("Password is not configured"));
    } else if scenario == "missing" {
        assert_eq!(
            result.expect("exit 44 should remain normal missing optional Access"),
            None
        );
    } else {
        let error = result.expect_err("scenario should fail");
        let message = format!("{error:?} {error}");
        for sentinel in [STDERR_SENTINEL, SECRET_SENTINEL, STDOUT_SENTINEL] {
            assert!(
                !message.contains(sentinel),
                "scenario {scenario} error leaked {sentinel}: {message}"
            );
        }
    }
}
