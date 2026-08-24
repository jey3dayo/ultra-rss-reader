use reqwest::header::HeaderValue;
use serde::de::DeserializeOwned;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, ToSocketAddrs};
use std::sync::Arc;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{FeedIdentifier, Mutation, ProviderKind};
use crate::domain::url_policy::{is_private_host, validate_user_provided_server_url};
use crate::infra::feed_discovery::{
    resolve_validated_public_addrs, validate_discovery_url, validated_public_dns_resolver,
};

use super::super::http_defaults::{self, http_client_builder};
use super::super::traits::Credentials as ProviderCredentials;
use super::{urlencoded, GReaderProvider, LABEL_PREFIX, STATE_READ, STATE_STARRED};

pub(super) fn freshrss_api_base(server_url: &str) -> String {
    let normalized_url = match reqwest::Url::parse(server_url.trim()) {
        Ok(mut url) if url.scheme() == "http" || url.scheme() == "https" => {
            let _ = url.set_username("");
            let _ = url.set_password(None);
            url.to_string()
        }
        _ => server_url.trim().to_string(),
    };
    let base = normalized_url.trim_end_matches('/');
    if base.ends_with("/api/greader.php") {
        base.to_string()
    } else {
        format!("{base}/api/greader.php")
    }
}

pub(super) fn greader_json_body_too_large_error() -> DomainError {
    DomainError::Network(format!(
        "GReader JSON response body exceeds {} bytes",
        http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
    ))
}

pub(super) fn resolve_greader_base_addrs(url: &reqwest::Url) -> DomainResult<Vec<SocketAddr>> {
    validate_user_provided_server_url(url)?;

    if let Some(address) = explicit_greader_base_addr(url) {
        // A literal/private FreshRSS base is an explicit user-selected endpoint:
        // it cannot be DNS-rebound, so account URL verification (url_policy / #65)
        // owns the UX decision about whether private servers are acceptable.
        return Ok(vec![address]);
    }

    if url.host_str().is_some_and(is_private_host) {
        return resolve_user_selected_host_addrs(url);
    }

    resolve_validated_public_addrs(url)
}

fn resolve_user_selected_host_addrs(url: &reqwest::Url) -> DomainResult<Vec<SocketAddr>> {
    let Some(host) = url.host_str() else {
        return Err(DomainError::Validation(
            crate::domain::url_policy::MISSING_HOST_URL_VALIDATION_MESSAGE.to_string(),
        ));
    };
    let port = url.port_or_known_default().unwrap_or(80);
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|_| DomainError::Network("Could not resolve the server name".to_string()))?
        .collect::<Vec<_>>();
    if addresses.is_empty() {
        return Err(DomainError::Network(
            "Could not resolve the server name".to_string(),
        ));
    }
    Ok(addresses)
}

pub(super) fn explicit_greader_base_addr(url: &reqwest::Url) -> Option<SocketAddr> {
    let host = url.host_str()?;
    let port = url.port_or_known_default().unwrap_or(80);

    let ip_host = host.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = ip_host.parse::<IpAddr>() {
        return Some(SocketAddr::new(ip, port));
    }

    if host.trim_end_matches('.').eq_ignore_ascii_case("localhost") {
        return Some(SocketAddr::new(Ipv4Addr::LOCALHOST.into(), port));
    }

    None
}

impl GReaderProvider {
    /// Create a provider configured for FreshRSS.
    pub fn for_freshrss(server_url: &str) -> Self {
        let base = freshrss_api_base(server_url);
        let http_client = Self::build_http_client(&base);
        Self {
            kind: ProviderKind::FreshRss,
            api_base: base.clone(),
            auth_base: base,
            http_client,
            auth_token: None,
        }
    }

    pub fn try_for_freshrss(server_url: &str) -> DomainResult<Self> {
        let base = freshrss_api_base(server_url);
        Ok(Self {
            kind: ProviderKind::FreshRss,
            api_base: base.clone(),
            auth_base: base.clone(),
            http_client: Ok(Self::build_http_client(&base)?),
            auth_token: None,
        })
    }

