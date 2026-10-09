use super::*;
use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};

const SENTINEL: &str = "https://secret-sentinel.invalid/acct-42";

#[test]
fn sync_and_feed_failure_lines_carry_only_fixed_fields() {
    if child_scenario().is_some() {
        let error = AppError::from(crate::domain::error::DomainError::Keychain(
            SENTINEL.to_string(),
        ));
        log_sync_failure(SyncTrigger::StartupRepair, &ProviderKind::FreshRss, &error);
        log_local_feed_fetch_failure("public", &error);
        return;
    }

    let lines = run_in_isolated_process(
        module_path!(),
        "sync_and_feed_failure_lines_carry_only_fixed_fields",
        "emit",
    );
    assert_eq!(
        lines,
        [
            "event=sync-failed trigger=startup-repair provider=freshrss error_kind=keychain",
            "event=feed-fetch-failed provider=local host_class=public error_kind=keychain",
        ]
    );
    assert!(lines.iter().all(|line| !line.contains("sentinel")));
}
