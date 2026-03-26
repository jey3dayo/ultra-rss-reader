use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;

#[derive(Debug, Clone)]
pub struct PendingMutation {
    pub id: Option<i64>,
    pub account_id: AccountId,
    pub mutation_type: String,
    pub remote_entry_id: String,
    pub created_at: String,
}

pub trait PendingMutationRepository {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<PendingMutation>>;
    fn save(&self, mutation: &PendingMutation) -> DomainResult<()>;
    fn delete(&self, ids: &[i64]) -> DomainResult<()>;
}
