use super::*;
use crate::commands::dto::AppError;
use crate::domain::account::ConnectionVerificationStatus;
use crate::infra::db::connection::DbManager;
use rusqlite::params;
use std::cell::Cell;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Notify;

struct FailingCleanupRepo<'a> {
    save_attempts: &'a Cell<usize>,
}

impl SyncStateRepository for FailingCleanupRepo<'_> {
    fn get<K>(&self, _account_id: &AccountId, _scope_key: K) -> DomainResult<Option<SyncState>>
    where
        K: Into<SyncStateScopeKey>,
    {
        Ok(None)
    }

    fn save(&self, _state: &SyncState) -> DomainResult<()> {
        self.save_attempts.set(self.save_attempts.get() + 1);
        Err(DomainError::Persistence("cleanup failed".to_string()))
    }
}

fn test_account(sync_interval_secs: i64) -> Account {
    Account {
        id: AccountId::new(),
        kind: crate::domain::provider::ProviderKind::Local,
        name: "test".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

fn test_db() -> DbManager {
    DbManager::new_in_memory().unwrap()
}

fn insert_test_account(db: &DbManager, account_id: &AccountId) {
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![account_id.0, "Local", "Test"],
        )
        .unwrap();
}

fn set_test_account_sync_interval(db: &DbManager, account_id: &AccountId, interval_secs: i64) {
    db.writer()
        .execute(
            "UPDATE accounts SET sync_interval_secs = ?1 WHERE id = ?2",
            params![interval_secs, account_id.0],
        )
        .unwrap();
}

fn delete_test_account(db: &DbManager, account_id: &AccountId) {
    db.writer()
        .execute("DELETE FROM accounts WHERE id = ?1", params![account_id.0])
        .unwrap();
}

fn insert_sync_state_error_count(db: &DbManager, account_id: &AccountId, error_count: i32) {
    db.writer()
        .execute(
            "INSERT INTO sync_state (account_id, scope_key, error_count) VALUES (?1, ?2, ?3)",
            params![
                account_id.0,
                SyncStateScopeKey::scheduler().as_string(),
                error_count
            ],
        )
        .unwrap();
}

fn insert_scheduler_sync_state(
    db: &DbManager,
    account_id: &AccountId,
    error_count: i32,
    next_retry_at: Option<&str>,
) {
    db.writer()
        .execute(
            "INSERT INTO sync_state (account_id, scope_key, error_count, next_retry_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                account_id.0,
                SyncStateScopeKey::scheduler().as_string(),
                error_count,
                next_retry_at,
            ],
        )
        .unwrap();
}

mod due_selection;
mod failure_retry;
mod lifecycle;
mod loading_and_backoff;
mod schedule_updates;
mod warning_caps_and_circuit;
