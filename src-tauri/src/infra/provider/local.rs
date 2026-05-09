use async_trait::async_trait;
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use reqwest::StatusCode;
use std::net::{IpAddr, ToSocketAddrs};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

use super::http_defaults::http_client_builder;
use super::normalizer;
use super::traits::{Credentials, FeedProvider};

const MAX_LOCAL_FEED_BODY_BYTES: u64 = 5 * 1024 * 1024;
const PRIVATE_URL_VALIDATION_MESSAGE: &str =
    "Requests to private/loopback addresses are not allowed";
const UNSUPPORTED_URL_VALIDATION_MESSAGE: &str = "Only http:// and https:// URLs are supported";
const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str = "HTTPS to HTTP redirects are not allowed";

pub struct LocalProvider {
    http_client: reqwest::Client,
    allow_private_feed_urls: bool,
}

impl Default for LocalProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalProvider {
    pub fn new() -> Self {
        Self::with_private_feed_url_policy(false)
    }

    fn with_private_feed_url_policy(allow_private_feed_urls: bool) -> Self {
        Self {
            http_client: Self::build_http_client(allow_private_feed_urls),
            allow_private_feed_urls,
        }
    }

    #[doc(hidden)]
    pub fn new_allowing_private_feed_urls_for_tests() -> Self {
        Self::with_private_feed_url_policy(true)
    }

    fn build_http_client(allow_private_feed_urls: bool) -> reqwest::Client {
        http_client_builder()
            .redirect(Self::redirect_policy(allow_private_feed_urls))
            .build()
            .unwrap_or_default()
    }

    fn redirect_policy(allow_private_feed_urls: bool) -> reqwest::redirect::Policy {
        reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() > 5 {
                return attempt.error("too many redirects");
            }

            if allow_private_feed_urls {
                return attempt.follow();
            }

            match validate_external_feed_redirect(attempt.previous(), attempt.url()) {
                Ok(()) => attempt.follow(),
                Err(error) => attempt.error(error.to_string()),
            }
        })
    }

    fn validate_feed_url(&self, feed_url: &str) -> DomainResult<reqwest::Url> {
        let url = reqwest::Url::parse(feed_url)
            .map_err(|_| DomainError::Validation(UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string()))?;

        if !self.allow_private_feed_urls {
            validate_external_feed_url(&url)?;
        }

        Ok(url)
    }

    fn header_value_to_string(
        headers: &reqwest::header::HeaderMap,
        name: reqwest::header::HeaderName,
    ) -> Option<String> {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(ToString::to_string)
    }

    fn select_feed_site_url(feed: &feed_rs::model::Feed, fallback_url: &str) -> String {
        feed.links
            .iter()
            .find(|link| {
                let rel = link.rel.as_deref().unwrap_or("alternate");
                let media_type = link.media_type.as_deref().unwrap_or("text/html");
                !link.href.trim().is_empty()
                    && rel.eq_ignore_ascii_case("alternate")
                    && media_type.eq_ignore_ascii_case("text/html")
            })
            .or_else(|| feed.links.iter().find(|link| !link.href.trim().is_empty()))
            .map(|link| link.href.clone())
            .unwrap_or_else(|| fallback_url.to_string())
    }

    async fn response_bytes_with_limit(mut response: reqwest::Response) -> DomainResult<Vec<u8>> {
        validate_feed_response_content_type(response.headers())?;

        if response
            .content_length()
            .is_some_and(|length| length > MAX_LOCAL_FEED_BODY_BYTES)
        {
            return Err(feed_body_too_large_error());
        }

        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            body.extend_from_slice(&chunk);
            if body.len() as u64 > MAX_LOCAL_FEED_BODY_BYTES {
                return Err(feed_body_too_large_error());
            }
        }

        Ok(body)
    }
}

fn feed_body_too_large_error() -> DomainError {
    DomainError::Network(format!(
        "Feed response body exceeds {MAX_LOCAL_FEED_BODY_BYTES} bytes"
    ))
}

fn unsupported_feed_content_type_error(content_type: &str) -> DomainError {
    DomainError::Network(format!(
        "Unsupported feed response content type: {content_type}"
    ))
}

