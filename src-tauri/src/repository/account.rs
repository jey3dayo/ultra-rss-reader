use crate::domain::account::Account;
use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;

pub trait AccountRepository {
    fn find_all(&self) -> DomainResult<Vec<Account>>;
    fn save(&self, account: &Account) -> DomainResult<()>;
    fn delete(&self, id: &AccountId) -> DomainResult<()>;
}
