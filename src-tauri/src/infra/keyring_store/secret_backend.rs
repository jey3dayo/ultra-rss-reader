use std::path::PathBuf;

use zeroize::Zeroizing;

use super::cloudflare_access;
use super::dev_store_file::{read_dev_store, write_dev_store};
use super::dev_store_lock::with_dev_store_lock;
use super::diagnostics::{log_keyring_error, KeyringOp};
use super::storage_mode::{self, CredentialStorage};
use super::CredentialKind;
use crate::domain::error::{DomainError, DomainResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SecretKind {
    FreshRssPassword,
    CloudflareAccess,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SecretEntry {
    pub(crate) kind: SecretKind,
    pub(crate) account_id: String,
}

pub(crate) trait SecretBackend {
    fn read(&self, entry: &SecretEntry) -> DomainResult<Option<String>>;
    fn write(&self, entry: &SecretEntry, value: &str) -> DomainResult<()>;
    fn delete(&self, entry: &SecretEntry) -> DomainResult<()>;
}

const MIGRATION_COPY_FAILURE: &str =
    "Failed to copy credentials to the new storage. Nothing was changed.";

fn credential_kind(kind: SecretKind) -> CredentialKind {
    match kind {
        SecretKind::FreshRssPassword => CredentialKind::FreshRssPassword,
        SecretKind::CloudflareAccess => CredentialKind::CloudflareAccess,
    }
}

fn keyring_service(kind: SecretKind) -> &'static str {
    match kind {
        SecretKind::FreshRssPassword => super::SERVICE,
        SecretKind::CloudflareAccess => cloudflare_access::SERVICE,
    }
}

fn os_keyring_failure(error: &keyring::Error) -> DomainError {
    DomainError::Keychain(format!("Failed to access OS credential store: {error}"))
}

pub(crate) struct OsKeyringBackend;

impl OsKeyringBackend {
    fn keyring_entry(entry: &SecretEntry, op: KeyringOp) -> DomainResult<keyring::Entry> {
        keyring::Entry::new(keyring_service(entry.kind), &entry.account_id).map_err(|error| {
            log_keyring_error(credential_kind(entry.kind), op, &error);
            os_keyring_failure(&error)
        })
    }
}

impl SecretBackend for OsKeyringBackend {
    fn read(&self, entry: &SecretEntry) -> DomainResult<Option<String>> {
        let credential_kind = credential_kind(entry.kind);
        match Self::keyring_entry(entry, KeyringOp::Load)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => {
                log_keyring_error(credential_kind, KeyringOp::Load, &error);
                Err(os_keyring_failure(&error))
            }
        }
    }

    fn write(&self, entry: &SecretEntry, value: &str) -> DomainResult<()> {
        let credential_kind = credential_kind(entry.kind);
        Self::keyring_entry(entry, KeyringOp::Save)?
            .set_password(value)
            .map_err(|error| {
                log_keyring_error(credential_kind, KeyringOp::Save, &error);
                os_keyring_failure(&error)
            })
    }

    fn delete(&self, entry: &SecretEntry) -> DomainResult<()> {
        let credential_kind = credential_kind(entry.kind);
        match Self::keyring_entry(entry, KeyringOp::Remove)?.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => {
                log_keyring_error(credential_kind, KeyringOp::Remove, &error);
                Err(os_keyring_failure(&error))
            }
        }
    }
}

pub(crate) struct LocalFileBackend {
    path: PathBuf,
}

impl LocalFileBackend {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn store_key(entry: &SecretEntry) -> String {
        match entry.kind {
            SecretKind::FreshRssPassword => entry.account_id.clone(),
            SecretKind::CloudflareAccess => format!("cloudflare-access:{}", entry.account_id),
        }
    }
}

impl SecretBackend for LocalFileBackend {
    fn read(&self, entry: &SecretEntry) -> DomainResult<Option<String>> {
        let key = Self::store_key(entry);
        Ok(read_dev_store(&self.path)?.get(&key).cloned())
    }

