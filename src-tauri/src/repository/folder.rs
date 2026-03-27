use crate::domain::error::DomainResult;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FolderId};

pub trait FolderRepository {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Folder>>;
    fn save(&self, folder: &Folder) -> DomainResult<()>;
    fn delete(&self, id: &FolderId) -> DomainResult<()>;
    fn find_by_remote_id(
        &self,
        account_id: &AccountId,
        remote_id: &str,
    ) -> DomainResult<Option<Folder>>;
}
