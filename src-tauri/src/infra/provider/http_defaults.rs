use std::collections::HashMap;
use std::error::Error as StdError;
use std::fmt;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::url_policy::{is_private_ip, PRIVATE_URL_VALIDATION_MESSAGE};
use reqwest::header::{HeaderMap, HeaderValue, CACHE_CONTROL, PRAGMA};
use serde::de::DeserializeOwned;

pub const PROVIDER_HTTP_TIMEOUT: Duration = Duration::from_secs(15);
pub const PROVIDER_USER_AGENT: &str = "UltraRSSReader/0.1";
pub const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str = "HTTPS to HTTP redirects are not allowed";
pub const PROVIDER_MAX_REDIRECT_HOPS: usize = 5;
pub const PROVIDER_RESPONSE_BODY_CAP_BYTES: u64 = 5 * 1024 * 1024;
pub const DISCOVERY_RESPONSE_BODY_CAP_BYTES: u64 = 2 * 1024 * 1024;
pub const PROVIDER_CACHE_CONTROL: &str = "no-store";
pub const PROVIDER_PRAGMA: &str = "no-cache";

/// Keeps a redirect validation failure typed while reqwest wraps it in its own
/// redirect error. The source chain is the stable boundary used by
/// `map_provider_request_error`; the reqwest Display implementation is not.
#[derive(Debug)]
pub(crate) struct ProviderRedirectError(DomainError);

impl ProviderRedirectError {
    fn new(error: DomainError) -> Self {
        Self(error)
    }
}

impl fmt::Display for ProviderRedirectError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

impl StdError for ProviderRedirectError {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        Some(&self.0)
    }
}

type HostResolver = Arc<dyn Fn(&str) -> DomainResult<Vec<SocketAddr>> + Send + Sync>;

/// DNS resolver that validates every returned address and reuses the exact
/// result for the subsequent connection. Seeded entries are used for the
/// initial request; redirect hosts are resolved once and cached on demand.
#[derive(Clone)]
pub(crate) struct ValidatedPublicDnsResolver {
    host_resolver: HostResolver,
    resolved_hosts: Arc<Mutex<HashMap<String, DomainResult<Vec<SocketAddr>>>>>,
}