    fn write(&self, entry: &SecretEntry, value: &str) -> DomainResult<()> {
        let key = Self::store_key(entry);
        with_dev_store_lock(&self.path, || {
            let mut store = read_dev_store(&self.path)?;
            store.insert(key, value.to_string());
            write_dev_store(&self.path, &store)
        })
    }

    fn delete(&self, entry: &SecretEntry) -> DomainResult<()> {
        let key = Self::store_key(entry);
        with_dev_store_lock(&self.path, || {
            let mut store = read_dev_store(&self.path)?;
            store.remove(&key);
            write_dev_store(&self.path, &store)
        })
    }
}

pub(crate) fn backend_for(storage: CredentialStorage) -> DomainResult<Box<dyn SecretBackend>> {
    match storage {
        CredentialStorage::OsKeychain => Ok(Box::new(OsKeyringBackend)),
        CredentialStorage::LocalFile => {
            let path = storage_mode::local_credentials_path().ok_or_else(|| {
                DomainError::Keychain("Credential storage is not initialized".to_string())
            })?;
            Ok(Box::new(LocalFileBackend::new(path)))
        }
    }
}

struct PlannedChange {
    entry: SecretEntry,
    source_value: Option<Zeroizing<String>>,
    target_snapshot: Option<Zeroizing<String>>,
}

fn rollback_target_changes(to: &dyn SecretBackend, changes: &[PlannedChange], indices: &[usize]) {
    for &index in indices {
        let change = &changes[index];
        let result = match &change.target_snapshot {
            Some(snapshot) => to.write(&change.entry, snapshot),
            None => to.delete(&change.entry),
        };
        if let Err(error) = result {
            tracing::warn!(
                "event=secret-migration-rollback-failed op=restore credential_kind={} error={error}",
                credential_kind(change.entry.kind).label()
            );
        }
    }
}

#[derive(Debug, Default, PartialEq, Eq)]
pub(crate) struct MigrationReport {
    pub(crate) migrated: usize,
    pub(crate) cleanup_failures: usize,
}

