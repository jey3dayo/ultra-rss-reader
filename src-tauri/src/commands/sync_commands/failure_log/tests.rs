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
        log_sync_panic(SyncTrigger::Background, &ProviderKind::FreshRss);
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
            "event=sync-failed trigger=background provider=freshrss error_kind=panic",
        ]
    );
    assert!(lines.iter().all(|line| !line.contains("sentinel")));
}

#[test]
fn partial_completion_and_warning_lines_exclude_user_strings() {
    use crate::commands::dto::{AccountSyncError, AccountSyncWarning};

    if child_scenario().is_some() {
        let details = [
            (
                AccountSyncWarningKind::Generic,
                AccountSyncWarningDetail::FeedSkippedEntries {
                    feed_title: SENTINEL.to_string(),
                    count: 7,
                },
            ),
            (
                AccountSyncWarningKind::RetryPending,
                AccountSyncWarningDetail::PendingMutationRetry {
                    mutation: SENTINEL.to_string(),
                },
            ),
            (
                AccountSyncWarningKind::RetryScheduled,
                AccountSyncWarningDetail::BackgroundSyncRetryScheduled {
                    account_name: SENTINEL.to_string(),
                },
            ),
            (
                AccountSyncWarningKind::Generic,
                AccountSyncWarningDetail::LocalFeedSyncFailed {
                    feed_title: SENTINEL.to_string(),
                    message: SENTINEL.to_string(),
                },
            ),
            (
                AccountSyncWarningKind::Generic,
                AccountSyncWarningDetail::CredentialAccessRequired {
                    account_name: SENTINEL.to_string(),
                },
            ),
        ];
        let warnings = details
            .into_iter()
            .map(|(kind, detail)| {
                log_sync_warning(
                    SyncTrigger::ManualAccount,
                    &ProviderKind::FreshRss,
                    kind,
                    &detail,
                );
                AccountSyncWarning {
                    account_id: SENTINEL.to_string(),
                    account_name: SENTINEL.to_string(),
                    kind,
                    message: SENTINEL.to_string(),
                    retry_at: Some(SENTINEL.to_string()),
                    retry_in_seconds: Some(60),
                    detail,
                }
            })
            .collect();
        log_sync_completion(
            SyncTrigger::ManualAccount,
            Some(&ProviderKind::FreshRss),
            &SyncResult {
                synced: true,
                total: 2,
                succeeded: 1,
                failed: vec![AccountSyncError {
                    account_id: SENTINEL.to_string(),
                    account_name: SENTINEL.to_string(),
                    action_owner: None,
                    message: SENTINEL.to_string(),
                }],
                warnings,
            },
        );
        return;
    }

    let lines = run_in_isolated_process(
        module_path!(),
        "partial_completion_and_warning_lines_exclude_user_strings",
        "emit",
    );
    assert_eq!(lines, [
        "event=sync-warning trigger=manual-account provider=freshrss warning_kind=generic warning_detail=feed_skipped_entries",
        "event=sync-warning trigger=manual-account provider=freshrss warning_kind=retry_pending warning_detail=pending_mutation_retry",
        "event=sync-warning trigger=manual-account provider=freshrss warning_kind=retry_scheduled warning_detail=background_sync_retry_scheduled",
        "event=sync-warning trigger=manual-account provider=freshrss warning_kind=generic warning_detail=local_feed_sync_failed",
        "event=sync-warning trigger=manual-account provider=freshrss warning_kind=generic warning_detail=credential_access_required",
        "event=sync-completed trigger=manual-account provider=freshrss total=2 succeeded=1 failed=1 warnings=5",
    ]);
    assert!(lines.iter().all(|line| !line.contains(SENTINEL)));
}

#[tokio::test]
async fn sync_entrypoints_log_partial_results_without_account_or_feed_details() {
    use crate::commands::sync_commands::account_sync::{
        run_sync_for_accounts_with_mode, sync_account,
    };
    use crate::commands::sync_commands::tests::test_sync_command_account;
    use crate::domain::feed::Feed;
    use crate::domain::types::FeedId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::infra::keyring_store::CredentialLookupMode;
    use crate::repository::feed::FeedRepository;
    use std::sync::{atomic::AtomicBool, Mutex};

    if let Some(scenario) = child_scenario() {
        let db = Mutex::new(
            DbManager::new_in_memory().expect("sync log fixture database should initialize"),
        );
        let local = test_sync_command_account(SENTINEL, ProviderKind::Local, false);
        {
            let db_guard = db.lock().unwrap();
            db_guard.writer().execute(
                "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, 'Local', ?2, 3600, 0, 0, 30)",
                rusqlite::params![local.id.as_ref(), local.name],
            ).expect("local account fixture should save");
            SqliteFeedRepository::new(db_guard.writer())
                .save(&Feed {
                    id: FeedId("private-feed-sentinel".to_string()),
                    account_id: local.id.clone(),
                    folder_id: None,
                    remote_id: None,
                    title: SENTINEL.to_string(),
                    url: "private-url-sentinel".to_string(),
                    site_url: SENTINEL.to_string(),
                    icon: None,
                    icon_url: None,
                    unread_count: 0,
                    reader_mode: "inherit".to_string(),
                    web_preview_mode: "inherit".to_string(),
                })
                .expect("invalid URL feed fixture should save");
        }
        if scenario == "periodic" {
            let result = sync_account(&db, &local)
                .await
                .expect("invalid local feed should produce a soft warning");
            assert_eq!(result.warnings.len(), 1);
            return;
        }
        let (trigger, mode) = if scenario == "manual-all" {
            (SyncTrigger::ManualAll, CredentialLookupMode::Interactive)
        } else {
            (SyncTrigger::Background, CredentialLookupMode::Background)
        };
        let result = run_sync_for_accounts_with_mode(
            &db,
            &AtomicBool::new(false),
            vec![
                local,
                test_sync_command_account(
                    "private-account-sentinel",
                    ProviderKind::Quarantined,
                    false,
                ),
            ],
            None,
            mode,
            trigger,
            |_| {},
        )
        .await
        .expect("mixed account outcomes should return a partial sync result");
        assert_eq!(
            (
                result.total,
                result.succeeded,
                result.failed.len(),
                result.warnings.len()
            ),
            (2, 1, 1, 1)
        );
        return;
    }

    for scenario in ["manual-all", "background", "periodic"] {
        let lines = run_in_isolated_process(
            module_path!(),
            "sync_entrypoints_log_partial_results_without_account_or_feed_details",
            scenario,
        );
        if scenario == "periodic" {
            assert!(
                lines
                    .iter()
                    .all(|line| !line.starts_with("event=sync-completed")),
                "sync_account must not emit a premature completion summary: {lines:?}"
            );
            continue;
        }
        let (trigger, provider, counts) =
            (scenario, "all", "total=2 succeeded=1 failed=1 warnings=1");
        assert!(
            lines.contains(&format!(
                "event=sync-completed trigger={trigger} provider={provider} {counts}"
            )),
            "missing completion summary: {lines:?}"
        );
        assert!(lines.contains(&format!("event=sync-warning trigger={trigger} provider=local warning_kind=generic warning_detail=local_feed_sync_failed")), "missing partial warning: {lines:?}");
        assert!(
            lines.iter().all(|line| !line.contains("sentinel")),
            "private fixture data leaked: {lines:?}"
        );
    }
}
