use super::failure_causes::failure_of;
use super::*;
use crate::domain::error::{CredentialFailure, CredentialFailureCause, CredentialTarget};

fn store_with_unreadable_previous(error: AccessStoreError) -> FakeStore {
    let store = configured();
    store.unreadable.set(Some(error));
    store
}

fn persist(store: &FakeStore, action: &CloudflareAccessArg) -> Result<(), AppError> {
    persist_account_credentials(&account(), None, action, false, store, || Ok(()))
}

#[test]
fn replacing_access_does_not_need_the_previous_value_to_be_readable() {
    let store = store_with_unreadable_previous(AccessStoreError::Unavailable);

    persist(&store, &replace())
        .expect("an unreadable previous value should not block writing the replacement");

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
fn removing_access_does_not_need_the_previous_value_to_be_readable() {
    let store = store_with_unreadable_previous(AccessStoreError::Unavailable);

    persist(&store, &CloudflareAccessArg::Remove {})
        .expect("an unreadable previous value should not block removal");

    assert!(store.access.borrow().is_none());
}

#[test]
fn a_cancelled_or_denied_read_still_stops_the_replacement() {
    for (read_error, cause) in [
        (AccessStoreError::Canceled, CredentialFailureCause::Canceled),
        (
            AccessStoreError::NotAllowed,
            CredentialFailureCause::NotAllowed,
        ),
    ] {
        let store = store_with_unreadable_previous(read_error);

        let error = persist(&store, &replace())
            .expect_err("a read the user refused should not be followed by a write");

        assert_eq!(
            failure_of(&error),
            CredentialFailure::new(CredentialTarget::CloudflareAccess, cause)
        );
        assert_eq!(*store.access.borrow(), Some(bundle()), "{read_error:?}");
    }
}

#[test]
fn keeping_access_still_requires_the_previous_value_to_be_readable() {
    let store = store_with_unreadable_previous(AccessStoreError::Unavailable);

    let error = persist(&store, &CloudflareAccessArg::Keep {})
        .expect_err("keeping Access needs its stored value to check the origin");

    assert_eq!(
        failure_of(&error),
        CredentialFailure::new(
            CredentialTarget::CloudflareAccess,
            CredentialFailureCause::ReadFailed
        )
    );
}

#[test]
fn a_failed_write_over_an_unreadable_value_keeps_its_own_cause() {
    let store = store_with_unreadable_previous(AccessStoreError::Unavailable);
    *store.failures.borrow_mut() = vec!["save"];

    let error = persist(&store, &replace()).expect_err("the failed write should fail the save");

    assert_eq!(
        failure_of(&error),
        CredentialFailure::new(
            CredentialTarget::CloudflareAccess,
            CredentialFailureCause::WriteFailed
        )
    );
}

#[test]
fn a_write_that_cannot_be_undone_after_a_later_failure_requires_recovery() {
    for fault in ["verify", "db"] {
        let store = store_with_unreadable_previous(AccessStoreError::Unavailable);
        if fault == "verify" {
            *store.failures.borrow_mut() = vec!["verify"];
        }

        let error =
            persist_account_credentials(&account(), None, &replace(), false, &store, || {
                if fault == "db" {
                    Err::<(), _>(db_error())
                } else {
                    Ok(())
                }
            })
            .expect_err("the failure after the write should fail the save");

        assert!(error.to_string().contains("Recovery required"), "{fault}");
        assert!(
            error.to_string().contains("Cloudflare Access: failed"),
            "{fault}"
        );
    }
}
