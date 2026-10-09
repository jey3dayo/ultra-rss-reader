use tracing::warn;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};

/// An authenticated GReader provider shared by one sync operation.
#[derive(Debug)]
pub(crate) struct GReaderSession {
    provider: GReaderProvider,
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
        let account_id = account.id.as_ref().to_string();
        let access = tokio::task::spawn_blocking(move || {
            crate::infra::keyring_store::cloudflare_access::load_for_sync(&account_id)
        })
        .await
        .map_err(|_| {
            SessionError::Auth(AppError::UserVisible {
                message: "Cloudflare Access credential lookup failed. Try reconnecting.".into(),
            })
        })?;
        let provider = Self::provider_with_access(server_url, access)?;
        let password = super::get_greader_password(account)
            .await
            .map_err(SessionError::Auth)?;

        Self::authenticate(provider, username, password).await
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
        Self { provider }
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
        Ok(Self { provider })
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
}
