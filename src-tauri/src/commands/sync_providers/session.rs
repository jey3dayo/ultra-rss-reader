use tracing::warn;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::infra::keyring_store::{self, cloudflare_access, CredentialKind, CredentialLookupMode};
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};

/// An authenticated GReader provider shared by one sync operation.
#[derive(Debug)]
pub(crate) struct GReaderSession {
    provider: GReaderProvider,
    #[cfg(any(target_os = "macos", test))]
    lease_generation: Option<u64>,
}

#[derive(Debug)]
pub(crate) enum SessionError {
    MissingUsername,
    MissingServerUrl,
    Auth(AppError),
}

impl GReaderSession {
    /// Resolve the account credentials and authenticate exactly once.
    pub(crate) async fn establish(account: &Account) -> Result<Self, SessionError> {
        Self::establish_with_mode(account, CredentialLookupMode::Background).await
    }

    pub(crate) async fn establish_interactive(account: &Account) -> Result<Self, SessionError> {
        Self::establish_with_mode(account, CredentialLookupMode::Interactive).await
    }

    async fn establish_with_mode(
        account: &Account,
        mode: CredentialLookupMode,
    ) -> Result<Self, SessionError> {
        let username = account
            .username
            .clone()
            .ok_or(SessionError::MissingUsername)?;
        let server_url = account
            .server_url
            .as_deref()
            .map(str::trim)
            .filter(|server_url| !server_url.is_empty())
            .ok_or(SessionError::MissingServerUrl)?;
        #[cfg(target_os = "macos")]
        if mode == CredentialLookupMode::Background && !keyring_store::uses_dev_credential_store() {
            let (cached, lease_generation) = keyring_store::session_cache::get_leased(account)
                .map_err(|error| SessionError::Auth(error.into()))?;
            let provider = Self::provider_with_access(server_url, Ok(cached.access))?;
            let result = Self::authenticate(provider, username, cached.password.to_string()).await;
            if matches!(&result, Err(SessionError::Auth(error)) if error.diagnostic_kind() == "auth")
            {
                if let Err(error) = keyring_store::session_cache::invalidate_if_generation(
                    account.id.as_ref(),
                    lease_generation,
                ) {
                    warn!(
                        account_id = %account.id.as_ref(),
                        "Could not invalidate rejected credential lease: {error}"
                    );
                }
            }
            return result;
        }
        #[cfg(target_os = "macos")]
        let generation = keyring_store::session_cache::invalidate(account.id.as_ref())
            .map_err(|error| SessionError::Auth(error.into()))?;
        let account_id = account.id.as_ref().to_string();
        // Dev builds only: Cloudflare Access is not in the dev file store, so it still reads the
        // OS Keychain and may prompt, as before leases existed.
        #[cfg(target_os = "macos")]
        let access_mode = if keyring_store::uses_dev_credential_store() {
            CredentialLookupMode::Interactive
        } else {
            mode
        };
        #[cfg(not(target_os = "macos"))]
        let access_mode = mode;
        let access =
            keyring_store::read_for_sync(CredentialKind::CloudflareAccess, mode, move || {
                match access_mode {
                    CredentialLookupMode::Background => {
                        cloudflare_access::load_for_sync(&account_id)
                    }
                    CredentialLookupMode::Interactive => {
                        cloudflare_access::load_for_sync_with_mode(&account_id, access_mode)
                    }
                }
                .map_err(crate::domain::error::DomainError::from)
            })
            .await
            .map_err(|error| SessionError::Auth(error.into()))?;
        #[cfg(target_os = "macos")]
        let cached_access = access.clone();
        let provider = Self::provider_with_access(server_url, Ok(access))?;
        let password = match mode {
            CredentialLookupMode::Background => super::get_greader_password(account).await,
            CredentialLookupMode::Interactive => {
                super::get_greader_password_interactive(account).await
            }
        }
        .map_err(SessionError::Auth)?;

        #[cfg(target_os = "macos")]
        let credentials = keyring_store::session_cache::SessionCredentials {
            password: zeroize::Zeroizing::new(password.clone()),
            access: cached_access,
        };
        let session = Self::authenticate(provider, username, password).await?;
        #[cfg(target_os = "macos")]
        let session = session.grant_lease(account, generation, credentials)?;
        Ok(session)
    }

    fn provider_with_access(
        server_url: &str,
        access: Result<
            Option<crate::infra::keyring_store::cloudflare_access::CloudflareAccess>,
            crate::infra::keyring_store::cloudflare_access::AccessStoreError,
        >,
    ) -> Result<GReaderProvider, SessionError> {
        let access = access.map_err(|error| {
            SessionError::Auth(crate::domain::error::DomainError::from(error).into())
        })?;
        GReaderProvider::try_for_freshrss_with_access(server_url, access)
            .map_err(|error| SessionError::Auth(error.into()))
    }

    pub(crate) fn provider(&self) -> &GReaderProvider {
        &self.provider
    }

    /// Generation this session attempted to grant; `None` when it never reached a grant.
    #[cfg(any(target_os = "macos", test))]
    pub(crate) fn lease_generation(&self) -> Option<u64> {
        self.lease_generation
    }

    #[cfg(any(target_os = "macos", test))]
    pub(crate) fn grant_lease(
        self,
        account: &Account,
        generation: u64,
        credentials: keyring_store::session_cache::SessionCredentials,
    ) -> Result<Self, SessionError> {
        keyring_store::session_cache::grant(account, generation, credentials)
            .map_err(|error| SessionError::Auth(error.into()))?;
        Ok(Self {
            lease_generation: Some(generation),
            ..self
        })
    }
}

