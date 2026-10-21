use super::*;
use crate::infra::keyring_store::session_cache::{self, SessionCredentials};

fn account_with_id(id: &str) -> Account {
    let mut account = account();
    account.id = AccountId(id.into());
    account
}

fn persist(
    account: &Account,
    password: Option<&str>,
    action: &CloudflareAccessArg,
    store: &FakeStore,
) -> Result<(), AppError> {
    persist_account_credentials(account, password, action, false, store, || Ok(()))
}

fn seed_lease(account: &Account, password: &str, access: Option<CloudflareAccess>) {
    let generation = session_cache::invalidate(account.id.as_ref())
        .expect("lease fixture should obtain a generation");
    session_cache::grant(
        account,
        generation,
        SessionCredentials {
            password: zeroize::Zeroizing::new(password.into()),
            access,
        },
    )
    .expect("lease fixture should be granted");
}

fn lease_of(account: &Account) -> Option<SessionCredentials> {
    session_cache::get_leased(account)
        .ok()
        .map(|(credentials, _)| credentials)
}

#[test]
fn password_change_reads_the_password_once_for_rollback_only() {
    let account = account_with_id("reads-password-change-dummy");
    let store = configured();

    persist(
        &account,
        Some("new-dummy-password"),
        &CloudflareAccessArg::Keep {},
        &store,
    )
    .expect("password change should persist");

    assert_eq!(store.password_reads.get(), 1);
    assert_eq!(store.access_loads.get(), 0);
}

#[test]
fn access_replace_and_remove_do_not_reload_the_bundle_after_writing() {
    let account = account_with_id("reads-access-change-dummy");
    for action in [replace(), CloudflareAccessArg::Remove {}] {
        let store = configured();

        persist(&account, None, &action, &store).expect("access change should persist");

        assert_eq!(store.access_loads.get(), 0, "{action:?}");
        assert_eq!(store.password_reads.get(), 0, "{action:?}");
    }
}

#[test]
fn saved_password_and_kept_access_become_the_session_lease() {
    let account = account_with_id("lease-after-save-dummy");

    persist(
        &account,
        Some("new-dummy-password"),
        &CloudflareAccessArg::Keep {},
        &configured(),
    )
    .expect("password change should persist");

    let leased = lease_of(&account).expect("a successful save should grant a lease");
    assert_eq!(leased.password.as_str(), "new-dummy-password");
    assert_eq!(leased.access, Some(bundle()));
}

#[test]
fn access_only_change_keeps_the_previously_leased_password() {
    let account = account_with_id("lease-access-only-dummy");
    seed_lease(&account, "leased-dummy-password", Some(bundle()));

    persist(&account, None, &replace(), &configured()).expect("access replace should persist");
    let replaced = lease_of(&account).expect("access replace should regrant the lease");
    assert_eq!(replaced.password.as_str(), "leased-dummy-password");
    assert_eq!(
        replaced.access.as_ref().map(CloudflareAccess::client_id),
        Some("new-id")
    );

    persist(
        &account,
        None,
        &CloudflareAccessArg::Remove {},
        &configured(),
    )
    .expect("access removal should persist");
    let removed = lease_of(&account).expect("access removal should regrant the lease");
    assert_eq!(removed.password.as_str(), "leased-dummy-password");
    assert_eq!(removed.access, None);
}

#[test]
fn unchanged_password_without_a_lease_grants_nothing() {
    let account = account_with_id("lease-unknown-password-dummy");
    session_cache::invalidate(account.id.as_ref()).expect("fixture should clear the lease");

    persist(&account, None, &replace(), &configured()).expect("access replace should persist");

    assert!(lease_of(&account).is_none());
}

#[test]
fn failed_save_leaves_no_lease_even_when_one_existed() {
    let account = account_with_id("lease-failed-save-dummy");
    for failure in ["password_verify", "verify"] {
        seed_lease(&account, "leased-dummy-password", Some(bundle()));
        let store = configured();
        *store.failures.borrow_mut() = vec![failure];

        let action = if failure == "verify" {
            replace()
        } else {
            CloudflareAccessArg::Keep {}
        };
        persist(&account, Some("new-dummy-password"), &action, &store)
            .expect_err("a failed credential write should fail the save");

        assert!(lease_of(&account).is_none(), "{failure}");
    }

    seed_lease(&account, "leased-dummy-password", Some(bundle()));
    persist_account_credentials(
        &account,
        Some("new-dummy-password"),
        &CloudflareAccessArg::Keep {},
        false,
        &configured(),
        || Err::<(), _>(db_error()),
    )
    .expect_err("a failed account write should fail the save");
    assert!(lease_of(&account).is_none());
}
