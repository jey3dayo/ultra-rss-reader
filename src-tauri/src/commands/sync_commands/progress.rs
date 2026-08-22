use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tracing::warn;

use crate::commands::dto::{SyncProgressEvent, SyncProgressKind, SyncProgressStage, SyncResult};
use crate::domain::account::Account;

pub(crate) const SYNC_COMPLETED_EVENT: &str = "sync-completed";
pub(crate) const SYNC_SUCCEEDED_EVENT: &str = "sync-succeeded";
pub(crate) const SYNC_WARNING_EVENT: &str = "sync-warning";
pub(crate) const SYNC_PROGRESS_EVENT: &str = "sync-progress";
pub(crate) static SYNC_PROGRESS_SESSION_ID: AtomicU64 = AtomicU64::new(0);

/// RAII guard that resets the `AtomicBool` to `false` on drop, ensuring the
/// sync flag is always cleared even on early return or panic.
pub(crate) struct SyncGuard<'a>(pub(crate) &'a AtomicBool);

impl Drop for SyncGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[derive(Clone)]
pub(crate) struct SyncProgressReporter {
    app_handle: AppHandle,
    session_id: u64,
    kind: SyncProgressKind,
    total: usize,
    completed: Arc<AtomicUsize>,
}

impl SyncProgressReporter {
    pub(crate) fn new(app_handle: AppHandle, kind: SyncProgressKind, total: usize) -> Self {
        Self {
            app_handle,
            session_id: next_sync_progress_session_id(),
            kind,
            total,
            completed: Arc::new(AtomicUsize::new(0)),
        }
    }

    fn emit(
        &self,
        stage: SyncProgressStage,
        completed: usize,
        account: Option<&Account>,
        success: Option<bool>,
    ) {
        if let Err(e) = self.app_handle.emit(
            SYNC_PROGRESS_EVENT,
            SyncProgressEvent {
                stage,
                session_id: self.session_id,
                kind: self.kind,
                total: self.total,
                completed,
                account_id: account.map(|account| account.id.as_ref().to_string()),
                account_name: account.map(|account| account.name.clone()),
                success,
            },
        ) {
            warn!("Failed to emit sync-progress event: {e}");
        }
    }

    pub(crate) fn emit_started(&self, account: Option<&Account>) {
        self.emit(SyncProgressStage::Started, 0, account, None);
    }

    pub(crate) fn emit_account_started(&self, account: &Account) {
        self.emit(
            SyncProgressStage::AccountStarted,
            self.completed.load(Ordering::SeqCst),
            Some(account),
            None,
        );
    }

    pub(crate) fn emit_account_finished(&self, account: &Account, success: bool) {
        let completed = next_sync_progress_completed(&self.completed, self.total);
        self.emit(
            SyncProgressStage::AccountFinished,
            completed,
            Some(account),
            Some(success),
        );
    }

    pub(crate) fn emit_finished(&self, success: bool) {
        self.emit(
            SyncProgressStage::Finished,
            self.completed.load(Ordering::SeqCst),
            None,
            Some(success),
        );
    }
}

pub(crate) fn next_sync_progress_session_id() -> u64 {
    SYNC_PROGRESS_SESSION_ID.fetch_add(1, Ordering::SeqCst) + 1
}

pub(crate) fn next_sync_progress_completed(completed: &AtomicUsize, total: usize) -> usize {
    let mut current = completed.load(Ordering::SeqCst);
    loop {
        let next = current.saturating_add(1).min(total);
        match completed.compare_exchange(current, next, Ordering::SeqCst, Ordering::SeqCst) {
            Ok(_) => return next,
            Err(actual) => current = actual,
        }
    }
}

pub(crate) fn should_emit_sync_succeeded(result: &SyncResult) -> bool {
    result.synced && result.succeeded > 0 && result.failed.is_empty() && result.warnings.is_empty()
}

pub(crate) fn should_emit_sync_warning(result: &SyncResult) -> bool {
    result.synced && !result.warnings.is_empty()
}

pub(crate) fn should_emit_manual_single_sync_completion(result: &SyncResult) -> bool {
    result.synced && result.succeeded > 0
}

pub(crate) fn should_purge_old_articles_after_sync(sync_ran: bool) -> bool {
    sync_ran
}

pub(crate) fn emit_sync_warning_event(app_handle: &tauri::AppHandle, result: &SyncResult) {
    if super::should_emit_sync_warning(result) {
        emit_sync_event_log_only(app_handle, SYNC_WARNING_EVENT, result.warnings.clone());
    }
}

pub(crate) fn sync_event_emit_warning(event: &str, error: &impl std::fmt::Display) -> String {
    format!("Failed to emit {event} event after sync: {error}")
}

pub(crate) fn emit_sync_event_log_only<S>(app_handle: &AppHandle, event: &str, payload: S)
where
    S: Serialize + Clone,
{
    if let Err(error) = app_handle.emit(event, payload) {
        warn!("{}", sync_event_emit_warning(event, &error));
    }
}
