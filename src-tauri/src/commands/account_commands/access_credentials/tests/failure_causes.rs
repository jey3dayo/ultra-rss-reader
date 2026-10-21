use super::*;
use crate::domain::error::{CredentialFailure, CredentialFailureCause, CredentialTarget};

fn access_failure(cause: CredentialFailureCause) -> CredentialFailure {
    CredentialFailure::new(CredentialTarget::CloudflareAccess, cause)
}

fn failure_of(error: &AppError) -> CredentialFailure {
    match error {
        AppError::CredentialStore {
            credential_failure, ..
        } => *credential_failure,
        other => panic!("a keyring failure should carry its cause, got {other:?}"),
    }
}

fn save_failure(account: &Account, store: &FakeStore, action: &CloudflareAccessArg) -> AppError {
    persist_account_credentials(account, None, action, false, store, || Ok(()))
        .expect_err("the keyring failure should fail the save")
}

#[test]
fn unreadable_access_keyring_before_a_save_is_a_read_failure() {
    let store = configured();
    store.unavailable.set(true);

    let error = save_failure(&account(), &store, &replace());

    assert_eq!(
        failure_of(&error),
        access_failure(CredentialFailureCause::ReadFailed)
    );
}

#[test]
fn failed_access_write_is_a_write_failure() {
    for (failure, action) in [
        ("save", replace()),
        ("remove", CloudflareAccessArg::Remove {}),
    ] {
        let store = configured();
        *store.failures.borrow_mut() = vec![failure];

        let error = save_failure(&account(), &store, &action);

        assert_eq!(
            failure_of(&error),
            access_failure(CredentialFailureCause::WriteFailed),
            "{failure}"
        );
    }
}

#[test]
fn access_write_that_cannot_be_read_back_is_unverified() {
    let store = configured();
    *store.failures.borrow_mut() = vec!["verify"];

    let error = save_failure(&account(), &store, &replace());

    assert_eq!(
        failure_of(&error),
        access_failure(CredentialFailureCause::Unverified)
    );
}

#[test]
fn unreadable_access_metadata_is_a_read_failure() {
    let store = configured();
    store.unavailable.set(true);

    let error = access_metadata(&account(), &store)
        .expect_err("an unreadable keyring should not report metadata");

    assert_eq!(
        failure_of(&error),
        access_failure(CredentialFailureCause::ReadFailed)
    );
}

#[test]
fn a_denied_keyring_prompt_is_not_allowed_whatever_the_operation() {
    for operation in [AccessOperation::Read, AccessOperation::Write] {
        let error = store_error(AccessStoreError::NotAllowed, operation);

        assert_eq!(
            failure_of(&error),
            access_failure(CredentialFailureCause::NotAllowed),
            "{operation:?}"
        );
    }
}
