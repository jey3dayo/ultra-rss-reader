use super::*;
use crate::domain::account::ConnectionVerificationStatus;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;

fn account(id: &str) -> Account {
    Account {
        id: AccountId(id.into()),
        kind: ProviderKind::FreshRss,
        name: "dummy".into(),
        server_url: Some("https://example.test".into()),
        username: Some("dummy".into()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: true,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

fn credentials() -> SessionCredentials {
    SessionCredentials {
        password: Zeroizing::new("dummy-password".into()),
        access: None,
    }
}

#[test]
fn cancellation_removes_previous_grant_until_successful_explicit_retry() {
    let mut cache = SessionCache::default();
    let account = account("cancel");
    let now = Instant::now();
    let first = cache.invalidate(account.id.as_ref());
    cache.grant(&account, first, credentials(), now);
    assert!(cache.get(&account, now).is_some());
    cache.invalidate(account.id.as_ref()); // Attempt fails or user cancels: no grant.
    assert!(cache.get(&account, now).is_none());
    let retry = cache.invalidate(account.id.as_ref());
    cache.grant(&account, retry, credentials(), now);
    assert_eq!(
        cache.get(&account, now).unwrap().password.as_str(),
        "dummy-password"
    );
}

#[test]
fn lease_expires_without_sliding_on_background_use() {
    let mut cache = SessionCache::default();
    let account = account("expiry");
    let now = Instant::now();
    cache.grant(&account, 0, credentials(), now);
    assert!(cache.get(&account, now + LEASE / 2).is_some());
    assert!(cache.get(&account, now + LEASE).is_none());
    assert!(cache.leases.is_empty());
}

#[test]
fn changed_identity_and_failed_mutations_invalidate_cached_credentials() {
    let mut cache = SessionCache::default();
    let mut account = account("change");
    let now = Instant::now();
    cache.grant(&account, 0, credentials(), now);
    account.server_url = Some("https://other.example.test".into());
    assert!(cache.get(&account, now).is_none());
    let generation = cache.invalidate(account.id.as_ref());
    cache.grant(&account, generation, credentials(), now);
    account.username = Some("another-user".into());
    assert!(cache.get(&account, now).is_none());
    let generation = cache.invalidate(account.id.as_ref());
    cache.invalidate(account.id.as_ref()); // Save/delete while an explicit read is in flight.
    cache.grant(&account, generation, credentials(), now);
    assert!(cache.get(&account, now).is_none());
}

#[test]
fn stale_invalidation_keeps_a_lease_granted_after_it_was_read() {
    let mut cache = SessionCache::default();
    let account = account("stale-invalidate");
    let now = Instant::now();
    let first = cache.invalidate(account.id.as_ref());
    cache.grant(&account, first, credentials(), now);
    let (_, read_generation) = cache.get_leased(&account, now).unwrap();
    assert_eq!(read_generation, first);

    let second = cache.invalidate(account.id.as_ref());
    cache.grant(&account, second, credentials(), now);

    assert!(!cache.invalidate_if_generation(account.id.as_ref(), read_generation));
    assert_eq!(cache.get_leased(&account, now).unwrap().1, second);
    assert!(cache.invalidate_if_generation(account.id.as_ref(), second));
    assert!(cache.get(&account, now).is_none());
}

#[test]
fn identity_mismatch_refuses_the_caller_without_dropping_a_newer_lease() {
    let mut cache = SessionCache::default();
    let mut account = account("stale-snapshot");
    let now = Instant::now();
    let generation = cache.invalidate(account.id.as_ref());
    cache.grant(&account, generation, credentials(), now);
    let current = account.clone();
    account.server_url = Some("https://old.example.test".into());

    assert!(cache.get_leased(&account, now).is_none());
    assert!(cache.get(&current, now).is_some());
}

#[test]
fn has_lease_reports_unexpired_leases_without_identity() {
    let mut cache = SessionCache::default();
    let account = account("has-lease");
    let now = Instant::now();
    assert!(!cache.has_lease(account.id.as_ref(), now));
    cache.grant(&account, 0, credentials(), now);
    assert!(cache.has_lease(account.id.as_ref(), now));
    assert!(!cache.has_lease(account.id.as_ref(), now + LEASE));
}

#[test]
fn bounded_cache_evicts_oldest_account() {
    let mut cache = SessionCache::default();
    let now = Instant::now();
    for i in 0..=MAX_ACCOUNTS {
        cache.grant(
            &account(&i.to_string()),
            0,
            credentials(),
            now + Duration::from_secs(i as u64),
        );
    }
    assert_eq!(cache.leases.len(), MAX_ACCOUNTS);
    assert!(cache.get(&account("0"), now).is_none());
}

#[test]
fn settings_metadata_uses_only_the_in_memory_lease() {
    let account = account("metadata-dummy");
    let generation = invalidate(account.id.as_ref()).unwrap();
    assert!(get(&account).is_err());
    grant(&account, generation, credentials()).unwrap();
    assert!(get(&account).unwrap().access.is_none());
    invalidate(account.id.as_ref()).unwrap();
    assert!(get(&account).is_err());
    assert!(needs_auth()
        .to_string()
        .contains("Save and test connection"));
}

#[cfg(target_os = "macos")]
#[test]
fn unattended_raw_reads_fail_before_starting_any_keychain_process() {
    use crate::infra::keyring_store::{macos_security_cli, CredentialKind, CredentialLookupMode};
    let password = macos_security_cli::get_password_from_security_cli(
        "dummy-never-read",
        CredentialLookupMode::Background,
    );
    assert!(matches!(password, Err(DomainError::Keychain(message)) if message == NEEDS_AUTH));
    let access = macos_security_cli::get_credential_from_security_cli(
        CredentialKind::CloudflareAccess,
        "dummy-never-read",
        "dummy-never-read",
        CredentialLookupMode::Background,
    );
    assert!(matches!(access, Err(DomainError::Keychain(message)) if message == NEEDS_AUTH));
    assert_eq!(
        CredentialLookupMode::for_user_sync(),
        CredentialLookupMode::Background
    );
}
