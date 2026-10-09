use std::cell::RefCell;
use std::sync::{atomic::AtomicBool, Mutex};

use super::super::access_credentials::{
    delete_account_credentials, persist_account_credentials, AccountCredentialStore,
    CloudflareAccessArg,
};
use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::domain::types::AccountId;
use crate::infra::keyring_store::cloudflare_access::{
    AccessStoreError, CloudflareAccess, CloudflareAccessStore,
};

// Adapt legacy closure fixtures to the production lifecycle. The in-memory
// value supplies readback without touching either OS or development stores.
struct PasswordFixture<G, S, D> {
    get: RefCell<Option<G>>,
    set: RefCell<S>,
    delete: RefCell<D>,
    value: RefCell<Option<Option<String>>>,
}

impl<G, S, D> CloudflareAccessStore for PasswordFixture<G, S, D> {
    fn load(&self, _: &str) -> Result<Option<CloudflareAccess>, AccessStoreError> {
        Ok(None)
    }
    fn save(&self, _: &str, _: &CloudflareAccess) -> Result<(), AccessStoreError> {
        panic!("legacy password fixture must not configure Access")
    }
    fn remove(&self, _: &str) -> Result<(), AccessStoreError> {
        Ok(())
    }
}
impl<G, S, D> AccountCredentialStore for PasswordFixture<G, S, D>
where
    G: FnOnce(&str) -> Result<String, AppError>,
    S: FnMut(&str, &str) -> Result<(), AppError>,
    D: FnMut(&str) -> Result<(), AppError>,
{
    fn password(&self, id: &str) -> Result<Option<String>, AppError> {
        if let Some(value) = self.value.borrow().as_ref() {
            return Ok(value.clone());
        }
        let get = self
            .get
            .borrow_mut()
            .take()
            .expect("initial password fixture reader");
        let value = match get(id) {
            Ok(password) => Some(password),
            Err(error) if super::is_missing_password_error(&error) => None,
            Err(error) => return Err(error),
        };
        *self.value.borrow_mut() = Some(value.clone());
        Ok(value)
    }
    fn set_password(&self, id: &str, password: &str) -> Result<(), AppError> {
        (self.set.borrow_mut())(id, password)?;
        *self.value.borrow_mut() = Some(Some(password.to_string()));
        Ok(())
    }
    fn delete_password(&self, id: &str) -> Result<(), AppError> {
        (self.delete.borrow_mut())(id)?;
        *self.value.borrow_mut() = Some(None);
        Ok(())
    }
}

pub(crate) fn save_account_after_optional_password_with_keyring<F, S, D>(
    account: &Account,
    password: Option<&str>,
    mut set_password: F,
    save_account: S,
    mut delete_password: D,
) -> Result<(), AppError>
where
    F: FnMut(&str, &str) -> Result<(), AppError>,
    S: FnOnce(&Account) -> Result<(), AppError>,
    D: FnMut(&str) -> Result<(), AppError>,
{
    let store = PasswordFixture {
        get: RefCell::new(Some(|_: &str| Ok(String::new()))),
        set: RefCell::new(|id: &str, value: &str| set_password(id, value)),
        delete: RefCell::new(|id: &str| delete_password(id)),
        value: RefCell::new(Some(None)),
    };
    persist_account_credentials(
        account,
        password,
        &CloudflareAccessArg::Keep {},
        true,
        &store,
        || save_account(account),
    )
}

pub(crate) fn update_account_credentials_after_optional_password_with_keyring<F, U, G, S, D>(
    id: &AccountId,
    password: Option<&str>,
    mut find_account: F,
    update: U,
    get: G,
    set: S,
    delete: D,
) -> Result<Account, AppError>
where
    F: FnMut(&AccountId) -> Result<Option<Account>, AppError>,
    U: FnOnce(&AccountId) -> Result<(), AppError>,
    G: FnOnce(&str) -> Result<String, AppError>,
    S: FnMut(&str, &str) -> Result<(), AppError>,
    D: FnMut(&str) -> Result<(), AppError>,
{
    let account = find_account(id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    let store = PasswordFixture {
        get: RefCell::new(Some(get)),
        set: RefCell::new(set),
        delete: RefCell::new(delete),
        value: RefCell::new(None),
    };
    persist_account_credentials(
        &account,
        password,
        &CloudflareAccessArg::Keep {},
        false,
        &store,
        || {
            update(id)?;
            find_account(id)?.ok_or_else(|| AppError::UserVisible {
                message: "Account not found".into(),
            })
        },
    )
}

pub(crate) fn delete_account_then_password<D, K>(
    id: &AccountId,
    delete_account: D,
    delete_password: K,
) -> Result<(), AppError>
where
    D: FnOnce(&AccountId) -> Result<(), AppError>,
    K: FnOnce(&str) -> Result<(), AppError>,
{
    let delete_password = RefCell::new(Some(delete_password));
    let store = PasswordFixture {
        get: RefCell::new(Some(|_: &str| Ok(String::new()))),
        set: RefCell::new(|_: &str, _: &str| Ok(())),
        delete: RefCell::new(|id: &str| {
            delete_password
                .borrow_mut()
                .take()
                .expect("password delete callback")(id)
        }),
        value: RefCell::new(Some(None)),
    };
    delete_account_credentials(id.as_ref(), &store, || delete_account(id))
}

pub(crate) fn delete_account_with_sync_boundary_with_keyring<K>(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
    id: AccountId,
    delete_password: K,
) -> Result<(), AppError>
where
    K: FnOnce(&str) -> Result<(), AppError>,
{
    let delete_password = RefCell::new(Some(delete_password));
    let store = PasswordFixture {
        get: RefCell::new(Some(|_: &str| Ok(String::new()))),
        set: RefCell::new(|_: &str, _: &str| Ok(())),
        delete: RefCell::new(|id: &str| {
            delete_password
                .borrow_mut()
                .take()
                .expect("password delete callback")(id)
        }),
        value: RefCell::new(Some(None)),
    };
    super::delete_account_with_sync_boundary_with_store(db, syncing, id, &store)
}
