use crate::domain::error::DomainResult;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FolderId};

pub trait FolderRepository {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Folder>>;
    fn save(&self, folder: &Folder) -> DomainResult<()>;
    fn delete(&self, id: &FolderId) -> DomainResult<()>;
    /// Renumbers the account's folders to 0..n in the given order. Callers validate that the ids are
    /// exactly the account's folders; this only applies the order.
    fn set_sort_orders(
        &self,
        account_id: &AccountId,
        ordered_folder_ids: &[String],
    ) -> DomainResult<()>;
    fn find_by_remote_id(
        &self,
        account_id: &AccountId,
        remote_id: &str,
    ) -> DomainResult<Option<Folder>>;
}
