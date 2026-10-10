use super::*;
use crate::domain::account::ConnectionVerificationStatus;
use crate::domain::types::AccountId;
use std::cell::{Cell, RefCell};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use super::super::credentials::delete_account_with_sync_boundary_with_store;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::repository::account::AccountRepository;

#[derive(Default)]
struct FakeStore {
    unavailable: Cell<bool>,
    password: RefCell<Option<String>>,
    access: RefCell<Option<CloudflareAccess>>,
    malformed: RefCell<Option<String>>,
    failures: RefCell<Vec<&'static str>>,
}

impl FakeStore {
    fn fail(&self, operation: &'static str) -> bool {
        let mut failures = self.failures.borrow_mut();
        if failures.first() == Some(&operation) {
            failures.remove(0);
            true
        } else {
            false
        }
    }
}
impl CloudflareAccessStore for FakeStore {
    fn load(&self, _: &str) -> Result<Option<CloudflareAccess>, AccessStoreError> {
        if self.unavailable.get() || self.fail("load") {
            return Err(AccessStoreError::Unavailable);
        }
        if self.malformed.borrow().is_some() {
            return Err(AccessStoreError::Malformed);
        }
        Ok(self.access.borrow().clone())
    }
    fn save(&self, _: &str, access: &CloudflareAccess) -> Result<(), AccessStoreError> {
        if self.unavailable.get() || self.fail("save") {
            return Err(AccessStoreError::Unavailable);
        }
        *self.malformed.borrow_mut() = None;
        *self.access.borrow_mut() = Some(access.clone());
        if self.fail("verify") {
            return Err(AccessStoreError::Verification);
        }
        Ok(())
    }
    fn remove(&self, _: &str) -> Result<(), AccessStoreError> {
        if self.unavailable.get() || self.fail("remove") {
            return Err(AccessStoreError::Unavailable);
        }
        *self.malformed.borrow_mut() = None;
        *self.access.borrow_mut() = None;
        if self.fail("remove_verify") {
            return Err(AccessStoreError::Verification);
        }
        Ok(())
    }
    fn snapshot(&self, id: &str) -> Result<AccessSnapshot, AccessStoreError> {
        if self.unavailable.get() {
            return Err(AccessStoreError::Unavailable);
        }
        if let Some(raw) = self.malformed.borrow().as_ref() {
            return Ok(AccessSnapshot::Malformed(raw.clone()));
        }
        Ok(match self.load(id)? {
            Some(access) => AccessSnapshot::Configured(access),
            None => AccessSnapshot::Missing,
        })
    }
    fn restore(&self, id: &str, snapshot: &AccessSnapshot) -> Result<(), AccessStoreError> {
        if self.unavailable.get() {
            return Err(AccessStoreError::Unavailable);
        }
        match snapshot {
            AccessSnapshot::Missing => self.remove(id),
            AccessSnapshot::Configured(access) => self.save(id, access),
            AccessSnapshot::Malformed(raw) => {
                if self.fail("restore") {
                    return Err(AccessStoreError::Unavailable);
                }
                *self.access.borrow_mut() = None;
                *self.malformed.borrow_mut() = Some(raw.clone());
                Ok(())
            }
        }
    }
}
impl AccountCredentialStore for FakeStore {
    fn password(&self, _: &str) -> Result<Option<String>, AppError> {
        if self.fail("password_read") {
            return Err(db_error());
        }
        Ok(self.password.borrow().clone())
    }
    fn set_password(&self, _: &str, password: &str) -> Result<(), AppError> {
        if self.fail("password_save") {
            return Err(db_error());
        }
        *self.password.borrow_mut() = Some(password.to_string());
        if self.fail("password_verify") {
            return Err(db_error());
        }
        Ok(())
    }
    fn delete_password(&self, _: &str) -> Result<(), AppError> {
        if self.unavailable.get() {
            return Err(AppError::from(DomainError::Keychain(
                "dummy keyring unavailable".into(),
            )));
        }
        *self.password.borrow_mut() = None;
        Ok(())
    }
}
fn account() -> Account {
    Account {
        id: AccountId("access-test".into()),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".into(),
        server_url: Some("https://localhost/root".into()),
        username: Some("user".into()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}
fn bundle() -> CloudflareAccess {
    CloudflareAccess::new("dummy-id", "cfast_dummy_secret", "https://localhost").unwrap()
}
fn replace() -> CloudflareAccessArg {
    CloudflareAccessArg::Replace {
        client_id: "new-id".into(),
        client_secret: "new-dummy-secret".into(),
    }
}
fn db_error() -> AppError {
    AppError::UserVisible {
        message: "dummy DB failure".into(),
    }
}
fn configured() -> FakeStore {
    FakeStore {
        password: RefCell::new(Some("old-dummy-password".into())),
        access: RefCell::new(Some(bundle())),
        ..Default::default()
    }
}

fn deletion_db(kind: ProviderKind) -> (tempfile::TempDir, Mutex<DbManager>, Account) {
    let dir = tempfile::tempdir().expect("account deletion temporary directory should be created");
    let db = DbManager::new(&dir.path().join("accounts.sqlite"))
        .expect("account deletion temporary database should be created");
    let mut account = account();
    account.kind = kind;
    SqliteAccountRepository::new(db.writer())
        .save(&account)
        .expect("account deletion fixture should be persisted");
    (dir, Mutex::new(db), account)
}

fn account_exists(db: &Mutex<DbManager>, id: &AccountId) -> bool {
    let db = db.lock().unwrap();
    SqliteAccountRepository::new(db.writer())
        .find_by_id(id)
        .expect("account deletion state should be readable")
        .is_some()
}

#[test]
fn delete_non_freshrss_account_succeeds_when_access_keyring_is_unavailable() {
    for kind in [ProviderKind::Local, ProviderKind::Quarantined] {
        let (_dir, db, account) = deletion_db(kind);
        let syncing = AtomicBool::new(true);
        let store = configured();
        store.unavailable.set(true);

        let busy =
            delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store)
                .expect_err("active sync should prevent account deletion");
        assert!(busy
            .to_string()
            .contains(crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR));
        assert!(account_exists(&db, &account.id));
        assert!(syncing.load(Ordering::SeqCst));
        syncing.store(false, Ordering::SeqCst);

        let result =
            delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store);
        assert!(
            result.is_ok(),
            "non-FreshRSS deletion should bypass Access: {result:?}"
        );
        assert!(!account_exists(&db, &account.id));
        assert!(!syncing.load(Ordering::SeqCst));

        let retry =
            delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store)
                .expect_err("deleting a removed account should report the missing account");
        assert_eq!(retry.to_string(), "Account not found");
        assert!(!syncing.load(Ordering::SeqCst));
    }
}