impl SessionError {
    pub(crate) fn into_user_visible(self) -> AppError {
        match self {
            Self::MissingUsername => AppError::UserVisible {
                message: "FreshRSS username is required".to_string(),
            },
            Self::MissingServerUrl => AppError::UserVisible {
                message: "FreshRSS server URL is required".to_string(),
            },
            Self::Auth(error) => error,
        }
    }

    pub(crate) fn log_skip(&self, account: &Account) {
        match self {
            Self::MissingUsername => warn!(
                "GReader account {} has no username, skipping",
                account.id.as_ref()
            ),
            Self::MissingServerUrl => warn!(
                "GReader account {} has no server URL, skipping",
                account.id.as_ref()
            ),
            Self::Auth(_) => {}
        }
    }

    pub(crate) fn log_skip_with_context(&self, account: &Account, context: &str) {
        match self {
            Self::MissingUsername => warn!(
                "GReader account {} has no username, skipping {context}",
                account.id.as_ref()
            ),
            Self::MissingServerUrl => warn!(
                "GReader account {} has no server URL, skipping {context}",
                account.id.as_ref()
            ),
            Self::Auth(_) => {}
        }
    }
}

impl GReaderSession {
    #[cfg(test)]
    pub(crate) fn from_provider_for_tests(provider: GReaderProvider) -> Self {
        Self {
            provider,
            #[cfg(any(target_os = "macos", test))]
            lease_generation: None,
        }
    }

    async fn authenticate(
        mut provider: GReaderProvider,
        username: String,
        password: String,
    ) -> Result<Self, SessionError> {
        provider
            .authenticate(&Credentials {
                token: Some(username),
                password: Some(password),
            })
            .await
            .map_err(|error| SessionError::Auth(error.into()))?;
        Ok(Self {
            provider,
            #[cfg(any(target_os = "macos", test))]
            lease_generation: None,
        })
    }

    #[cfg(test)]
    async fn establish_with_password(
        account: &Account,
        password: &str,
    ) -> Result<Self, SessionError> {
        let username = account
            .username
            .clone()
            .ok_or(SessionError::MissingUsername)?;
        let server_url = account
            .server_url
            .as_deref()
            .map(str::trim)
            .filter(|server_url| !server_url.is_empty())
            .ok_or(SessionError::MissingServerUrl)?;
        Self::authenticate(
            GReaderProvider::for_freshrss(server_url),
            username,
            password.to_string(),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::{GReaderSession, SessionError};
    use crate::commands::dto::AppError;
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;

    fn test_account(server_url: Option<&str>, username: Option<&str>) -> Account {
        Account {
            id: AccountId("session-test-account".to_string()),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: server_url.map(str::to_string),
            username: username.map(str::to_string),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    #[tokio::test]
    async fn establish_returns_missing_username_before_network_access() {
        let account = test_account(Some("https://example.com"), None);

        let error = GReaderSession::establish(&account)
            .await
            .expect_err("missing username should be typed before authentication");

        assert!(matches!(error, SessionError::MissingUsername));
    }

    #[tokio::test]
    async fn establish_returns_missing_server_url_before_network_access() {
        let account = test_account(None, Some("user"));

        let error = GReaderSession::establish(&account)
            .await
            .expect_err("missing server URL should be typed before authentication");

        assert!(matches!(error, SessionError::MissingServerUrl));
    }

    #[tokio::test]
    async fn establish_returns_missing_server_url_for_blank_value_before_network_access() {
        let account = test_account(Some(" \t "), Some("user"));

        let error = GReaderSession::establish(&account)
            .await
            .expect_err("blank server URL should be typed before authentication");

        assert!(matches!(error, SessionError::MissingServerUrl));
    }

    #[tokio::test]
    async fn establish_returns_auth_error_when_client_login_fails() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(401)
            .with_body("invalid credentials")
            .create_async()
            .await;
        let account = test_account(Some(&server.url()), Some("user"));

        let error = GReaderSession::establish_with_password(&account, "wrong-password")
            .await
            .expect_err("client login failure should be returned as SessionError::Auth");

        assert!(matches!(
            error,
            SessionError::Auth(AppError::UserVisible { .. })
        ));
    }
    #[test]
    fn cloudflare_access_session_load_errors_and_imported_origin_changes_fail_closed() {
        use crate::infra::keyring_store::cloudflare_access::{AccessStoreError, CloudflareAccess};
        for error in [AccessStoreError::Unavailable, AccessStoreError::Malformed] {
            assert!(matches!(
                GReaderSession::provider_with_access("https://localhost", Err(error)),
                Err(SessionError::Auth(_))
            ));
        }
        let access = CloudflareAccess::new("dummy-id", "cfast_dummy", "https://localhost").unwrap();
        assert!(matches!(
            GReaderSession::provider_with_access("https://127.0.0.1", Ok(Some(access))),
            Err(SessionError::Auth(_))
        ));
        assert!(GReaderSession::provider_with_access("http://localhost", Ok(None)).is_ok());
    }

    #[test]
    fn granting_a_lease_records_the_generation_it_attempted() {
        use crate::infra::keyring_store::session_cache::{
            get_leased, invalidate, SessionCredentials,
        };
        use crate::infra::provider::greader::GReaderProvider;
        let account = test_account(Some("https://example.com"), Some("user"));
        let generation = invalidate(account.id.as_ref()).unwrap();
        let session = GReaderSession::from_provider_for_tests(GReaderProvider::for_freshrss(
            "https://example.com",
        ));
        let session = session
            .grant_lease(
                &account,
                generation,
                SessionCredentials {
                    password: zeroize::Zeroizing::new("dummy-password".into()),
                    access: None,
                },
            )
            .unwrap();

        assert_eq!(session.lease_generation(), Some(generation));
        assert_eq!(get_leased(&account).unwrap().1, generation);
    }
}