fn validate_external_feed_url(url: &reqwest::Url) -> DomainResult<()> {
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(DomainError::Validation(
            UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }

    if url.host_str().is_some_and(is_private_host) {
        return Err(DomainError::Validation(
            PRIVATE_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }

    validate_resolved_host_is_public(url)?;

    Ok(())
}

fn validate_resolved_host_is_public(url: &reqwest::Url) -> DomainResult<()> {
    let Some(host) = url.host_str() else {
        return Ok(());
    };
    if host.parse::<IpAddr>().is_ok() {
        return Ok(());
    }
    let port = url.port_or_known_default().unwrap_or(80);
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|error| DomainError::Network(error.to_string()))?;

    for address in addresses {
        if is_private_ip(address.ip()) {
            return Err(DomainError::Validation(
                PRIVATE_URL_VALIDATION_MESSAGE.to_string(),
            ));
        }
    }

    Ok(())
}

fn validate_external_feed_redirect(
    previous_urls: &[reqwest::Url],
    next_url: &reqwest::Url,
) -> DomainResult<()> {
    validate_external_feed_url(next_url)?;

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

fn is_supported_feed_response_content_type(content_type: Option<&str>) -> bool {
    let Some(content_type) = content_type else {
        return true;
    };
    let media_type = content_type
        .split(';')
        .next()
        .unwrap_or(content_type)
        .trim()
        .to_ascii_lowercase();

    matches!(
        media_type.as_str(),
        "application/rss+xml"
            | "application/atom+xml"
            | "application/feed+json"
            | "application/xml"
            | "text/xml"
            | "text/html"
    )
}

fn validate_feed_response_content_type(headers: &reqwest::header::HeaderMap) -> DomainResult<()> {
    let content_type = headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());

    if !is_supported_feed_response_content_type(content_type) {
        return Err(unsupported_feed_content_type_error(
            content_type.unwrap_or("<invalid>"),
        ));
    }

    Ok(())
}

fn is_private_host(host: &str) -> bool {
    let host_lower = host.to_lowercase();

    if host_lower == "localhost" {
        return true;
    }

    let ip_str = host_lower.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = ip_str.parse::<IpAddr>() {
        return is_private_ip(ip);
    }

    false
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback() || v4.is_private() || v4.is_unspecified() || v4.is_link_local()
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || (v6.segments()[0] & 0xfe00) == 0xfc00
                || (v6.segments()[0] & 0xffc0) == 0xfe80
        }
    }
}

fn map_local_provider_request_error(error: reqwest::Error) -> DomainError {
    let message = error.to_string();
    if message.contains(PRIVATE_URL_VALIDATION_MESSAGE) {
        return DomainError::Validation(PRIVATE_URL_VALIDATION_MESSAGE.to_string());
    }
    if message.contains(UNSUPPORTED_URL_VALIDATION_MESSAGE) {
        return DomainError::Validation(UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string());
    }
    if message.contains(DOWNGRADE_REDIRECT_VALIDATION_MESSAGE) {
        return DomainError::Validation(DOWNGRADE_REDIRECT_VALIDATION_MESSAGE.to_string());
    }

    DomainError::from(error)
}