#[test]
fn delete_freshrss_account_preserves_account_while_access_keyring_is_unavailable() {
    let (_dir, db, account) = deletion_db(ProviderKind::FreshRss);
    let syncing = AtomicBool::new(false);
    let store = configured();
    store.unavailable.set(true);

    for _ in 0..2 {
        let error =
            delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store)
                .expect_err("unavailable Access keyring should preserve FreshRSS for retry");
        assert!(error
            .to_string()
            .contains("Cloudflare Access OS keyring is unavailable"));
        assert!(account_exists(&db, &account.id));
        assert_eq!(*store.access.borrow(), Some(bundle()));
        assert!(!syncing.load(Ordering::SeqCst));
    }

    store.unavailable.set(false);
    *store.failures.borrow_mut() = vec!["remove"];
    let error =
        delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store)
            .expect_err("failed Access removal should preserve FreshRSS for retry");
    assert!(error
        .to_string()
        .contains("Cloudflare Access OS keyring is unavailable"));
    assert!(account_exists(&db, &account.id));
    assert_eq!(*store.access.borrow(), Some(bundle()));
    assert!(!syncing.load(Ordering::SeqCst));

    let result =
        delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store);
    assert!(
        result.is_ok(),
        "available Access keyring should allow retry: {result:?}"
    );
    assert!(!account_exists(&db, &account.id));
    assert!(store.access.borrow().is_none());
    assert!(store.password.borrow().is_none());
    assert!(!syncing.load(Ordering::SeqCst));
}

