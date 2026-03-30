use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;

#[derive(Debug, Clone)]
pub struct SyncState {
    pub account_id: AccountId,
    pub scope_key: String,
    pub timestamp_usec: Option<i64>,
    pub continuation: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub last_success_at: Option<String>,
    pub last_error: Option<String>,
    pub error_count: i32,
    pub next_retry_at: Option<String>,
}

pub trait SyncStateRepository {
    fn get(&self, account_id: &AccountId, scope_key: &str) -> DomainResult<Option<SyncState>>;
    fn save(&self, state: &SyncState) -> DomainResult<()>;
}
