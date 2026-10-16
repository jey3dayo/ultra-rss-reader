//! Loading scheduler accounts and mapping load failures to sync warnings.

use super::*;

pub(super) fn load_scheduler_accounts(db: &Mutex<DbManager>) -> DomainResult<Vec<Account>> {
    let db_guard = db
        .lock()
        .map_err(|error| DomainError::Persistence(format!("Lock error: {error}")))?;
    let repo = SqliteAccountRepository::new(db_guard.reader());
    repo.find_all().map(|accounts| {
        accounts
            .into_iter()
            .filter(|account| {
                !matches!(
                    account.kind,
                    crate::domain::provider::ProviderKind::Quarantined
                )
            })
            .collect()
    })
}

pub(super) fn load_scheduler_account(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> DomainResult<Option<Account>> {
    let db_guard = db
        .lock()
        .map_err(|error| DomainError::Persistence(format!("Lock error: {error}")))?;
    let repo = SqliteAccountRepository::new(db_guard.reader());
    repo.find_by_id(account_id)
}

pub(super) fn scheduler_load_failure_warning(error: &DomainError) -> AccountSyncWarning {
    AccountSyncWarning {
        account_id: "scheduler".to_string(),
        account_name: "Scheduler".to_string(),
        kind: AccountSyncWarningKind::Generic,
        message: format!("Scheduled sync skipped because accounts could not be loaded: {error}"),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::SchedulerLoadFailed {
            message: error.to_string(),
        },
    }
}