#[test]
fn delete_freshrss_account_restores_access_after_database_failure_and_allows_retry() {
    let (_dir, db, account) = deletion_db(ProviderKind::FreshRss);
    let syncing = AtomicBool::new(false);
    let store = configured();
    db.lock()
        .unwrap()
        .writer()
        .execute_batch(
            "CREATE TEMP TRIGGER fail_account_delete BEFORE DELETE ON accounts
         BEGIN SELECT RAISE(FAIL, 'account deletion fixture failure'); END;",
        )
        .expect("account deletion failure trigger should be created");

    let error =
        delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store)
            .expect_err("database failure should restore Access and preserve the account");
    assert!(error
        .to_string()
        .contains("account deletion fixture failure"));
    assert!(account_exists(&db, &account.id));
    assert_eq!(*store.access.borrow(), Some(bundle()));
    assert_eq!(
        store.password.borrow().as_deref(),
        Some("old-dummy-password")
    );
    assert!(!syncing.load(Ordering::SeqCst));

    db.lock()
        .unwrap()
        .writer()
        .execute_batch("DROP TRIGGER fail_account_delete;")
        .expect("account deletion failure trigger should be removed");
    let result =
        delete_account_with_sync_boundary_with_store(&db, &syncing, account.id.clone(), &store);
    assert!(
        result.is_ok(),
        "recovered database should allow retry: {result:?}"
    );
    assert!(!account_exists(&db, &account.id));
    assert!(store.access.borrow().is_none());
    assert!(store.password.borrow().is_none());
    assert!(!syncing.load(Ordering::SeqCst));
}

#[test]
fn cloudflare_access_ipc_partial_inputs_and_redaction() {
    for value in [
        r#"{"action":"replace","clientId":"id"}"#,
        r#"{"action":"replace","clientSecret":"dummy"}"#,
        r#"{"action":"keep","clientSecret":"dummy"}"#,
    ] {
        assert!(serde_json::from_str::<CloudflareAccessArg>(value).is_err());
    }
    assert!(!format!("{:?}", replace()).contains("new-dummy-secret"));
    let metadata = access_metadata(&account(), &configured()).unwrap();
    assert_eq!(
        serde_json::to_string(&metadata).unwrap(),
        r#"{"client_id":"dummy-id"}"#
    );
    let exported =
        serde_json::to_string(&crate::commands::dto::AccountDto::from(account())).unwrap();
    assert!(!exported.contains("cloudflare") && !exported.contains("dummy_secret"));
}

#[test]
fn cloudflare_access_keep_missing_configured_and_origin_mismatch() {
    for store in [FakeStore::default(), configured()] {
        let before = store.access.borrow().clone();
        assert!(persist_account_credentials(
            &account(),
            Some(""),
            &CloudflareAccessArg::Keep {},
            false,
            &store,
            || Ok(())
        )
        .is_ok());
        assert_eq!(*store.access.borrow(), before);
    }
    let store = configured();
    let mut changed = account();
    changed.server_url = Some("https://other.local".into());
    assert!(persist_account_credentials(
        &changed,
        None,
        &CloudflareAccessArg::Keep {},
        false,
        &store,
        || -> Result<(), AppError> { panic!("DB must not run") }
    )
    .is_err());
    assert!(
        persist_account_credentials(&changed, None, &replace(), false, &store, || Ok(())).is_ok()
    );
    assert!(store
        .access
        .borrow()
        .as_ref()
        .unwrap()
        .ensure_origin("https://other.local")
        .is_ok());
}

#[test]
fn cloudflare_access_replace_validation_precedes_writes() {
    let store = configured();
    let mut local = account();
    local.kind = ProviderKind::Local;
    assert!(
        persist_account_credentials(&local, None, &replace(), false, &store, || Ok(())).is_err()
    );
    let mut http = account();
    http.server_url = Some("http://localhost".into());
    assert!(
        persist_account_credentials(&http, None, &replace(), false, &store, || Ok(())).is_err()
    );
    let blank = CloudflareAccessArg::Replace {
        client_id: "id".into(),
        client_secret: "".into(),
    };
    assert!(
        persist_account_credentials(&account(), None, &blank, false, &store, || Ok(())).is_err()
    );
    assert_eq!(*store.access.borrow(), Some(bundle()));
}

#[test]
fn cloudflare_access_replace_remove_and_password_succeed_together() {
    let store = configured();
    assert!(persist_account_credentials(
        &account(),
        Some("new-password"),
        &replace(),
        false,
        &store,
        || Ok(())
    )
    .is_ok());
    assert_eq!(store.password.borrow().as_deref(), Some("new-password"));
    assert_eq!(
        store.access.borrow().as_ref().unwrap().client_id(),
        "new-id"
    );
    assert!(persist_account_credentials(
        &account(),
        None,
        &CloudflareAccessArg::Remove {},
        false,
        &store,
        || Ok(())
    )
    .is_ok());
    assert!(store.access.borrow().is_none());
}

