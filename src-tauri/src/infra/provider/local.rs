use async_trait::async_trait;
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use reqwest::StatusCode;
use std::net::{IpAddr, ToSocketAddrs};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

use super::http_defaults::{self, http_client_builder};
use super::normalizer;
use super::traits::{Credentials, FeedProvider};

const PRIVATE_URL_VALIDATION_MESSAGE: &str =
    "Requests to private/loopback addresses are not allowed";
const UNSUPPORTED_URL_VALIDATION_MESSAGE: &str = "Only http:// and https:// URLs are supported";
const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str = "HTTPS to HTTP redirects are not allowed";
const FEED_RESPONSE_BODY_INCOMPLETE_MESSAGE: &str =
    "Feed response body ended before the declared response length";

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

    fn resolve_feed_site_url(feed_url: &str, raw_site_url: &str) -> Option<String> {
        let trimmed = raw_site_url.trim();
        if trimmed.is_empty() {
            return None;
        }

        let resolved = reqwest::Url::parse(feed_url)
            .and_then(|base_url| base_url.join(trimmed))
            .ok()?;
        normalizer::normalize_provider_metadata_url(resolved.as_str())
    }

    fn select_feed_site_url(feed: &feed_rs::model::Feed, feed_url: &str) -> String {
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
            .and_then(|link| Self::resolve_feed_site_url(feed_url, &link.href))
            .unwrap_or_else(|| feed_url.to_string())
    }

    fn select_raw_feed_site_url(feed_body: &[u8], feed_url: &str) -> Option<String> {
        let body = String::from_utf8_lossy(feed_body);
        Self::extract_raw_link_href(&body)
            .or_else(|| Self::extract_rss_channel_link_text(&body))
            .and_then(|raw_url| Self::resolve_feed_site_url(feed_url, &raw_url))
    }

    fn extract_raw_link_href(body: &str) -> Option<String> {
        let lower_body = body.to_ascii_lowercase();
        let mut search_from = 0;
        while let Some(start_offset) = lower_body[search_from..].find("<link") {
            let start = search_from + start_offset;
            let remaining = &lower_body[start..];
            let Some(end_offset) = remaining.find('>') else {
                return None;
            };
            let tag = &body[start..start + end_offset + 1];
            search_from = start + end_offset + 1;

            let rel = Self::extract_raw_attribute(tag, "rel").unwrap_or_else(|| "alternate".into());
            let media_type =
                Self::extract_raw_attribute(tag, "type").unwrap_or_else(|| "text/html".into());
            if !rel
                .split_ascii_whitespace()
                .any(|token| token.eq_ignore_ascii_case("alternate"))
                || !media_type.eq_ignore_ascii_case("text/html")
            {
                continue;
            }

            if let Some(href) =
                Self::extract_raw_attribute(tag, "href").filter(|href| !href.trim().is_empty())
            {
                return Some(href);
            }
        }

        None
    }

    fn extract_raw_attribute(tag: &str, name: &str) -> Option<String> {
        for quote in ['"', '\''] {
            let pattern = format!("{name}={quote}");
            let lower_tag = tag.to_ascii_lowercase();
            let Some(start) = lower_tag.find(&pattern) else {
                continue;
            };
            let value_start = start + pattern.len();
            let Some(end_offset) = tag[value_start..].find(quote) else {
                continue;
            };
            return Some(tag[value_start..value_start + end_offset].to_string());
        }

        None
    }

    fn extract_rss_channel_link_text(body: &str) -> Option<String> {
        let lower_body = body.to_ascii_lowercase();
        let channel_start = lower_body.find("<channel").unwrap_or(0);
        let channel_end = lower_body[channel_start..]
            .find("<item")
            .map_or(body.len(), |item_start| channel_start + item_start);
        let channel = &body[channel_start..channel_end];
        let lower_channel = &lower_body[channel_start..channel_end];
        let link_start = lower_channel.find("<link>")? + "<link>".len();
        let link_end = lower_channel[link_start..].find("</link>")? + link_start;
        let link = channel[link_start..link_end].trim();
        (!link.is_empty()).then(|| link.to_string())
    }

    async fn response_bytes_with_limit(response: reqwest::Response) -> DomainResult<Vec<u8>> {
        validate_feed_response_content_type(response.headers())?;

        http_defaults::response_bytes_with_decoded_cap(
            response,
            http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES,
            feed_body_too_large_error,
            feed_response_body_read_error,
        )
        .await
    }
}