    pub(super) fn build_http_client(base: &str) -> DomainResult<reqwest::Client> {
        let base_url = reqwest::Url::parse(base).map_err(|_| {
            DomainError::Validation(
                crate::domain::url_policy::UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
            )
        })?;
        let explicit_base_addr = explicit_greader_base_addr(&base_url);
        let resolved_addresses = resolve_greader_base_addrs(&base_url)?;
        let base_host = base_url.host_str();
        let base_host_is_private = base_host.is_some_and(is_private_host);
        let initial_private_host = base_host
            .filter(|_| base_host_is_private)
            .map(ToOwned::to_owned);
        let resolver = validated_public_dns_resolver();
        if let Some(host) = base_host.filter(|_| explicit_base_addr.is_none()) {
            if base_host_is_private {
                resolver.seed_user_selected(host, resolved_addresses.clone())?;
            } else {
                resolver.seed(host, resolved_addresses.clone())?;
            }
        }

        let mut builder = http_client_builder()
            .dns_resolver(Arc::new(resolver))
            .redirect(
                http_defaults::provider_redirect_policy_for_initial_private_host(
                    initial_private_host,
                    validate_discovery_url,
                ),
            );
        if let Some(host) = base_host {
            if !resolved_addresses.is_empty() {
                builder = builder.resolve_to_addrs(host, &resolved_addresses);
            }
        }

        http_defaults::build_http_client(builder)
    }

    #[cfg(test)]
    pub(super) fn build_test_http_client_allowing_private_urls() -> DomainResult<reqwest::Client> {
        http_defaults::build_http_client(http_client_builder().redirect(
            http_defaults::provider_redirect_policy(true, validate_discovery_url),
        ))
    }

    #[cfg(test)]
    pub(super) fn validate_redirect(
        previous_urls: &[reqwest::Url],
        next_url: &reqwest::Url,
    ) -> DomainResult<()> {
        http_defaults::validate_provider_redirect(previous_urls, next_url, validate_discovery_url)
    }

    #[cfg(test)]
    pub(super) fn validate_redirect_for_initial_private_host(
        previous_urls: &[reqwest::Url],
        next_url: &reqwest::Url,
        initial_private_host: &str,
    ) -> DomainResult<()> {
        http_defaults::validate_provider_redirect_attempt_for_initial_private_host(
            previous_urls,
            next_url,
            Some(initial_private_host),
            validate_discovery_url,
        )
    }

    pub(super) fn http_client(&self) -> DomainResult<&reqwest::Client> {
        self.http_client.as_ref().map_err(|error| error.clone())
    }

    pub(super) fn api_url(&self, path: &str) -> String {
        format!("{}{}", self.api_base, path)
    }

    pub(super) fn auth_url(&self, path: &str) -> String {
        format!("{}{}", self.auth_base, path)
    }

    pub(super) fn auth_header(&self) -> DomainResult<HeaderValue> {
        let token = self
            .auth_token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Not authenticated".into()))?;
        HeaderValue::from_str(&format!("GoogleLogin auth={token}"))
            .map_err(|e| DomainError::Auth(e.to_string()))
    }

