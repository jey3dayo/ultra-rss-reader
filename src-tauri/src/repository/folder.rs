use crate::domain::error::DomainResult;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FolderId};

pub trait FolderRepository {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Folder>>;
    fn save(&self, folder: &Folder) -> DomainResult<()>;
    fn delete(&self, id: &FolderId) -> DomainResult<()>;
}
