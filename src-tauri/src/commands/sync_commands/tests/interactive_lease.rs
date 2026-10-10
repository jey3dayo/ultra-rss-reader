use super::*;
use crate::commands::dto::AppError;
use crate::commands::sync_commands::account_sync::release_lease_after_failed_interactive_sync;
use crate::commands::sync_providers::GReaderSession;
use crate::infra::keyring_store::session_cache::{get, invalidate, SessionCredentials};
use crate::infra::keyring_store::CredentialLookupMode;
use crate::infra::provider::greader::GReaderProvider;

fn granted_session(account: &Account) -> GReaderSession {
    let generation = invalidate(account.id.as_ref()).unwrap();
    GReaderSession::from_provider_for_tests(GReaderProvider::for_freshrss("https://example.com"))
        .grant_lease(
            account,
            generation,
            SessionCredentials {
                password: zeroize::Zeroizing::new("dummy-password".into()),
                access: None,
            },
        )
        .unwrap()
}

fn sync_failure() -> Result<(), AppError> {
    Err(AppError::UserVisible {
        message: "dummy sync failure".into(),
    })
}

#[test]
fn failed_interactive_setup_sync_releases_only_its_own_lease() {
    let account =
        test_sync_command_account("interactive-lease-dummy", ProviderKind::FreshRss, true);

    let session = granted_session(&account);
    release_lease_after_failed_interactive_sync(
        CredentialLookupMode::Background,
        &account,
        &session,
        &sync_failure(),
    );
    assert!(
        get(&account).is_ok(),
        "background failure must not touch the lease"
    );

    release_lease_after_failed_interactive_sync(
        CredentialLookupMode::Interactive,
        &account,
        &session,
        &Ok(()),
    );
    assert!(
        get(&account).is_ok(),
        "successful setup sync keeps its lease"
    );

    let stale = session;
    let _newer = granted_session(&account);
    release_lease_after_failed_interactive_sync(
        CredentialLookupMode::Interactive,
        &account,
        &stale,
        &sync_failure(),
    );
    assert!(get(&account).is_ok(), "stale failure dropped a newer lease");

    let current = granted_session(&account);
    release_lease_after_failed_interactive_sync(
        CredentialLookupMode::Interactive,
        &account,
        &current,
        &sync_failure(),
    );
    assert!(
        get(&account).is_err(),
        "failed setup sync left its lease behind"
    );
}
