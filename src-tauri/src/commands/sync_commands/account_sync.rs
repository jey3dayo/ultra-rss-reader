use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use tauri::AppHandle;
use tracing::{info, warn};

use crate::commands::dto::{
    sync_issue_owner_for_app_error, AccountSyncError, AccountSyncWarning, AppError,
    SyncProgressKind, SyncResult,
};
use crate::commands::lock_db;
use crate::commands::sync_providers::{
    repair_greader_remote_state, sync_greader_account, sync_greader_feed, sync_local_feed,
    GReaderSession, ProviderSyncOutcome, SessionError,
};
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::keyring_store::CredentialLookupMode;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;

use super::failure_log::{log_sync_completion, log_sync_failure, log_sync_warning, SyncTrigger};
use super::local_import_export::{
    local_feed_sync_warning, local_provider, run_local_account_auto_export,
    run_local_account_auto_import,
};
use super::progress::{SyncGuard, SyncProgressReporter};
use super::scheduler::{clear_scheduler_sync_status, load_all_accounts};

mod startup;
pub(crate) use startup::{
    run_local_account_startup_import_supplement, run_startup_sync_and_repair,
};

/// Sync a single account, returning warnings on soft anomalies and Err on hard failures.
pub(crate) async fn sync_account(
    db: &Mutex<DbManager>,
    account: &Account,
) -> Result<ProviderSyncOutcome, AppError> {
    sync_account_with_mode(db, account, CredentialLookupMode::Background).await
}

pub(crate) async fn sync_account_with_mode(
    db: &Mutex<DbManager>,
    account: &Account,
    mode: CredentialLookupMode,
) -> Result<ProviderSyncOutcome, AppError> {
    match account.kind {
        ProviderKind::Local => {
            let provider = local_provider();
            let mut warnings = Vec::new();
            if let Some(warning) = run_local_account_auto_import(db, &account.id) {
                warnings.push(warning);
            }
            let feeds = {
                let db_guard = lock_db(db)?;
                let feed_repo = SqliteFeedRepository::new(db_guard.reader());
                feed_repo.find_by_account(&account.id)?
            };
            for feed in &feeds {
                if let Err(error) = sync_local_feed(db, &provider, &account.id, feed).await {
                    if error.diagnostic_kind() == "persistence" {
                        return Err(error);
                    }
                    warnings.push(local_feed_sync_warning(feed, &error));
                }
            }
            if let Some(warning) = run_local_account_auto_export(db, &account.id) {
                warnings.push(warning);
            }
            Ok(ProviderSyncOutcome { warnings })
        }
        ProviderKind::FreshRss => {
            let auth_started_at = Instant::now();
            let session_result = match mode {
                CredentialLookupMode::Background => GReaderSession::establish(account).await,
                CredentialLookupMode::Interactive => {
                    GReaderSession::establish_interactive(account).await
                }
            };
            let session = match session_result {
                Ok(session) => session,
                Err(error @ SessionError::MissingUsername) => {
                    error.log_skip(account);
                    return Ok(ProviderSyncOutcome::default());
                }
                Err(error @ SessionError::MissingServerUrl) => {
                    return Err(error.into_user_visible());
                }
                Err(SessionError::Auth(error)) => return Err(error),
            };
            info!(
                account_id = %account.id.as_ref(),
                phase = "auth",
                elapsed_ms = auth_started_at.elapsed().as_millis() as u64,
                "FreshRSS sync phase completed"
            );
            let outcome = sync_greader_account_and_confirm_connection(db, account, &session).await;
            #[cfg(target_os = "macos")]
            release_lease_after_failed_interactive_sync(mode, account, &session, &outcome);
            outcome
        }
        ProviderKind::Quarantined => Err(AppError::UserVisible {
            message: "Account configuration is quarantined".into(),
        }),
    }
}

pub(super) async fn sync_greader_account_and_confirm_connection(
    db: &Mutex<DbManager>,
    account: &Account,
    session: &GReaderSession,
) -> Result<ProviderSyncOutcome, AppError> {
    let outcome = sync_greader_account(db, account, session).await;
    if outcome.is_ok() {
        confirm_connection_verified(db, account);
    }
    outcome
}