    pub(super) fn ensure_success_response(
        response: reqwest::Response,
    ) -> DomainResult<reqwest::Response> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }

        Err(DomainError::from_provider_http_response_status(
            status,
            response.headers(),
        ))
    }

    pub(super) async fn read_json_response<T>(response: reqwest::Response) -> DomainResult<T>
    where
        T: DeserializeOwned,
    {
        http_defaults::response_json_with_decoded_cap(
            response,
            http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES,
            greader_json_body_too_large_error,
            DomainError::from_provider_http_error,
        )
        .await
    }

    pub(super) async fn authenticate_with_client_login(
        &mut self,
        credentials: &ProviderCredentials,
    ) -> DomainResult<()> {
        let password = credentials
            .password
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Password is required".into()))?;

        // The Email/username field is stored in token
        let username = credentials
            .token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Username is required".into()))?;

        let url = self.auth_url("/accounts/ClientLogin");
        let body = format!(
            "Email={}&Passwd={}",
            urlencoded(username),
            urlencoded(password)
        );

        let response = self
            .http_client()?
            .post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)?;

        let status = response.status();
        if !status.is_success() {
            return Err(DomainError::from_provider_http_response_status(
                status,
                response.headers(),
            ));
        }

        let text = response.text().await?;
        let auth_token = text
            .lines()
            .find_map(|line| line.strip_prefix("Auth="))
            .map(|s| s.to_string())
            .ok_or_else(|| DomainError::Auth("Auth token not found in response".into()))?;

        self.auth_token = Some(auth_token);
        Ok(())
    }

    pub(super) async fn push_mutations_impl(&self, mutations: &[Mutation]) -> DomainResult<()> {
        let url = self.api_url("/reader/api/0/edit-tag");
        let auth = self.auth_header()?;

        for mutation in mutations {
            let body = match mutation {
                Mutation::MarkRead { remote_entry_id } => {
                    format!(
                        "i={}&a={}",
                        urlencoded(remote_entry_id),
                        urlencoded(STATE_READ)
                    )
                }
                Mutation::MarkUnread { remote_entry_id } => {
                    format!(
                        "i={}&r={}",
                        urlencoded(remote_entry_id),
                        urlencoded(STATE_READ)
                    )
                }
                Mutation::SetStarred {
                    remote_entry_id,
                    starred,
                } => {
                    let action = if *starred { "a" } else { "r" };
                    format!(
                        "i={}&{}={}",
                        urlencoded(remote_entry_id),
                        action,
                        urlencoded(STATE_STARRED)
                    )
                }
            };

            self.http_client()?
                .post(&url)
                .header("Authorization", auth.clone())
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(body)
                .send()
                .await
                .map_err(http_defaults::map_provider_request_error)
                .and_then(Self::ensure_success_response)?;
        }

        Ok(())
    }

    pub(super) async fn delete_subscription_impl(&self, id: &FeedIdentifier) -> DomainResult<()> {
        let remote_id = match id {
            FeedIdentifier::Remote { remote_id } => remote_id,
            FeedIdentifier::Local { .. } => {
                return Err(DomainError::Validation(
                    "GReaderProvider does not support local feed identifiers".into(),
                ));
            }
        };

        let url = self.api_url("/reader/api/0/subscription/edit");
        let auth = self.auth_header()?;
        let body = format!("ac=unsubscribe&s={}", urlencoded(remote_id));

        self.http_client()?
            .post(&url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
            .and_then(Self::ensure_success_response)?;

        Ok(())
    }

    pub(super) async fn edit_subscription_impl(
        &self,
        remote_id: &str,
        title: Option<&str>,
        add_folder_label: Option<&str>,
        remove_folder_label: Option<&str>,
    ) -> DomainResult<()> {
        if title.is_none() && add_folder_label.is_none() && remove_folder_label.is_none() {
            return Ok(());
        }

        let url = self.api_url("/reader/api/0/subscription/edit");
        let auth = self.auth_header()?;
        let mut body = format!("ac=edit&s={}", urlencoded(remote_id));
        if let Some(title) = title {
            body.push_str(&format!("&t={}", urlencoded(title)));
        }
        if let Some(folder_name) = add_folder_label {
            body.push_str(&format!(
                "&a={}{}",
                urlencoded(LABEL_PREFIX),
                urlencoded(folder_name)
            ));
        }
        if let Some(folder_name) = remove_folder_label {
            body.push_str(&format!(
                "&r={}{}",
                urlencoded(LABEL_PREFIX),
                urlencoded(folder_name)
            ));
        }

        self.http_client()?
            .post(&url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
            .and_then(Self::ensure_success_response)?;

        Ok(())
    }
}
