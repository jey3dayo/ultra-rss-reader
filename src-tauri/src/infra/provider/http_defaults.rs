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
mod tests {
    use super::{
        build_http_client, http_client_builder, validate_provider_redirect,
        validate_provider_redirect_attempt, ValidatedPublicDnsResolver,
        DOWNGRADE_REDIRECT_VALIDATION_MESSAGE, PROVIDER_CACHE_CONTROL, PROVIDER_PRAGMA,
        PROVIDER_USER_AGENT,
    };
    use crate::domain::error::DomainError;
    use reqwest::dns::Resolve;
    use reqwest::header::{CACHE_CONTROL, PRAGMA, REFERER, USER_AGENT};
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpListener};
    use std::str::FromStr;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    static PROXY_ENV_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
        std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

    #[test]
    fn provider_http_client_build_failure_is_returned_as_domain_error() {
        let result = build_http_client(reqwest::Client::builder().user_agent("\n"));

        assert!(matches!(
            result,
            Err(DomainError::Network(message)) if !message.is_empty()
        ));
    }

    #[tokio::test]
    async fn validated_dns_resolver_rejects_private_addresses_before_connecting() {
        let resolver = ValidatedPublicDnsResolver::new(|host| {
            if host == "rebinding.test.invalid" {
                return Ok(vec![SocketAddr::from(([127, 0, 0, 1], 80))]);
            }
            Ok(vec![SocketAddr::from(([93, 184, 216, 34], 0))])
        });
        let name = reqwest::dns::Name::from_str("rebinding.test.invalid")
            .expect("resolver fixture host should parse");

        let error = match resolver.resolve(name).await {
            Ok(_) => panic!("private resolver result must not reach the connector"),
            Err(error) => error,
        };

        assert_eq!(
            error
                .downcast_ref::<DomainError>()
                .expect("resolver should preserve the typed domain error")
                .to_string(),
            "Validation error: Requests to private/loopback addresses are not allowed"
        );
    }

    #[tokio::test]
    async fn validated_dns_resolver_reuses_seeded_result_for_initial_host() {
        let resolver = ValidatedPublicDnsResolver::new(|_| {
            Err(DomainError::Network(
                "unexpected second DNS resolution".to_string(),
            ))
        });
        resolver
            .seed(
                "public.example.test.",
                vec![SocketAddr::from(([93, 184, 216, 34], 8080))],
            )
            .expect("public fixture address should be accepted");
        let name = reqwest::dns::Name::from_str("public.example.test")
            .expect("resolver fixture host should parse");

        let addresses = resolver
            .resolve(name)
            .await
            .expect("seeded address should be reused")
            .collect::<Vec<_>>();

        assert_eq!(addresses, vec![SocketAddr::from(([93, 184, 216, 34], 0))]);
    }

    #[tokio::test]
    async fn validated_dns_resolver_closes_public_to_private_rebinding_window() {
        let calls = Arc::new(AtomicUsize::new(0));
        let resolver_calls = Arc::clone(&calls);
        let resolver = ValidatedPublicDnsResolver::new(move |_| {
            if resolver_calls.fetch_add(1, Ordering::SeqCst) == 0 {
                return Ok(vec![SocketAddr::from(([93, 184, 216, 34], 0))]);
            }
            Ok(vec![SocketAddr::from(([127, 0, 0, 1], 0))])
        });

        let first_name = reqwest::dns::Name::from_str("rebind.example.test")
            .expect("resolver fixture host should parse");
        let first_addresses = resolver
            .resolve(first_name)
            .await
            .expect("the first public DNS result should be accepted")
            .collect::<Vec<_>>();
        let second_name = reqwest::dns::Name::from_str("rebind.example.test")
            .expect("resolver fixture host should parse");
        let second_addresses = resolver
            .resolve(second_name)
            .await
            .expect("the cached result should be used for the connection")
            .collect::<Vec<_>>();

        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(first_addresses, second_addresses);
        assert!(second_addresses
            .iter()
            .all(|address| !crate::domain::url_policy::is_private_ip(address.ip())));
    }

    #[test]
    fn shared_redirect_validation_rejects_https_to_http_downgrade() {
        let previous =
            [reqwest::Url::parse("https://example.com/feed.xml")
                .expect("fixture URL should parse")];
        let next =
            reqwest::Url::parse("http://example.com/feed.xml").expect("fixture URL should parse");

        let result = validate_provider_redirect(&previous, &next, |_| Ok(()));

        assert!(matches!(
            result,
            Err(DomainError::Validation(message))
                if message == DOWNGRADE_REDIRECT_VALIDATION_MESSAGE
        ));
    }

    #[test]
    fn shared_redirect_policy_rejects_the_sixth_redirect_hop() {
        let previous = vec![
            reqwest::Url::parse("https://example.com/feed.xml")
                .expect("fixture URL should parse");
            6
        ];
        let next =
            reqwest::Url::parse("https://example.com/feed.xml").expect("fixture URL should parse");

        let result = validate_provider_redirect_attempt(&previous, &next, false, |_| Ok(()));

        assert!(matches!(
            result,
            Err(DomainError::Network(message)) if message == "too many redirects"
        ));
    }

    #[tokio::test]
    async fn provider_http_client_ignores_proxy_environment_variables() {
        let _guard = PROXY_ENV_LOCK
            .lock()
            .expect("proxy env lock should not be poisoned");
        let previous_http_proxy = std::env::var("HTTP_PROXY").ok();
        let previous_https_proxy = std::env::var("HTTPS_PROXY").ok();
        let previous_all_proxy = std::env::var("ALL_PROXY").ok();
        let previous_no_proxy = std::env::var("NO_PROXY").ok();
        std::env::set_var("HTTP_PROXY", "http://127.0.0.1:9");
        std::env::set_var("HTTPS_PROXY", "http://127.0.0.1:9");
        std::env::set_var("ALL_PROXY", "http://127.0.0.1:9");
        std::env::remove_var("NO_PROXY");

        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("client should connect directly");
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            stream
                .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
                .expect("test server should write response");
        });

        let response = http_client_builder()
            .build()
            .expect("provider client should build")
            .get(format!("http://{address}/probe"))
            .send()
            .await
            .expect("provider client should bypass proxy env at HTTP boundary");

        assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        server.join().expect("test server should finish");

        restore_env_var("HTTP_PROXY", previous_http_proxy);
        restore_env_var("HTTPS_PROXY", previous_https_proxy);
        restore_env_var("ALL_PROXY", previous_all_proxy);
        restore_env_var("NO_PROXY", previous_no_proxy);
    }

    #[tokio::test]
    async fn provider_http_client_sends_no_store_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("client should connect");
            let mut request = [0_u8; 2048];
            let bytes_read = stream.read(&mut request).unwrap_or(0);
            let request = String::from_utf8_lossy(&request[..bytes_read]);
            assert!(request.contains("cache-control: no-store"));
            assert!(request.contains("pragma: no-cache"));
            stream
                .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
                .expect("test server should write response");
        });

        let response = http_client_builder()
            .build()
            .expect("provider client should build")
            .get(format!("http://{address}/probe"))
            .send()
            .await
            .expect("provider client should send no-store headers");

        assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        server.join().expect("test server should finish");
    }

    #[tokio::test]
    async fn provider_http_client_fixes_privacy_preserving_metadata_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("client should connect");
            let mut request = [0_u8; 2048];
            let bytes_read = stream.read(&mut request).unwrap_or(0);
            let request = String::from_utf8_lossy(&request[..bytes_read]);
            let request_lower = request.to_ascii_lowercase();
            assert!(request_lower.contains(&format!(
                "{}: {}",
                USER_AGENT.as_str(),
                PROVIDER_USER_AGENT.to_ascii_lowercase()
            )));
            assert!(request_lower.contains(&format!(
                "{}: {}",
                CACHE_CONTROL.as_str(),
                PROVIDER_CACHE_CONTROL
            )));
            assert!(request_lower.contains(&format!("{}: {}", PRAGMA.as_str(), PROVIDER_PRAGMA)));
            assert!(!request_lower.contains(&format!("{}:", REFERER.as_str())));
            stream
                .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
                .expect("test server should write response");
        });

        let response = http_client_builder()
            .build()
            .expect("provider client should build")
            .get(format!("http://{address}/favicon.ico"))
            .send()
            .await
            .expect("provider metadata client should send fixed privacy headers");

        assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        server.join().expect("test server should finish");
    }

    #[tokio::test]
    async fn provider_http_client_does_not_persist_response_cookies() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut first_stream, _) = listener.accept().expect("first request should connect");
            let mut first_request = [0_u8; 2048];
            let _ = first_stream.read(&mut first_request);
            first_stream
                .write_all(
                    b"HTTP/1.1 204 No Content\r\nSet-Cookie: provider_session=secret; Path=/\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
                )
                .expect("test server should write first response");

            let (mut second_stream, _) = listener.accept().expect("second request should connect");
            let mut second_request = [0_u8; 2048];
            let bytes_read = second_stream.read(&mut second_request).unwrap_or(0);
            let request = String::from_utf8_lossy(&second_request[..bytes_read]);
            assert!(!request.to_ascii_lowercase().contains("cookie:"));
            assert!(!request.contains("provider_session=secret"));
            second_stream
                .write_all(
                    b"HTTP/1.1 204 No Content\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
                )
                .expect("test server should write second response");
        });

        let client = http_client_builder()
            .build()
            .expect("provider client should build");
        for path in ["first", "second"] {
            let response = client
                .get(format!("http://{address}/{path}"))
                .send()
                .await
                .expect("provider client should not require cookie storage");
            assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        }
        server.join().expect("test server should finish");
    }

    fn restore_env_var(key: &str, value: Option<String>) {
        match value {
            Some(value) => std::env::set_var(key, value),
            None => std::env::remove_var(key),
        }
    }
}