fn feed_body_too_large_error() -> DomainError {
    DomainError::Network(format!(
        "Feed response body exceeds {} bytes",
        http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
    ))
}

fn unsupported_feed_content_type_error(content_type: &str) -> DomainError {
    DomainError::Network(format!(
        "Unsupported feed response content type: {content_type}"
    ))
}

fn feed_response_body_read_error(error: reqwest::Error) -> DomainError {
    let _ = error;
    DomainError::Network(FEED_RESPONSE_BODY_INCOMPLETE_MESSAGE.to_string())
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

        let response_url = response.url().to_string();
        let bytes = Self::response_bytes_with_limit(response).await?;
        let entries = normalizer::normalize_feed(&bytes, response_url.as_str())?;

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

        let site_url = Self::select_raw_feed_site_url(&bytes, url.as_str())
            .unwrap_or_else(|| Self::select_feed_site_url(&feed, url.as_str()));

        Ok(RemoteSubscription {
            remote_id: url.to_string(),
            title: feed
                .title
                .as_ref()
                .map(|t| t.content.clone())
                .unwrap_or_else(|| url.to_string()),
            url: url.to_string(),
            site_url,
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
    use tokio::io::AsyncWriteExt;
    use tokio::net::TcpListener;
    use tokio::task::JoinHandle;
    use tokio::time::{timeout, Duration};

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

    struct OneShotHttpServer {
        address: std::net::SocketAddr,
        task: JoinHandle<()>,
    }

    impl OneShotHttpServer {
        async fn bind(response: &'static str) -> Self {
            let listener = TcpListener::bind("127.0.0.1:0")
                .await
                .expect("test server should bind an isolated ephemeral port");
            let address = listener
                .local_addr()
                .expect("test server should expose local address");
            let task = tokio::spawn(async move {
                let (mut stream, _) = listener
                    .accept()
                    .await
                    .expect("test server should accept one request");
                stream
                    .write_all(response.as_bytes())
                    .await
                    .expect("test response should be written");
                stream.shutdown().await.expect("test stream should close");
            });

            Self { address, task }
        }

        fn url(&self, path: &str) -> String {
            format!("http://{}{}", self.address, path)
        }

        async fn shutdown(self) {
            timeout(Duration::from_secs(2), self.task)
                .await
                .expect("test server should shut down after serving one request")
                .expect("test server task should finish");
        }
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
    async fn pull_entries_uses_redirect_final_url_as_entry_source() {
        let mut server = mockito::Server::new_async().await;
        let redirect = server
            .mock("GET", "/old-feed.xml")
            .with_status(308)
            .with_header("location", "/feed.xml?b=2&a=1")
            .create_async()
            .await;
        let final_feed = server
            .mock("GET", "/feed.xml")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("b".to_string(), "2".to_string()),
                mockito::Matcher::UrlEncoded("a".to_string(), "1".to_string()),
            ]))
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let result = provider
            .pull_entries(
                PullScope::Feed(FeedIdentifier::Local {
                    feed_url: format!("{}/old-feed.xml", server.url()),
                }),
                None,
            )
            .await
            .unwrap();

        match &result.entries[0].source_feed_id {
            FeedIdentifier::Local { feed_url } => {
                assert_eq!(feed_url, &format!("{}/feed.xml?b=2&a=1", server.url()));
            }
            FeedIdentifier::Remote { .. } => panic!("local feed should stay local-scoped"),
        }
        redirect.assert_async().await;
        final_feed.assert_async().await;
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
        let oversized_body =
            "x".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize + 1);
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
        let oversized_body =
            "x".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize + 1);
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
    async fn pull_entries_classifies_short_content_length_body_as_network_error() {
        let server = OneShotHttpServer::bind(concat!(
            "HTTP/1.1 200 OK\r\n",
            "Content-Type: application/rss+xml\r\n",
            "Content-Length: 1024\r\n",
            "\r\n",
            "<?xml version=\"1.0\"?><rss version=\"2.0\"><channel>"
        ))
        .await;

        let provider = local_provider_allowing_private_feed_urls();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: server.url("/feed.xml"),
        });

        let error = provider
            .pull_entries(scope, None)
            .await
            .expect_err("short response body should not become a parse error");
        server.shutdown().await;

        assert!(matches!(
            error,
            DomainError::Network(message) if message == FEED_RESPONSE_BODY_INCOMPLETE_MESSAGE
        ));
    }

    #[tokio::test]
    async fn provider_test_http_server_uses_ephemeral_ports_and_explicit_shutdown() {
        let server_a =
            OneShotHttpServer::bind("HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n").await;
        let server_b =
            OneShotHttpServer::bind("HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n").await;

        assert_ne!(
            server_a.address.port(),
            server_b.address.port(),
            "provider test HTTP servers should not share a fixed port"
        );

        let client = reqwest::Client::new();
        let status_a = client
            .get(server_a.url("/probe-a"))
            .send()
            .await
            .expect("server A should respond")
            .status();
        let status_b = client
            .get(server_b.url("/probe-b"))
            .send()
            .await
            .expect("server B should respond")
            .status();

        assert_eq!(status_a, reqwest::StatusCode::NO_CONTENT);
        assert_eq!(status_b, reqwest::StatusCode::NO_CONTENT);
        server_a.shutdown().await;
        server_b.shutdown().await;
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
    fn redirect_policy_limits_looping_feed_redirect_chains() {
        let previous = vec![
            reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
            reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
            reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
            reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
            reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
            reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
        ];
        let next = reqwest::Url::parse("http://example.com/feed.xml").unwrap();

        assert!(validate_external_feed_redirect(&previous, &next).is_ok());
        assert!(previous.len() > 5, "redirect policy rejects this hop count");
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

    #[test]
    fn resolve_feed_site_url_resolves_relative_site_links_against_feed_url() {
        assert_eq!(
            LocalProvider::resolve_feed_site_url("https://example.com/blog/feed.xml", "../")
                .as_deref(),
            Some("https://example.com/")
        );
    }

    #[test]
    fn select_raw_feed_site_url_resolves_relative_rss_channel_link_against_feed_url() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Relative Site Feed</title>
    <link>../</link>
    <item>
      <title>Article 1</title>
      <link>https://example.com/articles/1</link>
    </item>
  </channel>
</rss>"#;

        assert_eq!(
            LocalProvider::select_raw_feed_site_url(
                feed.as_bytes(),
                "https://example.com/blog/feed.xml"
            )
            .as_deref(),
            Some("https://example.com/")
        );
    }

    #[tokio::test]
    async fn create_subscription_resolves_scheme_relative_site_links_against_feed_url() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Scheme Relative Site Feed</title>
  <id>https://example.com/feed.xml</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <link rel="alternate" type="text/html" href="//example.com/home#fragment"/>
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

        assert_eq!(subscription.site_url, "http://example.com/home");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_falls_back_to_feed_url_when_site_link_is_invalid_after_resolution()
    {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Invalid Site Feed</title>
  <id>https://example.com/feed.xml</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <link rel="alternate" type="text/html" href="http://localhost/home"/>
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

        assert_eq!(subscription.site_url, feed_url);
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
    async fn feed_parser_boundary_sniffs_supported_content_type_fallbacks() {
        let json_feed = r#"{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "JSON Feed",
  "home_page_url": "https://example.com/",
  "feed_url": "https://example.com/feed.json",
  "items": [
    {
      "id": "json-1",
      "url": "https://example.com/json-1",
      "title": "JSON Article",
      "content_text": "Hello"
    }
  ]
}"#;
        let mut server = mockito::Server::new_async().await;
        let application_xml_url = format!("{}/application.xml", server.url());
        let json_feed_url = format!("{}/feed.json", server.url());
        let html_fallback_url = format!("{}/html", server.url());
        let missing_type_url = format!("{}/missing-type", server.url());
        let xml_mock = server
            .mock("GET", "/application.xml")
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/xml; charset=utf-8")
            .create_async()
            .await;
        let json_mock = server
            .mock("GET", "/feed.json")
            .with_body(json_feed)
            .with_header("content-type", "application/feed+json")
            .create_async()
            .await;
        let html_mock = server
            .mock("GET", "/html")
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "text/html; charset=utf-8")
            .create_async()
            .await;
        let missing_type_mock = server
            .mock("GET", "/missing-type")
            .with_body(SAMPLE_RSS)
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();

        for url in [
            application_xml_url,
            json_feed_url,
            html_fallback_url,
            missing_type_url,
        ] {
            provider.create_subscription(&url, None).await.unwrap();
        }

        xml_mock.assert_async().await;
        json_mock.assert_async().await;
        html_mock.assert_async().await;
        missing_type_mock.assert_async().await;
    }

    #[tokio::test]
    async fn feed_parser_boundary_handles_charset_bom_and_xml_declaration_corpus() {
        let corpus: Vec<(&str, Vec<u8>, &str)> = vec![
            (
                "/utf8-bom.xml",
                [
                    b"\xEF\xBB\xBF".as_slice(),
                    br#"<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>UTF8 BOM Feed</title><link>https://example.com/</link><item><title>BOM Article</title><link>https://example.com/bom</link><guid>bom</guid></item></channel></rss>"#.as_slice(),
                ]
                .concat(),
                "UTF8 BOM Feed",
            ),
            (
                "/xml-declaration.xml",
                br#"<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Declared UTF8 Feed</title><link>https://example.com/</link><item><title>Declared Article</title><link>https://example.com/declared</link><guid>declared</guid></item></channel></rss>"#.to_vec(),
                "Declared UTF8 Feed",
            ),
            (
                "/shift-jis-declaration.xml",
                br#"<?xml version="1.0" encoding="Shift_JIS"?><rss version="2.0"><channel><title>Shift_JIS Feed</title><link>https://example.com/</link><item><title>Shift_JIS Article</title><link>https://example.com/shift-jis</link><guid>shift-jis</guid></item></channel></rss>"#.to_vec(),
                "Shift_JIS Feed",
            ),
            (
                "/html-entity.xml",
                br#"<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Tom &amp; Jerry Feed</title><link>https://example.com/</link><item><title>Entity Article</title><link>https://example.com/entity</link><guid>entity</guid></item></channel></rss>"#.to_vec(),
                "Tom & Jerry Feed",
            ),
            (
                "/cdata.xml",
                br#"<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title><![CDATA[CDATA Feed]]></title><link>https://example.com/</link><item><title><![CDATA[CDATA Article]]></title><link>https://example.com/cdata</link><guid>cdata</guid></item></channel></rss>"#.to_vec(),
                "CDATA Feed",
            ),
            (
                "/empty-title.xml",
                br#"<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title></title><link>https://example.com/</link><item><title>Empty Title Article</title><link>https://example.com/empty-title</link><guid>empty-title</guid></item></channel></rss>"#.to_vec(),
                "",
            ),
        ];

        let mut server = mockito::Server::new_async().await;
        let mut feed_urls = Vec::new();
        let mut mocks = Vec::new();
        for (path, body, _) in &corpus {
            feed_urls.push(format!("{}{}", server.url(), path));
            mocks.push(
                server
                    .mock("GET", *path)
                    .with_body(body.clone())
                    .with_header("content-type", "application/rss+xml; charset=utf-8")
                    .create_async()
                    .await,
            );
        }

        let provider = local_provider_allowing_private_feed_urls();
        for ((_, _, expected_title), feed_url) in corpus.iter().zip(feed_urls.iter()) {
            let subscription = provider.create_subscription(feed_url, None).await.unwrap();
            assert_eq!(subscription.title, *expected_title);
        }

        for mock in mocks {
            mock.assert_async().await;
        }
    }

    #[tokio::test]
    async fn feed_parser_boundary_keeps_empty_title_when_invalid_bytes_drop_text() {
        let invalid_feed = [
            br#"<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>"#
                .as_slice(),
            b"\xFF\xFE",
            br#"</title><link>https://example.com/</link></channel></rss>"#.as_slice(),
        ]
        .concat();
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/invalid.xml", server.url());
        let mock = server
            .mock("GET", "/invalid.xml")
            .with_body(invalid_feed)
            .with_header("content-type", "application/rss+xml; charset=utf-8")
            .create_async()
            .await;

        let provider = local_provider_allowing_private_feed_urls();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.title, "");
        assert_eq!(subscription.site_url, "https://example.com/");
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