pub(crate) fn migrate_secrets(
    from: &dyn SecretBackend,
    to: &dyn SecretBackend,
    entries: &[SecretEntry],
    delete_stale_target: bool,
    commit: impl FnOnce() -> DomainResult<()>,
) -> DomainResult<MigrationReport> {
    let mut plan: Vec<PlannedChange> = Vec::with_capacity(entries.len());
    for entry in entries {
        let source_value = from.read(entry)?.map(Zeroizing::new);
        let target_snapshot = to.read(entry)?.map(Zeroizing::new);
        match source_value {
            Some(value) => plan.push(PlannedChange {
                entry: entry.clone(),
                source_value: Some(value),
                target_snapshot,
            }),
            None if target_snapshot.is_some() && delete_stale_target => plan.push(PlannedChange {
                entry: entry.clone(),
                source_value: None,
                target_snapshot,
            }),
            None => {}
        }
    }

    let mut applied: Vec<usize> = Vec::new();
    for (index, change) in plan.iter().enumerate() {
        let outcome = match &change.source_value {
            Some(value) => {
                if let Err(error) = to.write(&change.entry, value) {
                    applied.push(index);
                    Err(error)
                } else {
                    applied.push(index);
                    match to.read(&change.entry) {
                        Ok(read_back) if read_back.as_deref() == Some(value.as_str()) => Ok(()),
                        Ok(_) => Err(DomainError::Keychain(MIGRATION_COPY_FAILURE.to_string())),
                        Err(error) => Err(error),
                    }
                }
            }
            None => {
                if let Err(error) = to.delete(&change.entry) {
                    applied.push(index);
                    Err(error)
                } else {
                    applied.push(index);
                    match to.read(&change.entry) {
                        Ok(None) => Ok(()),
                        Ok(_) => Err(DomainError::Keychain(MIGRATION_COPY_FAILURE.to_string())),
                        Err(error) => Err(error),
                    }
                }
            }
        };
        if let Err(error) = outcome {
            rollback_target_changes(to, &plan, &applied);
            return Err(error);
        }
    }

    if let Err(error) = commit() {
        let all: Vec<usize> = (0..plan.len()).collect();
        rollback_target_changes(to, &plan, &all);
        return Err(error);
    }

    let mut cleanup_failures = 0;
    for change in &plan {
        if change.source_value.is_some() && from.delete(&change.entry).is_err() {
            cleanup_failures += 1;
            tracing::warn!(
                "event=secret-migration-cleanup-failed credential_kind={}",
                credential_kind(change.entry.kind).label()
            );
        }
    }

    Ok(MigrationReport {
        migrated: plan
            .iter()
            .filter(|change| change.source_value.is_some())
            .count(),
        cleanup_failures,
    })
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;
    use std::collections::HashMap;
    use std::sync::Mutex;

    use super::migrate_secrets;
    use super::LocalFileBackend;
    use super::MigrationReport;
    use super::{SecretBackend, SecretEntry, SecretKind, MIGRATION_COPY_FAILURE};
    use crate::domain::error::{DomainError, DomainResult};

    const MEMORY_WRITE_FAILURE: &str = "memory backend write failure";
    const MEMORY_DELETE_FAILURE: &str = "memory backend delete failure";
    const MEMORY_COMMIT_FAILURE: &str = "memory backend commit failure";

    #[derive(Default)]
    struct MemoryStorage {
        entries: HashMap<String, String>,
        write_attempts: usize,
    }

    struct MemoryBackend {
        storage: Mutex<MemoryStorage>,
        fail_write_on_attempt: Option<usize>,
        corrupt_read_back: bool,
        fail_delete: bool,
    }

    impl MemoryBackend {
        fn new() -> Self {
            Self {
                storage: Mutex::new(MemoryStorage::default()),
                fail_write_on_attempt: None,
                corrupt_read_back: false,
                fail_delete: false,
            }
        }

        fn with_fail_write_on_attempt(mut self, attempt: usize) -> Self {
            self.fail_write_on_attempt = Some(attempt);
            self
        }

        fn with_corrupt_read_back(mut self) -> Self {
            self.corrupt_read_back = true;
            self
        }

        fn with_fail_delete(mut self) -> Self {
            self.fail_delete = true;
            self
        }

        fn seed(&self, entry: &SecretEntry, value: &str) {
            self.storage
                .lock()
                .expect("memory backend storage should lock")
                .entries
                .insert(memory_key(entry), value.to_string());
        }

        fn get(&self, entry: &SecretEntry) -> Option<String> {
            self.storage
                .lock()
                .expect("memory backend storage should lock")
                .entries
                .get(&memory_key(entry))
                .cloned()
        }
    }

    impl SecretBackend for MemoryBackend {
        fn read(&self, entry: &SecretEntry) -> DomainResult<Option<String>> {
            let storage = self
                .storage
                .lock()
                .expect("memory backend storage should lock");
            if self.corrupt_read_back && storage.write_attempts > 0 {
                if let Some(value) = storage.entries.get(&memory_key(entry)) {
                    return Ok(Some(format!("{value}#mismatched")));
                }
            }
            Ok(storage.entries.get(&memory_key(entry)).cloned())
        }

        fn write(&self, entry: &SecretEntry, value: &str) -> DomainResult<()> {
            let mut storage = self
                .storage
                .lock()
                .expect("memory backend storage should lock");
            storage.write_attempts += 1;
            if self.fail_write_on_attempt == Some(storage.write_attempts) {
                return Err(DomainError::Keychain(MEMORY_WRITE_FAILURE.to_string()));
            }
            storage.entries.insert(memory_key(entry), value.to_string());
            Ok(())
        }

        fn delete(&self, entry: &SecretEntry) -> DomainResult<()> {
            if self.fail_delete {
                return Err(DomainError::Keychain(MEMORY_DELETE_FAILURE.to_string()));
            }
            let mut storage = self
                .storage
                .lock()
                .expect("memory backend storage should lock");
            storage.entries.remove(&memory_key(entry));
            Ok(())
        }
    }

    fn memory_key(entry: &SecretEntry) -> String {
        format!("[{:?}]{}", entry.kind, entry.account_id)
    }

    fn password_entry(account_id: &str) -> SecretEntry {
        SecretEntry {
            kind: SecretKind::FreshRssPassword,
            account_id: account_id.to_string(),
        }
    }

    fn access_entry(account_id: &str) -> SecretEntry {
        SecretEntry {
            kind: SecretKind::CloudflareAccess,
            account_id: account_id.to_string(),
        }
    }

    fn expect_keychain_error(result: DomainResult<MigrationReport>) -> String {
        match result {
            Err(DomainError::Keychain(message)) => message,
            _ => panic!("migration should fail with a Keychain error"),
        }
    }

    #[test]
    fn migration_moves_both_kinds_deletes_source_and_skips_missing_entries() {
        let source = MemoryBackend::new();
        let target = MemoryBackend::new();
        let password = password_entry("acct");
        let access = access_entry("acct");
        let missing = password_entry("never-saved");
        source
            .write(&password, "freshrss-secret")
            .expect("source password seed should be written");
        source
            .write(&access, "cloudflare-secret")
            .expect("source access seed should be written");
        let entries = [password.clone(), access.clone(), missing.clone()];

        let commit_calls = Cell::new(0usize);
        let report = migrate_secrets(&source, &target, &entries, true, || {
            commit_calls.set(commit_calls.get() + 1);
            Ok(())
        })
        .expect("migration should succeed");

        assert_eq!(
            report,
            MigrationReport {
                migrated: 2,
                cleanup_failures: 0
            }
        );
        assert_eq!(commit_calls.get(), 1);
        assert_eq!(target.get(&password).as_deref(), Some("freshrss-secret"));
        assert_eq!(target.get(&access).as_deref(), Some("cloudflare-secret"));
        assert_eq!(source.get(&password), None);
        assert_eq!(source.get(&access), None);
        assert_eq!(source.get(&missing), None);
    }

    #[test]
    fn write_failure_restores_target_and_keeps_source_untouched() {
        let source = MemoryBackend::new();
        let target = MemoryBackend::new().with_fail_write_on_attempt(2);
        let first = password_entry("first");
        let second = access_entry("second");
        let entries = [first.clone(), second.clone()];
        source
            .write(&first, "first-secret")
            .expect("source first seed should be written");
        source
            .write(&second, "second-secret")
            .expect("source second seed should be written");
        target.seed(&first, "prior-first");

        let commit_calls = Cell::new(0usize);
        let result = migrate_secrets(&source, &target, &entries, true, || {
            commit_calls.set(commit_calls.get() + 1);
            Ok(())
        });

        let message = expect_keychain_error(result);
        assert_eq!(message, MEMORY_WRITE_FAILURE);
        assert_eq!(commit_calls.get(), 0);
        assert_eq!(target.get(&first).as_deref(), Some("prior-first"));
        assert_eq!(target.get(&second), None);
        assert_eq!(source.get(&first).as_deref(), Some("first-secret"));
        assert_eq!(source.get(&second).as_deref(), Some("second-secret"));
    }

    #[test]
    fn read_back_mismatch_restores_target_and_keeps_source_untouched() {
        let source = MemoryBackend::new();
        let target = MemoryBackend::new().with_corrupt_read_back();
        let first = password_entry("first");
        let second = access_entry("second");
        let entries = [first.clone(), second.clone()];
        source
            .write(&first, "first-secret")
            .expect("source first seed should be written");
        source
            .write(&second, "second-secret")
            .expect("source second seed should be written");
        target.seed(&first, "prior-first");

        let commit_calls = Cell::new(0usize);
        let result = migrate_secrets(&source, &target, &entries, true, || {
            commit_calls.set(commit_calls.get() + 1);
            Ok(())
        });

        let message = expect_keychain_error(result);
        assert_eq!(message, MIGRATION_COPY_FAILURE);
        assert_eq!(commit_calls.get(), 0);
        assert_eq!(target.get(&first).as_deref(), Some("prior-first"));
        assert_eq!(target.get(&second), None);
        assert_eq!(source.get(&first).as_deref(), Some("first-secret"));
        assert_eq!(source.get(&second).as_deref(), Some("second-secret"));
    }

    #[test]
    fn commit_failure_restores_target_and_keeps_source_untouched() {
        let source = MemoryBackend::new();
        let target = MemoryBackend::new();
        let first = password_entry("first");
        let second = access_entry("second");
        let entries = [first.clone(), second.clone()];
        source
            .write(&first, "first-secret")
            .expect("source first seed should be written");
        source
            .write(&second, "second-secret")
            .expect("source second seed should be written");
        target.seed(&first, "prior-first");

        let commit_calls = Cell::new(0usize);
        let result = migrate_secrets(&source, &target, &entries, true, || {
            commit_calls.set(commit_calls.get() + 1);
            Err(DomainError::Keychain(MEMORY_COMMIT_FAILURE.to_string()))
        });

        let message = expect_keychain_error(result);
        assert_eq!(message, MEMORY_COMMIT_FAILURE);
        assert_eq!(commit_calls.get(), 1);
        assert_eq!(target.get(&first).as_deref(), Some("prior-first"));
        assert_eq!(target.get(&second), None);
        assert_eq!(source.get(&first).as_deref(), Some("first-secret"));
        assert_eq!(source.get(&second).as_deref(), Some("second-secret"));
    }

    #[test]
    fn cleanup_delete_failures_are_counted_and_target_keeps_values() {
        let source = MemoryBackend::new().with_fail_delete();
        let target = MemoryBackend::new();
        let first = password_entry("first");
        let second = access_entry("second");
        let entries = [first.clone(), second.clone()];
        source
            .write(&first, "first-secret")
            .expect("source first seed should be written");
        source
            .write(&second, "second-secret")
            .expect("source second seed should be written");

        let commit_calls = Cell::new(0usize);
        let report = migrate_secrets(&source, &target, &entries, true, || {
            commit_calls.set(commit_calls.get() + 1);
            Ok(())
        })
        .expect("migration should succeed with counted cleanup failures");

        assert_eq!(
            report,
            MigrationReport {
                migrated: 2,
                cleanup_failures: 2
            }
        );
        assert_eq!(commit_calls.get(), 1);
        assert_eq!(target.get(&first).as_deref(), Some("first-secret"));
        assert_eq!(target.get(&second).as_deref(), Some("second-secret"));
    }

    #[test]
    fn migration_deletes_stale_destination_value_missing_from_source() {
        let source = MemoryBackend::new();
        let target = MemoryBackend::new();
        let fresh = password_entry("fresh");
        let stale = password_entry("stale");
        source
            .write(&fresh, "fresh-secret")
            .expect("source fresh seed should be written");
        target.seed(&stale, "stale-value");
        let entries = [fresh.clone(), stale.clone()];

        let commit_calls = Cell::new(0usize);
        let report = migrate_secrets(&source, &target, &entries, true, || {
            commit_calls.set(commit_calls.get() + 1);
            Ok(())
        })
        .expect("migration should succeed");

        assert_eq!(
            report,
            MigrationReport {
                migrated: 1,
                cleanup_failures: 0
            }
        );
        assert_eq!(commit_calls.get(), 1);
        assert_eq!(target.get(&fresh).as_deref(), Some("fresh-secret"));
        assert_eq!(target.get(&stale), None);
        assert_eq!(source.get(&stale), None);
    }

    #[test]
    fn migration_without_stale_deletion_keeps_target_value_when_source_is_empty() {
        let source = MemoryBackend::new();
        let target = MemoryBackend::new();
        let stale = password_entry("stale");
        target.seed(&stale, "stale-value");
        let entries = [stale.clone()];

        let commit_calls = Cell::new(0usize);
        let report = migrate_secrets(&source, &target, &entries, false, || {
            commit_calls.set(commit_calls.get() + 1);
            Ok(())
        })
        .expect("migration should succeed");

        assert_eq!(
            report,
            MigrationReport {
                migrated: 0,
                cleanup_failures: 0
            }
        );
        assert_eq!(commit_calls.get(), 1);
        assert_eq!(target.get(&stale).as_deref(), Some("stale-value"));
        assert_eq!(source.get(&stale), None);
    }

    #[test]
    fn write_failure_after_stale_deletion_restores_deleted_value() {
        let source = MemoryBackend::new();
        let target = MemoryBackend::new().with_fail_write_on_attempt(1);
        let stale = password_entry("stale");
        let fresh = access_entry("fresh");
        target.seed(&stale, "stale-value");
        source
            .write(&fresh, "fresh-secret")
            .expect("source fresh seed should be written");
        let entries = [stale.clone(), fresh.clone()];

        let commit_calls = Cell::new(0usize);
        let result = migrate_secrets(&source, &target, &entries, true, || {
            commit_calls.set(commit_calls.get() + 1);
            Ok(())
        });

        let message = expect_keychain_error(result);
        assert_eq!(message, MEMORY_WRITE_FAILURE);
        assert_eq!(commit_calls.get(), 0);
        assert_eq!(target.get(&stale).as_deref(), Some("stale-value"));
        assert_eq!(target.get(&fresh), None);
        assert_eq!(source.get(&stale), None);
        assert_eq!(source.get(&fresh).as_deref(), Some("fresh-secret"));
    }

    #[test]
    fn local_file_backend_round_trips_both_kinds_with_distinct_keys() {
        let dir = tempfile::tempdir().expect("temp dir should be created");
        let store_path = dir.path().join("credentials.json");
        let backend = LocalFileBackend::new(store_path.clone());
        let password = password_entry("acct");
        let access = access_entry("acct");

        backend
            .write(&password, "freshrss-secret")
            .expect("password write should succeed");
        backend
            .write(&access, "cloudflare-secret")
            .expect("access write should succeed");

        assert_eq!(
            backend
                .read(&password)
                .expect("password read should succeed")
                .as_deref(),
            Some("freshrss-secret")
        );
        assert_eq!(
            backend
                .read(&access)
                .expect("access read should succeed")
                .as_deref(),
            Some("cloudflare-secret")
        );

        let content =
            std::fs::read_to_string(&store_path).expect("credentials file should be readable");
        let store: serde_json::Value =
            serde_json::from_str(&content).expect("credentials file should be JSON");
        assert_eq!(
            store.get("acct"),
            Some(&serde_json::Value::String("freshrss-secret".into()))
        );
        assert_eq!(
            store.get("cloudflare-access:acct"),
            Some(&serde_json::Value::String("cloudflare-secret".into()))
        );

        backend
            .delete(&password)
            .expect("password delete should succeed");
        assert_eq!(
            backend
                .read(&password)
                .expect("password read should succeed"),
            None
        );
        assert_eq!(
            backend
                .read(&access)
                .expect("access read should succeed")
                .as_deref(),
            Some("cloudflare-secret")
        );

        backend
            .delete(&access)
            .expect("access delete should succeed");
        backend
            .delete(&password)
            .expect("deleting a missing entry should succeed");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let mode = std::fs::metadata(&store_path)
                .expect("credentials file should exist")
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600);
        }
    }
}
