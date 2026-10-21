use tracing::warn;

use super::{GReaderSession, SessionError};
use crate::domain::account::Account;
use crate::infra::keyring_store::{self, CredentialLookupMode};

impl GReaderSession {
    /// Authenticates from the session lease. Background work needs a lease; an interactive
    /// attempt without a usable lease, or whose lease the server rejects, returns `Ok(None)`
    /// so the caller reads the credential store instead. Any other interactive failure drops the
    /// lease it used, so a lease granted by a save never outlives a connection that failed.
    pub(super) async fn try_leased_session(
        account: &Account,
        mode: CredentialLookupMode,
        username: &str,
        server_url: &str,
    ) -> Result<Option<Self>, SessionError> {
        let (cached, generation) = match keyring_store::session_cache::get_leased(account) {
            Ok(leased) => leased,
            Err(_) if mode == CredentialLookupMode::Interactive => return Ok(None),
            Err(error) => return Err(SessionError::Auth(error.into())),
        };
        let result = async {
            let provider = Self::provider_with_access(server_url, Ok(cached.access)).await?;
            Self::authenticate(provider, username.to_string(), cached.password.to_string()).await
        }
        .await;
        if let Err(error) = &result {
            let rejected =
                matches!(error, SessionError::Auth(error) if error.diagnostic_kind() == "auth");
            if rejected || mode == CredentialLookupMode::Interactive {
                if let Err(error) = keyring_store::session_cache::invalidate_if_generation(
                    account.id.as_ref(),
                    generation,
                ) {
                    warn!(
                        account_id = %account.id.as_ref(),
                        "Could not invalidate failed credential lease: {error}"
                    );
                }
            }
            if rejected && mode == CredentialLookupMode::Interactive {
                return Ok(None);
            }
        }
        result.map(|session| {
            Some(Self {
                lease_generation: (mode == CredentialLookupMode::Interactive).then_some(generation),
                ..session
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::ConnectionVerificationStatus;
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;
    use crate::infra::keyring_store::session_cache::{self, SessionCredentials};

    fn account(id: &str, server_url: &str) -> Account {
        Account {
            id: AccountId(id.to_string()),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some(server_url.to_string()),
            username: Some("user".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn lease(account: &Account) -> u64 {
        let generation = session_cache::invalidate(account.id.as_ref())
            .expect("lease fixture should obtain a generation");
        session_cache::grant(
            account,
            generation,
            SessionCredentials {
                password: zeroize::Zeroizing::new("leased-dummy-password".into()),
                access: None,
            },
        )
        .expect("lease fixture should be granted");
        generation
    }

    async fn login_server(status: usize) -> (mockito::ServerGuard, mockito::Mock) {
        let mut server = mockito::Server::new_async().await;
        let login = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_body("Email=user&Passwd=leased-dummy-password")
            .with_status(status)
            .with_body("Auth=dummy-auth\n")
            .create_async()
            .await;
        (server, login)
    }

    async fn try_lease(
        account: &Account,
        mode: CredentialLookupMode,
    ) -> Result<Option<GReaderSession>, SessionError> {
        let server_url = account.server_url.as_deref().expect("fixture has a URL");
        GReaderSession::try_leased_session(account, mode, "user", server_url).await
    }

    #[tokio::test]
    async fn interactive_attempt_authenticates_from_a_valid_lease() {
        let (server, login) = login_server(200).await;
        let account = account("lease-interactive-valid-dummy", &server.url());
        let generation = lease(&account);

        let session = try_lease(&account, CredentialLookupMode::Interactive)
            .await
            .expect("a valid lease should authenticate")
            .expect("a valid lease should be used without reading the credential store");

        login.assert_async().await;
        assert_eq!(session.lease_generation(), Some(generation));
        assert_eq!(
            session_cache::get_leased(&account)
                .expect("the used lease should remain")
                .1,
            generation
        );
    }

    #[tokio::test]
    async fn interactive_attempt_without_a_lease_falls_back_to_the_credential_store() {
        let account = account("lease-interactive-none-dummy", "https://localhost");
        session_cache::invalidate(account.id.as_ref()).expect("fixture should clear the lease");

        let outcome = try_lease(&account, CredentialLookupMode::Interactive).await;

        assert!(matches!(outcome, Ok(None)));
    }

    #[tokio::test]
    async fn interactive_attempt_drops_a_rejected_lease_and_falls_back() {
        let (server, login) = login_server(401).await;
        let account = account("lease-interactive-rejected-dummy", &server.url());
        lease(&account);

        let outcome = try_lease(&account, CredentialLookupMode::Interactive).await;

        login.assert_async().await;
        assert!(matches!(outcome, Ok(None)));
        assert!(session_cache::get_leased(&account).is_err());
    }

    #[tokio::test]
    async fn interactive_login_failure_after_a_save_leaves_no_lease() {
        let (failing, _login) = login_server(500).await;
        let urls = [failing.url(), "http://127.0.0.1:1".to_string()];
        for (index, server_url) in urls.iter().enumerate() {
            let account = account(
                &format!("lease-saved-login-failed-{index}-dummy"),
                server_url,
            );
            session_cache::grant_saved(&account, Some("leased-dummy-password"), None, None);
            assert!(session_cache::get_leased(&account).is_ok());

            let outcome = try_lease(&account, CredentialLookupMode::Interactive).await;

            assert!(
                matches!(outcome, Err(SessionError::Auth(_))),
                "{server_url}"
            );
            assert!(session_cache::get_leased(&account).is_err(), "{server_url}");
        }
    }

    #[tokio::test]
    async fn stale_interactive_failure_keeps_a_newer_lease() {
        let mut server = mockito::Server::new_async().await;
        let account = account("lease-stale-failure-dummy", &server.url());
        let regranted = account.clone();
        let newer_generation = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
        let recorded = newer_generation.clone();
        let _login = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(500)
            .with_body_from_request(move |_| {
                recorded.store(lease(&regranted), std::sync::atomic::Ordering::SeqCst);
                Vec::new()
            })
            .create_async()
            .await;
        let stale_generation = lease(&account);

        let outcome = try_lease(&account, CredentialLookupMode::Interactive).await;

        let newer = newer_generation.load(std::sync::atomic::Ordering::SeqCst);
        assert!(matches!(outcome, Err(SessionError::Auth(_))));
        assert_ne!(newer, stale_generation);
        assert_eq!(
            session_cache::get_leased(&account)
                .expect("a failure of the older attempt must not drop the newer lease")
                .1,
            newer
        );
    }

    #[tokio::test]
    async fn background_login_failure_keeps_the_lease() {
        let (server, _login) = login_server(500).await;
        let account = account("lease-background-transient-dummy", &server.url());
        lease(&account);

        let outcome = try_lease(&account, CredentialLookupMode::Background).await;

        assert!(matches!(outcome, Err(SessionError::Auth(_))));
        assert!(session_cache::get_leased(&account).is_ok());
    }

    #[tokio::test]
    async fn background_attempt_without_a_lease_needs_authorization() {
        let account = account("lease-background-none-dummy", "https://localhost");
        session_cache::invalidate(account.id.as_ref()).expect("fixture should clear the lease");

        let outcome = try_lease(&account, CredentialLookupMode::Background).await;

        assert!(matches!(outcome, Err(SessionError::Auth(_))));
    }

    #[tokio::test]
    async fn background_attempt_reports_a_rejected_lease_and_drops_it() {
        let (server, _login) = login_server(401).await;
        let account = account("lease-background-rejected-dummy", &server.url());
        lease(&account);

        let outcome = try_lease(&account, CredentialLookupMode::Background).await;

        assert!(matches!(outcome, Err(SessionError::Auth(_))));
        assert!(session_cache::get_leased(&account).is_err());
    }
}
