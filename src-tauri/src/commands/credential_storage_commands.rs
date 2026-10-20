use serde::Serialize;
use tauri::State;

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
}

fn credential_storage_dto() -> CredentialStorageDto {
    CredentialStorageDto {
        storage: storage_mode::active(),
        configurable: credential_storage_configurable(),
    }
}

#[tauri::command]
pub fn get_credential_storage() -> Result<CredentialStorageDto, AppError> {
    Ok(credential_storage_dto())
}

#[tauri::command]
pub async fn set_credential_storage(
    state: State<'_, AppState>,
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

    let entries = {
        let db = crate::commands::lock_db(&state.db)?;
        let repo = SqliteAccountRepository::new(db.reader());
        migration_entries_for_freshrss_accounts(repo.find_all()?)
    };

    let report = tokio::task::spawn_blocking(move || switch_with_lock(&entries, storage))
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
    })
}

fn migration_entries_for_freshrss_accounts(accounts: Vec<Account>) -> Vec<SecretEntry> {
    accounts
        .into_iter()
        .filter(|account| account.kind == ProviderKind::FreshRss)
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
    entries: &[SecretEntry],
    storage: CredentialStorage,
) -> Result<MigrationReport, AppError> {
    let _switch_guard =
        crate::infra::keyring_store::credential_write_guard().map_err(AppError::from)?;
    if storage_mode::active() == storage {
        return Ok(MigrationReport::default());
    }

    let from = secret_backend::backend_for(storage_mode::active()).map_err(AppError::from)?;
    let to = secret_backend::backend_for(storage).map_err(AppError::from)?;
    secret_backend::migrate_secrets(from.as_ref(), to.as_ref(), entries, || {
        storage_mode::persist(storage)
    })
    .map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_storage_dto_serializes_storage_kind_snake_case() {
        let dto = CredentialStorageDto {
            storage: CredentialStorage::LocalFile,
            configurable: true,
        };

        let json = serde_json::to_string(&dto).expect("DTO should serialize");

        assert_eq!(json, r#"{"storage":"local_file","configurable":true}"#);
    }
}