impl ValidatedPublicDnsResolver {
    pub(crate) fn new(
        host_resolver: impl Fn(&str) -> DomainResult<Vec<SocketAddr>> + Send + Sync + 'static,
    ) -> Self {
        Self {
            host_resolver: Arc::new(host_resolver),
            resolved_hosts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub(crate) fn seed(&self, host: &str, addresses: Vec<SocketAddr>) -> DomainResult<()> {
        let addresses = normalize_dns_socket_addrs(addresses);
        validate_public_socket_addrs(&addresses)?;
        let mut resolved_hosts = self
            .resolved_hosts
            .lock()
            .map_err(|_| DomainError::Network("DNS resolver cache is poisoned".to_string()))?;
        resolved_hosts.insert(normalize_dns_host(host), Ok(addresses));
        Ok(())
    }

    #[cfg(test)]
    pub(crate) fn seed_for_test(&self, host: &str, addresses: Vec<SocketAddr>) -> DomainResult<()> {
        let mut resolved_hosts = self
            .resolved_hosts
            .lock()
            .map_err(|_| DomainError::Network("DNS resolver cache is poisoned".to_string()))?;
        resolved_hosts.insert(normalize_dns_host(host), Ok(addresses));
        Ok(())
    }

    fn resolve_cached(&self, host: &str) -> DomainResult<Vec<SocketAddr>> {
        let normalized_host = normalize_dns_host(host);
        if let Some(result) = self
            .resolved_hosts
            .lock()
            .map_err(|_| DomainError::Network("DNS resolver cache is poisoned".to_string()))?
            .get(&normalized_host)
            .cloned()
        {
            return result;
        }

        let result = (self.host_resolver)(&normalized_host).and_then(|addresses| {
            let addresses = normalize_dns_socket_addrs(addresses);
            validate_public_socket_addrs(&addresses).map(|()| addresses)
        });
        let mut resolved_hosts = self
            .resolved_hosts
            .lock()
            .map_err(|_| DomainError::Network("DNS resolver cache is poisoned".to_string()))?;
        resolved_hosts.insert(normalized_host, result.clone());
        result
    }
}

impl reqwest::dns::Resolve for ValidatedPublicDnsResolver {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let resolver = self.clone();
        let host = name.as_str().to_string();
        Box::pin(async move {
            let addresses = tokio::task::spawn_blocking(move || resolver.resolve_cached(&host))
                .await
                .map_err(|error| {
                    Box::new(DomainError::Network(error.to_string()))
                        as Box<dyn StdError + Send + Sync>
                })??;
            Ok(Box::new(addresses.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

fn normalize_dns_host(host: &str) -> String {
    host.trim_end_matches('.').to_ascii_lowercase()
}

fn normalize_dns_socket_addrs(addresses: Vec<SocketAddr>) -> Vec<SocketAddr> {
    addresses
        .into_iter()
        .map(|address| SocketAddr::new(address.ip(), 0))
        .collect()
}

fn validate_public_socket_addrs(addresses: &[SocketAddr]) -> DomainResult<()> {
    if addresses.iter().any(|address| is_private_ip(address.ip())) {
        return Err(DomainError::Validation(
            PRIVATE_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }
    Ok(())
}

pub fn http_client_builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
        .timeout(PROVIDER_HTTP_TIMEOUT)
        .user_agent(PROVIDER_USER_AGENT)
        .default_headers(provider_no_store_headers())
        .no_proxy()
}

pub(crate) fn build_http_client(builder: reqwest::ClientBuilder) -> DomainResult<reqwest::Client> {
    builder
        .build()
        .map_err(DomainError::from_provider_http_error)
}

pub(crate) fn provider_redirect_policy(
    allow_private_urls: bool,
    validate_url: fn(&reqwest::Url) -> DomainResult<()>,
) -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(move |attempt| {
        match validate_provider_redirect_attempt(
            attempt.previous(),
            attempt.url(),
            allow_private_urls,
            validate_url,
        ) {
            Ok(()) => attempt.follow(),
            Err(error) => attempt.error(ProviderRedirectError::new(error)),
        }
    })
}

pub(crate) fn validate_provider_redirect_attempt(
    previous_urls: &[reqwest::Url],
    next_url: &reqwest::Url,
    allow_private_urls: bool,
    validate_url: fn(&reqwest::Url) -> DomainResult<()>,
) -> DomainResult<()> {
    if previous_urls.len() > PROVIDER_MAX_REDIRECT_HOPS {
        return Err(DomainError::Network("too many redirects".to_string()));
    }

    if allow_private_urls {
        return Ok(());
    }

    validate_provider_redirect(previous_urls, next_url, validate_url)
}

pub(crate) fn validate_provider_redirect(
    previous_urls: &[reqwest::Url],
    next_url: &reqwest::Url,
    validate_url: fn(&reqwest::Url) -> DomainResult<()>,
) -> DomainResult<()> {
    validate_url(next_url)?;

    if previous_urls
        .last()
        .is_some_and(|previous| previous.scheme() == "https" && next_url.scheme() == "http")
    {
        return Err(DomainError::Validation(
            DOWNGRADE_REDIRECT_VALIDATION_MESSAGE.to_string(),
        ));
    }

    Ok(())
}

pub(crate) fn map_provider_request_error(error: reqwest::Error) -> DomainError {
    let mut source = error.source();
    while let Some(current) = source {
        if let Some(redirect_error) = current.downcast_ref::<ProviderRedirectError>() {
            return redirect_error.0.clone();
        }
        if let Some(domain_error) = current.downcast_ref::<DomainError>() {
            return domain_error.clone();
        }
        source = current.source();
    }

    DomainError::from_provider_http_error(error)
}

fn provider_no_store_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        CACHE_CONTROL,
        HeaderValue::from_static(PROVIDER_CACHE_CONTROL),
    );
    headers.insert(PRAGMA, HeaderValue::from_static(PROVIDER_PRAGMA));
    headers
}

pub async fn response_bytes_with_decoded_cap(
    mut response: reqwest::Response,
    cap_bytes: u64,
    too_large_error: impl Fn() -> DomainError,
    read_error: impl Fn(reqwest::Error) -> DomainError,
) -> DomainResult<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|length| length > cap_bytes)
    {
        return Err(too_large_error());
    }

    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(&read_error)? {
        body.extend_from_slice(&chunk);
        if body.len() as u64 > cap_bytes {
            return Err(too_large_error());
        }
    }

    Ok(body)
}

pub async fn response_json_with_decoded_cap<T>(
    response: reqwest::Response,
    cap_bytes: u64,
    too_large_error: impl Fn() -> DomainError,
    read_error: impl Fn(reqwest::Error) -> DomainError,
) -> DomainResult<T>
where
    T: DeserializeOwned,
{
    let body =
        response_bytes_with_decoded_cap(response, cap_bytes, too_large_error, read_error).await?;
    serde_json::from_slice(&body).map_err(|error| DomainError::Parse(error.to_string()))
}

#[cfg(test)]
mod tests;
