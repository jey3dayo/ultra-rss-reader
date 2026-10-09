use super::*;
use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};

const SENTINEL: &str = "secret-sentinel";

#[test]
fn keyring_failure_reason_is_a_static_label_without_error_text() {
    let errors = [
        keyring::Error::PlatformFailure(SENTINEL.into()),
        keyring::Error::NoStorageAccess(SENTINEL.into()),
        keyring::Error::NoEntry,
        keyring::Error::BadEncoding(SENTINEL.as_bytes().to_vec()),
        keyring::Error::TooLong(SENTINEL.into(), 1),
        keyring::Error::Invalid(SENTINEL.into(), SENTINEL.into()),
    ];
    let reasons: Vec<&str> = errors.iter().map(keyring_failure_reason).collect();
    assert_eq!(
        reasons,
        [
            "platform",
            "no-storage-access",
            "no-entry",
            "bad-encoding",
            "too-long",
            "invalid"
        ]
    );
}

#[test]
fn keyring_diagnostic_lines_carry_only_fixed_fields() {
    if child_scenario().is_some() {
        let error = keyring::Error::PlatformFailure(SENTINEL.into());
        log_keyring_error(CredentialKind::CloudflareAccess, KeyringOp::Save, &error);
        log_keyring_access_failed(
            CredentialKind::FreshRssPassword,
            KeyringOp::Verify,
            "mismatch",
        );
        log_sync_read_gate_failed(
            CredentialKind::CloudflareAccess,
            CredentialLookupMode::Interactive,
            "caller-timeout",
        );
        log_credential_malformed(CredentialKind::CloudflareAccess, "json");
        return;
    }

    let lines = run_in_isolated_process(
        module_path!(),
        "keyring_diagnostic_lines_carry_only_fixed_fields",
        "emit",
    );
    assert_eq!(
        lines,
        [
            "event=keyring-access-failed credential_kind=cloudflare-access op=save failure_reason=platform",
            "event=keyring-access-failed credential_kind=freshrss-password op=verify failure_reason=mismatch",
            "event=keyring-read-gate-failed credential_kind=cloudflare-access mode=interactive failure_reason=caller-timeout",
            "event=keyring-credential-malformed credential_kind=cloudflare-access stage=json",
        ]
    );
    assert!(lines.iter().all(|line| !line.contains(SENTINEL)));
}