#[test]
fn cloudflare_access_store_presence_errors_never_become_missing() {
    let store = configured();
    *store.failures.borrow_mut() = vec!["load"];
    let error = persist_account_credentials(
        &account(),
        Some("new"),
        &CloudflareAccessArg::Keep {},
        false,
        &store,
        || -> Result<(), AppError> { panic!("DB must not run") },
    )
    .unwrap_err();
    assert!(error.to_string().contains("OS keyring"));
    assert_eq!(
        store.password.borrow().as_deref(),
        Some("old-dummy-password")
    );
}

#[test]
fn cloudflare_access_save_readback_and_db_failure_restore_both_credentials() {
    for fault in [
        "save",
        "verify",
        "load",
        "password_save",
        "password_verify",
        "password_read",
        "db",
    ] {
        let store = configured();
        if fault != "db" {
            *store.failures.borrow_mut() = vec![fault];
        }
        let result = persist_account_credentials(
            &account(),
            Some("new-password"),
            &replace(),
            false,
            &store,
            || {
                if fault == "db" {
                    Err(db_error())
                } else {
                    Ok(())
                }
            },
        );
        assert!(result.is_err(), "fault {fault} must fail");
        assert_eq!(*store.access.borrow(), Some(bundle()), "fault {fault}");
        assert_eq!(
            store.password.borrow().as_deref(),
            Some("old-dummy-password"),
            "fault {fault}"
        );
    }
}

#[test]
fn cloudflare_access_creation_cleans_entries_after_db_or_verification_failure() {
    for fault in ["db", "verify", "password_verify"] {
        let store = FakeStore::default();
        if fault != "db" {
            *store.failures.borrow_mut() = vec![fault];
        }
        let result = persist_account_credentials(
            &account(),
            Some("new-password"),
            &replace(),
            true,
            &store,
            || {
                if fault == "db" {
                    Err(db_error())
                } else {
                    Ok(())
                }
            },
        );
        assert!(result.is_err());
        assert!(store.access.borrow().is_none());
        assert!(store.password.borrow().is_none());
    }
}

#[test]
fn cloudflare_access_rollback_failure_explicitly_requires_recovery() {
    let store = configured();
    *store.failures.borrow_mut() = vec!["verify", "save"];
    let error = persist_account_credentials(
        &account(),
        Some("new-password"),
        &replace(),
        false,
        &store,
        || Ok(()),
    )
    .unwrap_err();
    assert!(error.to_string().contains("Recovery required"));
    assert!(error.to_string().contains("Cloudflare Access: failed"));
    assert!(!error.to_string().contains("new-dummy-secret"));
    assert_eq!(
        store.password.borrow().as_deref(),
        Some("old-dummy-password")
    );
}

#[test]
fn cloudflare_access_delete_failure_preserves_account_for_retry() {
    let store = configured();
    *store.failures.borrow_mut() = vec!["remove"];
    let present = RefCell::new(true);
    let delete = || {
        *present.borrow_mut() = false;
        Ok(())
    };
    assert!(delete_account_credentials("id", &store, delete).is_err());
    assert!(*present.borrow());
    assert_eq!(*store.access.borrow(), Some(bundle()));
    assert!(delete_account_credentials("id", &store, delete).is_ok());
    assert!(!*present.borrow());
    assert!(store.access.borrow().is_none());
}

#[test]
fn cloudflare_access_delete_db_failure_restores_bundle_and_reports_rollback_failure() {
    let store = configured();
    assert!(delete_account_credentials("id", &store, || Err(db_error())).is_err());
    assert_eq!(*store.access.borrow(), Some(bundle()));
    *store.failures.borrow_mut() = vec!["save"];
    let error = delete_account_credentials("id", &store, || Err(db_error())).unwrap_err();
    assert!(error.to_string().contains("Cloudflare Access: failed"));
}

