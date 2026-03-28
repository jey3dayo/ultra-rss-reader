use crate::domain::account::Account;
use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;

pub trait AccountRepository {
    fn find_all(&self) -> DomainResult<Vec<Account>>;
    fn find_by_id(&self, id: &AccountId) -> DomainResult<Option<Account>>;
    fn save(&self, account: &Account) -> DomainResult<()>;
    fn update_sync_settings(
        &self,
        id: &AccountId,
        sync_interval_secs: i64,
        sync_on_wake: bool,
        keep_read_items_days: i64,
    ) -> DomainResult<()>;
    fn rename(&self, id: &AccountId, name: &str) -> DomainResult<()>;
    fn delete(&self, id: &AccountId) -> DomainResult<()>;
}
