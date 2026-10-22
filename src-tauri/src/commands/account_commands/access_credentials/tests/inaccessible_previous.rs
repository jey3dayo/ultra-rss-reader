use super::failure_causes::failure_of;
use super::*;
use crate::domain::error::{CredentialFailure, CredentialFailureCause, CredentialTarget};

fn inaccessible_access() -> FakeStore {
    let store = configured();
    store.unreadable.set(Some(AccessStoreError::Inaccessible));
    store
}

fn persist(
    store: &FakeStore,
    password: Option<&str>,
    action: &CloudflareAccessArg,
) -> Result<(), AppError> {
    persist_account_credentials(&account(), password, action, false, store, || Ok(()))
}

fn access_failure(cause: CredentialFailureCause) -> CredentialFailure {
    CredentialFailure::new(CredentialTarget::CloudflareAccess, cause)
}

#[test]
fn replacing_access_recreates_an_entry_that_cannot_be_read() {
    let store = inaccessible_access();

    persist(&store, None, &replace())
        .expect("an unreadable entry should be deleted and recreated with the new value");

    assert_eq!(
        store
            .access
            .borrow()
            .as_ref()
            .map(CloudflareAccess::client_id),
        Some("new-id")
    );
}

#[test]
fn removing_access_deletes_an_entry_that_cannot_be_read() {
    let store = inaccessible_access();

    persist(&store, None, &CloudflareAccessArg::Remove {})
        .expect("an unreadable entry should still be removable");

    assert!(store.access.borrow().is_none());
}

#[test]
fn an_unreadable_entry_that_cannot_be_deleted_reports_an_unwritable_item() {
    let store = inaccessible_access();
    store.undeletable.set(Some(AccessStoreError::Inaccessible));

    let error = persist(&store, None, &replace())
        .expect_err("an entry that can be neither read nor deleted should stop the save");

    assert_eq!(
        failure_of(&error),
        access_failure(CredentialFailureCause::Unwritable)
    );
    assert_eq!(*store.access.borrow(), Some(bundle()));
}

#[test]
fn a_refused_delete_of_an_unreadable_entry_keeps_its_cause() {
    for (delete_error, cause) in [
        (AccessStoreError::Canceled, CredentialFailureCause::Canceled),
        (
            AccessStoreError::NotAllowed,
            CredentialFailureCause::NotAllowed,
        ),
    ] {
        let store = inaccessible_access();
        store.undeletable.set(Some(delete_error));

        let error = persist(&store, None, &replace())
            .expect_err("a delete the user refused should stop the save");

        assert_eq!(
            failure_of(&error),
            access_failure(cause),
            "{delete_error:?}"
        );
    }
}

#[test]
fn keeping_access_reports_an_unreadable_item_instead_of_a_refusal() {
    let store = inaccessible_access();

    let error = persist(&store, None, &CloudflareAccessArg::Keep {})
        .expect_err("keeping Access needs a readable entry");

    assert_eq!(
        failure_of(&error),
        access_failure(CredentialFailureCause::Unreadable)
    );
    assert_eq!(*store.access.borrow(), Some(bundle()));
}

#[test]
fn a_failure_after_recreating_access_rolls_back_to_the_deleted_state() {
    let store = inaccessible_access();

    let error = persist_account_credentials(&account(), None, &replace(), false, &store, || {
        Err::<(), _>(db_error())
    })
    .expect_err("the database failure should fail the save");

    assert!(!error.to_string().contains("Recovery required"));
    assert!(store.access.borrow().is_none());
}

#[test]
fn an_unverified_delete_of_an_unreadable_entry_requires_recovery() {
    let store = inaccessible_access();
    *store.failures.borrow_mut() = vec!["remove_verify"];

    let error = persist(&store, None, &replace())
        .expect_err("a delete that cannot be verified should fail the save");

    assert!(error.to_string().contains("Recovery required"));
}

#[test]
fn replacing_the_password_recreates_an_entry_that_cannot_be_read() {
    let store = configured();
    store
        .password_unreadable
        .set(Some(CredentialFailureCause::Unreadable));

    persist(
        &store,
        Some("new-dummy-password"),
        &CloudflareAccessArg::Keep {},
    )
    .expect("an unreadable password should be deleted and recreated");

    assert_eq!(
        store.password.borrow().as_deref(),
        Some("new-dummy-password")
    );
}

#[test]
fn an_unreadable_password_that_cannot_be_deleted_stops_before_changing_anything() {
    let store = configured();
    store
        .password_unreadable
        .set(Some(CredentialFailureCause::Unreadable));
    store
        .password_undeletable
        .set(Some(CredentialFailureCause::Unwritable));

    let error = persist(&store, Some("new-dummy-password"), &replace())
        .expect_err("a password that can be neither read nor deleted should stop the save");

    assert_eq!(
        failure_of(&error),
        CredentialFailure::new(
            CredentialTarget::Password,
            CredentialFailureCause::Unwritable
        )
    );
    assert_eq!(*store.access.borrow(), Some(bundle()));
}

#[test]
fn a_refused_password_read_still_stops_the_save() {
    let store = configured();
    store
        .password_unreadable
        .set(Some(CredentialFailureCause::NotAllowed));

    let error = persist(
        &store,
        Some("new-dummy-password"),
        &CloudflareAccessArg::Keep {},
    )
    .expect_err("a read the user refused should not be followed by a delete");

    assert_eq!(
        failure_of(&error),
        CredentialFailure::new(
            CredentialTarget::Password,
            CredentialFailureCause::NotAllowed
        )
    );
    assert_eq!(
        store.password.borrow().as_deref(),
        Some("old-dummy-password")
    );
}
