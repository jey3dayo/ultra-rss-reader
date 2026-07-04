use crate::domain::error::DomainResult;
use crate::domain::local_account_sync::{LocalSyncAccountId, LocalSyncDeviceId};
use crate::domain::types::AccountId;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalAccountSyncSettings {
    pub account_id: AccountId,
    pub sync_folder_path: String,
    pub sync_account_id: LocalSyncAccountId,
    pub device_id: LocalSyncDeviceId,
    pub enabled: bool,
    pub last_export_digest: Option<String>,
}

pub trait LocalAccountSyncSettingsRepository {
    fn find_by_account_id(
        &self,
        account_id: &AccountId,
    ) -> DomainResult<Option<LocalAccountSyncSettings>>;

    fn save(&self, settings: &LocalAccountSyncSettings) -> DomainResult<()>;

    fn save_export_digest(&self, account_id: &AccountId, digest: &str) -> DomainResult<()>;
}
