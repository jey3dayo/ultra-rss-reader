use serde::Serialize;
use tauri::Manager;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::keyring_store::credential_storage_configurable;
use crate::infra::keyring_store::secret_backend::{self, MigrationReport, SecretEntry, SecretKind};
use crate::infra::keyring_store::storage_mode::{self, CredentialStorage};
use crate::repository::account::AccountRepository;

const SWITCH_FAILED_MESSAGE: &str = "Failed to change credential storage";
const DEV_STORE_LOCKED_MESSAGE: &str =
    "Credential storage cannot be changed while the development credential store is in use";

#[derive(Debug, Serialize, PartialEq)]
pub struct CredentialStorageDto {
    storage: CredentialStorage,
    configurable: bool,
    cleanup_incomplete: bool,
}

fn credential_storage_dto() -> CredentialStorageDto {
    CredentialStorageDto {
        storage: storage_mode::active(),
        configurable: credential_storage_configurable(),
        cleanup_incomplete: false,
    }
}

#[tauri::command]
pub fn get_credential_storage() -> Result<CredentialStorageDto, AppError> {
    Ok(credential_storage_dto())
}

#[tauri::command]
pub async fn set_credential_storage(
    app_handle: tauri::AppHandle,
    storage: CredentialStorage,
) -> Result<CredentialStorageDto, AppError> {
    if !credential_storage_configurable() {
        return Err(AppError::UserVisible {
            message: DEV_STORE_LOCKED_MESSAGE.into(),
        });
    }

    if storage == storage_mode::active() {
        return Ok(credential_storage_dto());
    }

    let report = tokio::task::spawn_blocking(move || switch_with_lock(app_handle, storage))
        .await
        .map_err(|_| AppError::UserVisible {
            message: SWITCH_FAILED_MESSAGE.into(),
        })??;

    if report.cleanup_failures > 0 {
        tracing::warn!(
            "event=credential-storage-switch cleanup_failures={}",
            report.cleanup_failures
        );
    }
    tracing::info!("event=credential-storage-switch storage={storage:?}");
    Ok(CredentialStorageDto {
        storage,
        configurable: true,
        cleanup_incomplete: report.cleanup_failures > 0,
    })
}

fn migration_entries_for_accounts(accounts: Vec<Account>) -> Vec<SecretEntry> {
    accounts
        .into_iter()
        .filter(|account| account.kind != ProviderKind::Local)
        .flat_map(|account| {
            let account_id = account.id.0;
            [
                SecretEntry {
                    kind: SecretKind::FreshRssPassword,
                    account_id: account_id.clone(),
                },
                SecretEntry {
                    kind: SecretKind::CloudflareAccess,
                    account_id,
                },
            ]
        })
        .collect()
}

fn switch_with_lock(
    app_handle: tauri::AppHandle,
    storage: CredentialStorage,
) -> Result<MigrationReport, AppError> {
    let state = app_handle.state::<AppState>();
    let db = crate::commands::lock_db(&state.db)?;
    let _switch_guard =
        crate::infra::keyring_store::credential_write_guard().map_err(AppError::from)?;
    if storage_mode::active() == storage {
        return Ok(MigrationReport::default());
    }

    let entries =
        migration_entries_for_accounts(SqliteAccountRepository::new(db.reader()).find_all()?);
    drop(db);
    let _backend_guard =
        crate::infra::keyring_store::credential_backend_switch_guard().map_err(AppError::from)?;

    let from = secret_backend::backend_for(storage_mode::active()).map_err(AppError::from)?;
    let to = secret_backend::backend_for(storage).map_err(AppError::from)?;
    secret_backend::migrate_secrets(
        from.as_ref(),
        to.as_ref(),
        &entries,
        storage == CredentialStorage::OsKeychain,
        || storage_mode::persist(storage),
    )
    .map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::ConnectionVerificationStatus;
    use crate::domain::types::AccountId;

    #[test]
    fn credential_storage_dto_serializes_storage_kind_snake_case() {
        let dto = CredentialStorageDto {
            storage: CredentialStorage::LocalFile,
            configurable: true,
            cleanup_incomplete: false,
        };

        let json = serde_json::to_string(&dto).expect("DTO should serialize");

        assert_eq!(
            json,
            r#"{"storage":"local_file","configurable":true,"cleanup_incomplete":false}"#
        );
    }

    #[test]
    fn credential_storage_dto_serializes_cleanup_incomplete_true() {
        let dto = CredentialStorageDto {
            storage: CredentialStorage::OsKeychain,
            configurable: true,
            cleanup_incomplete: true,
        };

        let json = serde_json::to_string(&dto).expect("DTO should serialize");

        assert_eq!(
            json,
            r#"{"storage":"os_keychain","configurable":true,"cleanup_incomplete":true}"#
        );
    }

    fn test_account(kind: ProviderKind, id: &str) -> Account {
        Account {
            id: AccountId(id.to_string()),
            kind,
            name: "Account".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    #[test]
    fn migration_entries_include_both_kinds_for_freshrss_and_quarantined_accounts() {
        let accounts = vec![
            test_account(ProviderKind::FreshRss, "freshrss-account"),
            test_account(ProviderKind::Quarantined, "quarantined-account"),
        ];

        let entries = migration_entries_for_accounts(accounts);

        assert_eq!(
            entries,
            vec![
                SecretEntry {
                    kind: SecretKind::FreshRssPassword,
                    account_id: "freshrss-account".to_string(),
                },
                SecretEntry {
                    kind: SecretKind::CloudflareAccess,
                    account_id: "freshrss-account".to_string(),
                },
                SecretEntry {
                    kind: SecretKind::FreshRssPassword,
                    account_id: "quarantined-account".to_string(),
                },
                SecretEntry {
                    kind: SecretKind::CloudflareAccess,
                    account_id: "quarantined-account".to_string(),
                },
            ]
        );
    }

    #[test]
    fn migration_entries_exclude_local_accounts() {
        let accounts = vec![test_account(ProviderKind::Local, "local-account")];

        assert!(migration_entries_for_accounts(accounts).is_empty());
    }
}