/// Sync success proves the credentials work; failure proves nothing because credential-lookup errors share `SessionError::Auth`.
fn confirm_connection_verified(db: &Mutex<DbManager>, account: &Account) {
    if account.connection_verification_status == ConnectionVerificationStatus::Verified {
        return;
    }
    let verified_at = chrono::Utc::now().to_rfc3339();
    let persisted = lock_db(db).and_then(|db_guard| {
        SqliteAccountRepository::new(db_guard.writer())
            .update_connection_verification(
                &account.id,
                ConnectionVerificationStatus::Verified,
                Some(&verified_at),
                None,
            )
            .map_err(AppError::from)
    });
    if let Err(error) = persisted {
        warn!(
            account_id = %account.id.as_ref(),
            "Failed to record verified connection after sync: {error}"
        );
    }
}

/// An explicit setup sync that fails must not leave behind the lease it granted, matching a failed connection test.
#[cfg(any(target_os = "macos", test))]
pub(super) fn release_lease_after_failed_interactive_sync<T>(
    mode: CredentialLookupMode,
    account: &Account,
    session: &GReaderSession,
    outcome: &Result<T, AppError>,
) {
    crate::commands::account_commands::release_lease_after_connection_test(
        &account.id,
        mode == CredentialLookupMode::Interactive && outcome.is_err(),
        session.lease_generation(),
    );
}

#[cfg(test)]
pub(crate) async fn sync_feed(
    db: &Mutex<DbManager>,
    account: &Account,
    feed: &Feed,
) -> Result<ProviderSyncOutcome, AppError> {
    sync_feed_with_mode(db, account, feed, CredentialLookupMode::Background).await
}

pub(crate) async fn sync_feed_with_mode(
    db: &Mutex<DbManager>,
    account: &Account,
    feed: &Feed,
    mode: CredentialLookupMode,
) -> Result<ProviderSyncOutcome, AppError> {
    match account.kind {
        ProviderKind::Local => {
            let provider = local_provider();
            sync_local_feed(db, &provider, &account.id, feed).await?;
            Ok(ProviderSyncOutcome::default())
        }
        ProviderKind::FreshRss => {
            let session_result = match mode {
                CredentialLookupMode::Background => GReaderSession::establish(account).await,
                CredentialLookupMode::Interactive => {
                    GReaderSession::establish_interactive(account).await
                }
            };
            let session = match session_result {
                Ok(session) => session,
                Err(error @ SessionError::MissingUsername) => {
                    error.log_skip_with_context(account, "single-feed sync");
                    return Ok(ProviderSyncOutcome::default());
                }
                Err(error @ SessionError::MissingServerUrl) => {
                    return Err(error.into_user_visible());
                }
                Err(SessionError::Auth(error)) => return Err(error),
            };
            sync_greader_feed(db, account, feed, &session).await
        }
        ProviderKind::Quarantined => Err(AppError::UserVisible {
            message: "Account configuration is quarantined".into(),
        }),
    }
}

/// Run a full sync for all accounts. Shared by `trigger_sync` command and the background scheduler.
///
/// Uses `syncing` as a concurrent-execution guard: if another sync is already
/// in progress the call returns a `SyncResult { synced: false, .. }` immediately.
pub async fn run_full_sync(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
) -> Result<SyncResult, AppError> {
    run_full_sync_with_progress(db, syncing, None).await
}

pub(crate) async fn run_full_sync_with_progress(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
    let accounts = load_all_accounts(db)?;

    run_sync_for_accounts_with_progress(db, syncing, accounts, reporter).await
}

pub(crate) async fn run_sync_for_accounts_with_progress(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    accounts: Vec<Account>,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
    run_sync_for_accounts_with_mode(
        db,
        syncing,
        accounts,
        reporter,
        |_| CredentialLookupMode::Background,
        SyncTrigger::Background,
        |_| {},
    )
    .await
}