#[test]
fn cloudflare_access_malformed_entry_recovery_and_raw_rollback() {
    let store = FakeStore::default();
    for action in [
        CloudflareAccessArg::Keep {},
        replace(),
        CloudflareAccessArg::Remove {},
    ] {
        *store.malformed.borrow_mut() = Some("cfast_dummy_bad_json".into());
        let result =
            persist_account_credentials(&account(), None, &action, false, &store, || Ok(()));
        if matches!(action, CloudflareAccessArg::Keep {}) {
            assert!(result.is_err());
        } else {
            assert!(result.is_ok());
            assert!(store.malformed.borrow().is_none());
        }
    }
    *store.malformed.borrow_mut() = Some("cfast_dummy_bad_json".into());
    assert!(
        persist_account_credentials(
            &account(),
            None,
            &replace(),
            false,
            &store,
            || Err::<(), _>(db_error())
        )
        .is_err()
    );
    assert_eq!(
        store.malformed.borrow().as_deref(),
        Some("cfast_dummy_bad_json")
    );
    let snapshot = store.snapshot("id").unwrap();
    assert!(!format!("{snapshot:?}").contains("cfast_dummy_bad_json"));
    *store.failures.borrow_mut() = vec!["restore"];
    let error = persist_account_credentials(&account(), None, &replace(), false, &store, || {
        Err::<(), _>(db_error())
    })
    .unwrap_err();
    assert!(error.to_string().contains("Recovery required"));
    assert!(!error.to_string().contains("cfast_dummy_bad_json"));
}

#[test]
fn cloudflare_access_metadata_only_reports_id_and_missing_or_unavailable_states() {
    let store = FakeStore::default();
    assert_eq!(
        serde_json::to_string(&access_metadata(&account(), &store).unwrap()).unwrap(),
        r#"{"client_id":null}"#
    );
    *store.failures.borrow_mut() = vec!["load"];
    assert!(access_metadata(&account(), &store).is_err());
    let mut local = account();
    local.kind = ProviderKind::Local;
    assert!(access_metadata(&local, &store).is_err());
}

#[test]
fn cloudflare_access_delete_retries_against_actual_db_and_export_excludes_credentials() {
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_account::SqliteAccountRepository;
    use crate::repository::account::AccountRepository;
    let db = DbManager::new_in_memory().unwrap();
    let repo = SqliteAccountRepository::new(db.writer());
    let account = account();
    repo.save(&account).unwrap();
    let store = configured();
    *store.failures.borrow_mut() = vec!["remove"];
    let delete = || repo.delete(&account.id).map_err(AppError::from);
    assert!(delete_account_credentials(account.id.as_ref(), &store, delete).is_err());
    assert!(repo.find_by_id(&account.id).unwrap().is_some());
    let serialized = serde_json::to_string(&repo.find_all().unwrap()).unwrap();
    assert!(!serialized.contains("cfast_dummy_secret"));
    assert!(
        !serialized.contains("client_secret")
            && !serialized.contains("client_id")
            && !serialized.contains("https_origin")
    );
    assert!(delete_account_credentials(account.id.as_ref(), &store, delete).is_ok());
    assert!(repo.find_by_id(&account.id).unwrap().is_none());
}

#[test]
fn cloudflare_access_removal_readback_failure_restores_both_credentials() {
    let store = configured();
    *store.failures.borrow_mut() = vec!["remove_verify"];
    assert!(persist_account_credentials(
        &account(),
        Some("new-password"),
        &CloudflareAccessArg::Remove {},
        false,
        &store,
        || panic_db()
    )
    .is_err());
    assert_eq!(*store.access.borrow(), Some(bundle()));
    assert_eq!(
        store.password.borrow().as_deref(),
        Some("old-dummy-password")
    );
    *store.failures.borrow_mut() = vec!["remove_verify", "save"];
    let error = delete_account_credentials("id", &store, || panic_db()).unwrap_err();
    assert!(error.to_string().contains("Recovery required"));
    assert!(store.access.borrow().is_none());
    assert!(delete_account_credentials("id", &store, || Ok(())).is_ok());
}

fn panic_db() -> Result<(), AppError> {
    panic!("failed keyring verification must preserve DB account")
}

#[test]
fn session_cache_settings_metadata_does_not_unlock_the_os_store() {
    use crate::infra::keyring_store::session_cache;
    let mut account = account();
    account.id = AccountId("metadata-without-os-dummy".into());
    let generation = session_cache::invalidate(account.id.as_ref()).unwrap();
    assert!(cached_access_metadata(&account).is_err());
    session_cache::grant(
        &account,
        generation,
        session_cache::SessionCredentials {
            password: zeroize::Zeroizing::new("dummy-password".into()),
            access: Some(bundle()),
        },
    )
    .unwrap();
    assert_eq!(
        cached_access_metadata(&account)
            .unwrap()
            .client_id
            .as_deref(),
        Some("dummy-id")
    );
    session_cache::invalidate(account.id.as_ref()).unwrap();
    assert!(cached_access_metadata(&account).is_err());
}