#[async_trait]
impl FeedProvider for LocalProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Local
    }

    fn capabilities(&self) -> ProviderCapabilities {
        self.kind().capabilities()
    }

    async fn authenticate(&mut self, _: &Credentials) -> DomainResult<()> {
        Ok(())
    }

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        Ok(vec![])
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        Ok(vec![])
    }

    async fn pull_entries(
        &self,
        scope: PullScope,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        let feed_url = match &scope {
            PullScope::Feed(FeedIdentifier::Local { feed_url }) => feed_url.clone(),
            _ => {
                return Err(DomainError::Validation(
                    "LocalProvider only supports PullScope::Feed(Local)".into(),
                ))
            }
        };

        let feed_url = self.validate_feed_url(&feed_url)?;
        let mut request = self.http_client.get(feed_url.clone());
        if let Some(current) = cursor.as_ref() {
            if let Some(etag) = current.etag.as_deref() {
                request = request.header(IF_NONE_MATCH, etag);
            }
            if let Some(last_modified) = current.last_modified.as_deref() {
                request = request.header(IF_MODIFIED_SINCE, last_modified);
            }
        }

        let response = request
            .send()
            .await
            .map_err(map_local_provider_request_error)?;
        let status = response.status();
        let response_etag = Self::header_value_to_string(response.headers(), ETAG);
        let response_last_modified =
            Self::header_value_to_string(response.headers(), LAST_MODIFIED);
        let next_cursor = Some(SyncCursor {
            continuation: None,
            since: None,
            etag: response_etag.clone().or_else(|| {
                (status == StatusCode::NOT_MODIFIED)
                    .then(|| cursor.as_ref().and_then(|current| current.etag.clone()))
                    .flatten()
            }),
            last_modified: response_last_modified.clone().or_else(|| {
                (status == StatusCode::NOT_MODIFIED)
                    .then(|| {
                        cursor
                            .as_ref()
                            .and_then(|current| current.last_modified.clone())
                    })
                    .flatten()
            }),
        });

        if status == StatusCode::NOT_MODIFIED {
            return Ok(PullResult {
                entries: vec![],
                next_cursor,
                has_more: false,
                not_modified: true,
                skipped_entries: 0,
            });
        }

        if !status.is_success() {
            return Err(DomainError::from_provider_http_status(status));
        }

        let bytes = Self::response_bytes_with_limit(response).await?;
        let entries = normalizer::normalize_feed(&bytes, feed_url.as_str())?;

        Ok(PullResult {
            entries,
            next_cursor,
            has_more: false,
            not_modified: false,
            skipped_entries: 0,
        })
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        Ok(RemoteState::default())
    }

    async fn push_mutations(&self, _: &[Mutation]) -> DomainResult<()> {
        Ok(())
    }

    async fn create_subscription(
        &self,
        url: &str,
        _folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        // For local feeds, just validate the URL by fetching and parsing
        let url = self.validate_feed_url(url)?;
        let response = self
            .http_client
            .get(url.clone())
            .send()
            .await
            .map_err(map_local_provider_request_error)?
            .error_for_status()
            .map_err(DomainError::from_provider_http_error)?;
        let bytes = Self::response_bytes_with_limit(response).await?;
        let feed =
            feed_rs::parser::parse(&bytes[..]).map_err(|e| DomainError::Parse(e.to_string()))?;

        Ok(RemoteSubscription {
            remote_id: url.to_string(),
            title: feed
                .title
                .as_ref()
                .map(|t| t.content.clone())
                .unwrap_or_else(|| url.to_string()),
            url: url.to_string(),
            site_url: normalizer::normalize_provider_metadata_url(&Self::select_feed_site_url(
                &feed,
                url.as_str(),
            ))
            .unwrap_or_else(|| url.to_string()),
            folder_remote_id: None,
            icon_url: feed
                .icon
                .and_then(|icon| normalizer::normalize_provider_metadata_url(&icon.uri)),
        })
    }

    async fn delete_subscription(&self, _: &FeedIdentifier) -> DomainResult<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::http_defaults::PROVIDER_USER_AGENT;
    use super::*;
    use chrono::Utc;

    const SAMPLE_RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Mock Feed</title>
        <item>
            <title>Article 1</title>
            <link>https://example.com/1</link>
            <guid>guid-1</guid>
        </item>
    </channel>
    </rss>"#;

    fn local_provider_allowing_private_feed_urls() -> LocalProvider {
        LocalProvider::new_allowing_private_feed_urls_for_tests()
    }

    #[tokio::test]
    async fn pull_entries_fetches_and_parses() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("user-agent", PROVIDER_USER_AGENT)
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/feed.xml", server.url()),
        });

        let result = provider.pull_entries(scope, None).await.unwrap();
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].title, "Article 1");
        assert!(!result.not_modified);
        assert!(!result.has_more);
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_parses_json_feed_body() {
        let json_feed = r#"{
            "version": "https://jsonfeed.org/version/1.1",
            "title": "JSON Feed",
            "home_page_url": "https://example.com",
            "feed_url": "https://example.com/feed.json",
            "items": [
                {
                    "id": "json-1",
                    "url": "https://example.com/json-1",
                    "title": "JSON Article",
                    "content_html": "<p>JSON body</p>",
                    "date_published": "2026-03-27T12:00:00Z"
                }
            ]
        }"#;
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/feed.json")
            .with_body(json_feed)
            .with_header("content-type", "application/feed+json")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let feed_url = format!("{}/feed.json", server.url());
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: feed_url.clone(),
        });

        let result = provider.pull_entries(scope, None).await.unwrap();

        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].id.as_deref(), Some("json-1"));
        assert_eq!(result.entries[0].title, "JSON Article");
        assert_eq!(result.entries[0].content, "<p>JSON body</p>");
        match &result.entries[0].source_feed_id {
            FeedIdentifier::Local {
                feed_url: source_feed_url,
            } => assert_eq!(source_feed_url, &feed_url),
            FeedIdentifier::Remote { .. } => panic!("JSON feed entry should stay local-scoped"),
        }
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_sends_conditional_headers_and_returns_response_validators() {
        let mut server = mockito::Server::new_async().await;
        let request_etag = "\"etag-old\"";
        let request_last_modified = "Wed, 01 Jan 2025 00:00:00 GMT";
        let response_etag = "\"etag-new\"";
        let response_last_modified = "Thu, 02 Jan 2025 00:00:00 GMT";
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", request_etag)
            .match_header("if-modified-since", request_last_modified)
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", response_etag)
            .with_header("last-modified", response_last_modified)
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/feed.xml", server.url()),
        });

        let result = provider
            .pull_entries(
                scope,
                Some(SyncCursor {
                    continuation: None,
                    since: Some(Utc::now()),
                    etag: Some(request_etag.to_string()),
                    last_modified: Some(request_last_modified.to_string()),
                }),
            )
            .await
            .unwrap();

        assert_eq!(result.entries.len(), 1);
        let cursor = result
            .next_cursor
            .expect("local feeds should return validators");
        assert_eq!(cursor.etag.as_deref(), Some(response_etag));
        assert_eq!(
            cursor.last_modified.as_deref(),
            Some(response_last_modified)
        );
        assert!(!result.not_modified);
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_handles_not_modified_without_reparsing_feed() {
        let mut server = mockito::Server::new_async().await;
        let request_etag = "\"etag-old\"";
        let request_last_modified = "Wed, 01 Jan 2025 00:00:00 GMT";
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", request_etag)
            .match_header("if-modified-since", request_last_modified)
            .with_status(304)
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/feed.xml", server.url()),
        });

        let result = provider
            .pull_entries(
                scope,
                Some(SyncCursor {
                    continuation: None,
                    since: None,
                    etag: Some(request_etag.to_string()),
                    last_modified: Some(request_last_modified.to_string()),
                }),
            )
            .await
            .unwrap();

        assert!(result.entries.is_empty());
        let cursor = result.next_cursor.expect("304 should keep validators");
        assert_eq!(cursor.etag.as_deref(), Some(request_etag));
        assert_eq!(cursor.last_modified.as_deref(), Some(request_last_modified));
        assert!(result.not_modified);
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_returns_auth_error_for_unauthorized_status() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/private.xml")
            .with_status(401)
            .with_body("unauthorized")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/private.xml", server.url()),
        });

        let error = provider
            .pull_entries(scope, None)
            .await
            .expect_err("401 should be classified as auth failure");

        assert!(matches!(error, DomainError::Auth(_)));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_returns_rate_limit_error_for_too_many_requests_status() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/rate-limited.xml")
            .with_status(429)
            .with_body("too many requests")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/rate-limited.xml", server.url()),
        });

        let error = provider
            .pull_entries(scope, None)
            .await
            .expect_err("429 should be classified as rate limit failure");

        assert!(matches!(error, DomainError::RateLimit(_)));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_rejects_oversized_feed_body_before_parse() {
        let oversized_body = "x".repeat(MAX_LOCAL_FEED_BODY_BYTES as usize + 1);
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/oversized.xml")
            .with_status(200)
            .with_body(oversized_body)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/oversized.xml", server.url()),
        });

        let error = provider
            .pull_entries(scope, None)
            .await
            .expect_err("oversized feed bodies should be rejected before parsing");

        assert!(matches!(
            error,
            DomainError::Network(message) if message.contains("Feed response body exceeds")
        ));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_applies_body_limit_when_content_encoding_is_present() {
        let oversized_body = "x".repeat(MAX_LOCAL_FEED_BODY_BYTES as usize + 1);
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/oversized-encoded.xml")
            .with_status(200)
            .with_body(oversized_body)
            .with_header("content-type", "application/rss+xml")
            .with_header("content-encoding", "identity")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/oversized-encoded.xml", server.url()),
        });

        let error = provider
            .pull_entries(scope, None)
            .await
            .expect_err("encoded feed bodies should be limited before parsing");

        assert!(matches!(
            error,
            DomainError::Network(message) if message.contains("Feed response body exceeds")
        ));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_uses_304_response_validators_when_present() {
        let mut server = mockito::Server::new_async().await;
        let request_etag = "\"etag-old\"";
        let response_etag = "W/\"etag-new\"";
        let response_last_modified = "Thu, 02 Jan 2025 00:00:00 GMT";
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", request_etag)
            .with_status(304)
            .with_header("etag", response_etag)
            .with_header("last-modified", response_last_modified)
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/feed.xml", server.url()),
        });

        let result = provider
            .pull_entries(
                scope,
                Some(SyncCursor {
                    continuation: None,
                    since: None,
                    etag: Some(request_etag.to_string()),
                    last_modified: None,
                }),
            )
            .await
            .unwrap();

        let cursor = result.next_cursor.expect("304 should return validators");
        assert_eq!(cursor.etag.as_deref(), Some(response_etag));
        assert_eq!(
            cursor.last_modified.as_deref(),
            Some(response_last_modified)
        );
        assert!(result.not_modified);
        mock.assert_async().await;
    }

    #[test]
    fn validate_resolved_host_rejects_dns_answers_to_private_ip() {
        let url = reqwest::Url::parse("http://localhost/feed.xml").unwrap();

        assert!(matches!(
            validate_resolved_host_is_public(&url),
            Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }

    #[tokio::test]
    async fn pull_entries_rejects_non_local_scope() {
        let provider = LocalProvider::new();
        let scope = PullScope::All;
        let result = provider.pull_entries(scope, None).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn pull_entries_rejects_loopback_feed_url_before_http_request() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/feed.xml")
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = LocalProvider::new();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/feed.xml", server.url()),
        });
        let error = provider
            .pull_entries(scope, None)
            .await
            .expect_err("loopback feed URL should be rejected before request");

        assert!(matches!(error, DomainError::Validation(_)));
        assert!(!mock.matched_async().await);
    }

    #[test]
    fn validate_external_feed_redirect_rejects_https_to_http_downgrade() {
        let previous = vec![reqwest::Url::parse("https://example.com/feed.xml").unwrap()];
        let next = reqwest::Url::parse("http://example.com/feed.xml").unwrap();

        assert!(matches!(
            validate_external_feed_redirect(&previous, &next),
            Err(DomainError::Validation(message)) if message == DOWNGRADE_REDIRECT_VALIDATION_MESSAGE
        ));
    }

    #[test]
    fn validate_external_feed_redirect_allows_http_to_https_upgrade() {
        let previous = vec![reqwest::Url::parse("http://example.com/feed.xml").unwrap()];
        let next = reqwest::Url::parse("https://example.com/feed.xml").unwrap();

        assert!(validate_external_feed_redirect(&previous, &next).is_ok());
    }

    #[test]
    fn validate_external_feed_redirect_rejects_private_redirect_targets() {
        let previous = vec![reqwest::Url::parse("https://example.com/feed.xml").unwrap()];

        for next in [
            reqwest::Url::parse("https://localhost/feed.xml").unwrap(),
            reqwest::Url::parse("https://127.0.0.1/feed.xml").unwrap(),
            reqwest::Url::parse("https://10.0.0.2/feed.xml").unwrap(),
        ] {
            assert!(matches!(
                validate_external_feed_redirect(&previous, &next),
                Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[test]
    fn feed_response_content_type_policy_allows_feed_html_and_missing_types() {
        for content_type in [
            Some("application/rss+xml; charset=utf-8"),
            Some("application/atom+xml"),
            Some("application/feed+json"),
            Some("application/xml"),
            Some("text/xml"),
            Some("text/html; charset=utf-8"),
            None,
        ] {
            assert!(
                is_supported_feed_response_content_type(content_type),
                "content type should be allowed: {content_type:?}"
            );
        }
    }

    #[test]
    fn feed_response_content_type_policy_rejects_binary_types() {
        assert!(!is_supported_feed_response_content_type(Some(
            "application/octet-stream"
        )));
    }

    #[tokio::test]
    async fn create_subscription_uses_feed_url_when_feed_title_and_site_link_are_missing() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
    </item>
  </channel>
</rss>"#;
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("user-agent", PROVIDER_USER_AGENT)
            .with_body(feed)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.remote_id, feed_url);
        assert_eq!(subscription.title, subscription.url);
        assert_eq!(subscription.site_url, subscription.url);
        assert_eq!(subscription.site_url, feed_url);
        assert_eq!(subscription.folder_remote_id, None);
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_uses_feed_url_when_site_link_is_blank() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blank Site Link Feed</title>
    <link>   </link>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
    </item>
  </channel>
</rss>"#;
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_body(feed)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.title, "Blank Site Link Feed");
        assert_eq!(subscription.site_url, feed_url);
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_sends_local_provider_user_agent() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("user-agent", PROVIDER_USER_AGENT)
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        provider.create_subscription(&feed_url, None).await.unwrap();

        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_retains_feed_metadata_when_items_are_incomplete() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Metadata Feed</title>
    <link>https://example.com/home</link>
    <item>
      <guid>missing-title-and-link</guid>
    </item>
    <item>
      <title></title>
      <link></link>
    </item>
  </channel>
</rss>"#;
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_body(feed)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.remote_id, feed_url);
        assert_eq!(subscription.title, "Metadata Feed");
        assert_eq!(subscription.site_url, "https://example.com/home");
        assert_eq!(subscription.url, subscription.remote_id);
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_prefers_atom_alternate_html_link_over_self_feed_link() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed.xml</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <link rel="self" type="application/atom+xml" href="https://example.com/feed.xml"/>
  <link rel="alternate" type="text/html" href="https://example.com/"/>
  <entry>
    <title>Article 1</title>
    <id>article-1</id>
    <updated>2026-03-27T12:00:00Z</updated>
  </entry>
</feed>"#;
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_body(feed)
            .with_header("content-type", "application/atom+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.site_url, "https://example.com/");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_returns_network_error_for_http_status_failure() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/missing.xml", server.url());
        let mock = server
            .mock("GET", "/missing.xml")
            .with_status(404)
            .with_body("not found")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let error = provider
            .create_subscription(&feed_url, None)
            .await
            .expect_err("HTTP status errors should not be parsed as feeds");

        assert!(matches!(error, DomainError::Network(_)));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_rejects_loopback_feed_url_before_http_request() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/feed.xml")
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;
        let feed_url = format!("{}/feed.xml", server.url());

        let provider = LocalProvider::new();
        let error = provider
            .create_subscription(&feed_url, None)
            .await
            .expect_err("loopback feed URL should be rejected before request");

        assert!(matches!(error, DomainError::Validation(_)));
        assert!(!mock.matched_async().await);
    }

    #[tokio::test]
    async fn create_subscription_returns_auth_error_for_unauthorized_status() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/private.xml", server.url());
        let mock = server
            .mock("GET", "/private.xml")
            .with_status(401)
            .with_body("unauthorized")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let error = provider
            .create_subscription(&feed_url, None)
            .await
            .expect_err("401 should be classified as auth failure");

        assert!(matches!(error, DomainError::Auth(_)));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_returns_rate_limit_error_for_too_many_requests_status() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/rate-limited.xml", server.url());
        let mock = server
            .mock("GET", "/rate-limited.xml")
            .with_status(429)
            .with_body("too many requests")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let error = provider
            .create_subscription(&feed_url, None)
            .await
            .expect_err("429 should be classified as rate limit failure");

        assert!(matches!(error, DomainError::RateLimit(_)));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_returns_parse_error_for_html_success_response() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/page", server.url());
        let mock = server
            .mock("GET", "/page")
            .with_status(200)
            .with_body("<html><body>not a feed</body></html>")
            .with_header("content-type", "text/html")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let error = provider
            .create_subscription(&feed_url, None)
            .await
            .expect_err("successful non-feed responses should be parser errors");

        assert!(matches!(error, DomainError::Parse(_)));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_copies_feed_icon_url() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <icon>https://example.com/icon.png</icon>
  <entry>
    <title>Article 1</title>
    <id>article-1</id>
    <updated>2026-03-27T12:00:00Z</updated>
  </entry>
</feed>"#;
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_body(feed)
            .with_header("content-type", "application/atom+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.title, "Atom Feed");
        assert_eq!(
            subscription.icon_url.as_deref(),
            Some("https://example.com/icon.png")
        );
        mock.assert_async().await;
    }
}