/// `finish` runs while the `syncing` guard is still held, so post-sync work
/// such as purging cannot overlap database maintenance.
pub(crate) async fn run_sync_for_accounts_with_mode(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    accounts: Vec<Account>,
    reporter: Option<SyncProgressReporter>,
    mode: impl Fn(&Account) -> CredentialLookupMode,
    trigger: SyncTrigger,
    finish: impl FnOnce(&SyncResult),
) -> Result<SyncResult, AppError> {
    if syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        tracing::info!("Sync already in progress, skipping");
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }
    let _guard = SyncGuard(syncing);

    let result =
        run_sync_for_accounts_guarded_with_mode(db, accounts, reporter, mode, trigger).await?;
    finish(&result);
    log_sync_completion(trigger, None, &result);
    Ok(result)
}

/// Runs the account-sync body assuming the `syncing` flag/[`SyncGuard`] is
/// already held by the caller. Callers that need to hold the guard across
/// additional work (e.g. a startup remote-state repair step that must not
/// race with a concurrent sync) should acquire the CAS themselves and call
/// this function directly instead of `run_sync_for_accounts_with_progress`,
/// which would otherwise fail its own CAS against the caller's guard.
pub(crate) async fn run_sync_for_accounts_guarded(
    db: &Mutex<DbManager>,
    accounts: Vec<Account>,
    reporter: Option<SyncProgressReporter>,
    trigger: SyncTrigger,
) -> Result<SyncResult, AppError> {
    run_sync_for_accounts_guarded_with_mode(
        db,
        accounts,
        reporter,
        |_| CredentialLookupMode::Background,
        trigger,
    )
    .await
}

async fn run_sync_for_accounts_guarded_with_mode(
    db: &Mutex<DbManager>,
    accounts: Vec<Account>,
    reporter: Option<SyncProgressReporter>,
    mode: impl Fn(&Account) -> CredentialLookupMode,
    trigger: SyncTrigger,
) -> Result<SyncResult, AppError> {
    let total = accounts.len();
    let mut succeeded = 0usize;
    let mut failed = Vec::new();
    let mut warnings = Vec::new();

    if let Some(reporter) = reporter.as_ref() {
        reporter.emit_started(None);
    }

    // Sync accounts concurrently using join_all
    let futures: Vec<_> = accounts
        .into_iter()
        .map(|account| {
            let reporter = reporter.clone();
            let mode = mode(&account);
            async move {
                if let Some(reporter) = reporter.as_ref() {
                    reporter.emit_account_started(&account);
                }
                let result = sync_account_with_mode(db, &account, mode).await;
                if let Some(reporter) = reporter.as_ref() {
                    reporter.emit_account_finished(&account, result.is_ok());
                }
                (account, result)
            }
        })
        .collect();
    let results = futures::future::join_all(futures).await;

    for (account, result) in results {
        match result {
            Ok(outcome) => {
                succeeded += 1;
                if let Err(error) = clear_scheduler_sync_status(db, &account.id) {
                    warn!(
                        account_id = %account.id.as_ref(),
                        "Failed to clear scheduler sync status after manual sync: {error}"
                    );
                }
                warnings.extend(outcome.warnings.into_iter().map(|warning| {
                    log_sync_warning(trigger, &account.kind, warning.kind, &warning.detail);
                    AccountSyncWarning {
                        account_id: account.id.as_ref().to_string(),
                        account_name: account.name.clone(),
                        kind: warning.kind,
                        message: warning.message,
                        retry_at: warning.retry_at,
                        retry_in_seconds: warning.retry_in_seconds,
                        detail: warning.detail,
                    }
                }));
            }
            Err(e) => {
                warn!(account_id = %account.id.as_ref(), "Sync failed for account: {e}");
                log_sync_failure(trigger, &account.kind, &e);
                failed.push(AccountSyncError {
                    account_id: account.id.as_ref().to_string(),
                    account_name: account.name.clone(),
                    action_owner: Some(sync_issue_owner_for_app_error(&e)),
                    message: e.to_string(),
                });
            }
        }
    }

    if let Some(reporter) = reporter.as_ref() {
        reporter.emit_finished(failed.is_empty());
    }

    Ok(SyncResult {
        synced: true,
        total,
        succeeded,
        failed,
        warnings,
    })
}
