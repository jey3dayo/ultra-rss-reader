use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::local_account_sync::{LocalSyncAccountId, LocalSyncDeviceId};
use crate::domain::types::AccountId;
use crate::repository::local_account_sync_settings::{
    LocalAccountSyncSettings, LocalAccountSyncSettingsRepository,
};

pub struct SqliteLocalAccountSyncSettingsRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteLocalAccountSyncSettingsRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

fn validate_settings(settings: &LocalAccountSyncSettings) -> DomainResult<()> {
    if settings.account_id.0.trim().is_empty() {
        return Err(DomainError::Validation(
            "Local sync account settings require an account ID".to_string(),
        ));
    }
    if settings.sync_folder_path.trim().is_empty() {
        return Err(DomainError::Validation(
            "Local sync folder path cannot be empty".to_string(),
        ));
    }
    if settings.sync_account_id.0.trim().is_empty() {
        return Err(DomainError::Validation(
            "Local sync account ID cannot be empty".to_string(),
        ));
    }
    if settings.device_id.0.trim().is_empty() {
        return Err(DomainError::Validation(
            "Local sync device ID cannot be empty".to_string(),
        ));
    }
    Ok(())
}

fn row_to_settings(row: &rusqlite::Row) -> rusqlite::Result<LocalAccountSyncSettings> {
    Ok(LocalAccountSyncSettings {
        account_id: AccountId(row.get(0)?),
        sync_folder_path: row.get(1)?,
        sync_account_id: LocalSyncAccountId(row.get(2)?),
        device_id: LocalSyncDeviceId(row.get(3)?),
        enabled: row.get(4)?,
    })
}

impl LocalAccountSyncSettingsRepository for SqliteLocalAccountSyncSettingsRepository<'_> {
    fn find_by_account_id(
        &self,
        account_id: &AccountId,
    ) -> DomainResult<Option<LocalAccountSyncSettings>> {
        Ok(self
            .conn
            .query_row(
                "SELECT account_id, sync_folder_path, sync_account_id, device_id, enabled
                 FROM local_account_sync_settings
                 WHERE account_id = ?1",
                params![account_id.0],
                row_to_settings,
            )
            .optional()?)
    }

    fn save(&self, settings: &LocalAccountSyncSettings) -> DomainResult<()> {
        validate_settings(settings)?;
        self.conn.execute(
            "INSERT INTO local_account_sync_settings (
                account_id,
                sync_folder_path,
                sync_account_id,
                device_id,
                enabled,
                updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
             ON CONFLICT(account_id) DO UPDATE SET
                sync_folder_path = excluded.sync_folder_path,
                sync_account_id = excluded.sync_account_id,
                device_id = excluded.device_id,
                enabled = excluded.enabled,
                updated_at = excluded.updated_at",
            params![
                settings.account_id.0,
                settings.sync_folder_path.trim(),
                settings.sync_account_id.0.trim(),
                settings.device_id.0.trim(),
                settings.enabled,
            ],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::local_account_sync::{LocalSyncAccountId, LocalSyncDeviceId};
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
    use crate::repository::local_account_sync_settings::{
        LocalAccountSyncSettings, LocalAccountSyncSettingsRepository,
    };

    #[test]
    fn saves_and_reads_local_account_sync_settings_by_account() {
        let db = DbManager::new_in_memory().unwrap();
        let repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
        let account_id = AccountId("account-1".to_string());
        db.writer()
            .execute(
                "INSERT INTO accounts (
                    id,
                    kind,
                    name,
                    sync_interval_secs,
                    sync_on_startup,
                    sync_on_wake,
                    keep_read_items_days
                 )
                 VALUES (?1, 'Local', 'Local', 3600, 0, 0, 30)",
                [&account_id.0],
            )
            .unwrap();
        let settings = LocalAccountSyncSettings {
            account_id: account_id.clone(),
            sync_folder_path: "/Users/example/Sync/UltraRSSReader/local-accounts/account-1"
                .to_string(),
            sync_account_id: LocalSyncAccountId("sync-account-1".to_string()),
            device_id: LocalSyncDeviceId("device-1".to_string()),
            enabled: true,
        };

        repo.save(&settings).unwrap();

        assert_eq!(
            repo.find_by_account_id(&account_id).unwrap(),
            Some(settings)
        );
    }
}
