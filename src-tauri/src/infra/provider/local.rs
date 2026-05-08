use async_trait::async_trait;
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use reqwest::StatusCode;
use std::time::Duration;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

use super::normalizer;
use super::traits::{Credentials, FeedProvider};

const LOCAL_PROVIDER_TIMEOUT: Duration = Duration::from_secs(15);
const LOCAL_PROVIDER_USER_AGENT: &str = "UltraRSSReader/0.1";

pub struct LocalProvider {
    http_client: reqwest::Client,
}

impl Default for LocalProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalProvider {
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::builder()
                .timeout(LOCAL_PROVIDER_TIMEOUT)
                .redirect(reqwest::redirect::Policy::limited(5))
                .user_agent(LOCAL_PROVIDER_USER_AGENT)
                .build()
                .unwrap_or_default(),
        }
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
}

#[async_trait]
impl FeedProvider for LocalProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Local
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_folders: false,
            supports_starring: false,
            supports_search: false,
            supports_delta_sync: false,
            supports_remote_state: false,
        }
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

        let mut request = self.http_client.get(&feed_url);
        if let Some(current) = cursor.as_ref() {
            if let Some(etag) = current.etag.as_deref() {
                request = request.header(IF_NONE_MATCH, etag);
            }
            if let Some(last_modified) = current.last_modified.as_deref() {
                request = request.header(IF_MODIFIED_SINCE, last_modified);
            }
        }

        let response = request.send().await?;
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
            return Err(DomainError::Network(format!(
                "Local feed request failed: {status}"
            )));
        }

        let bytes = response.bytes().await?;
        let entries = normalizer::normalize_feed(&bytes, &feed_url)?;

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
        let response = self
            .http_client
            .get(url)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?;
        let bytes = response.bytes().await?;
        let feed =
            feed_rs::parser::parse(&bytes[..]).map_err(|e| DomainError::Parse(e.to_string()))?;

        Ok(RemoteSubscription {
            remote_id: url.to_string(),
            title: feed
                .title
                .map(|t| t.content)
                .unwrap_or_else(|| url.to_string()),
            url: url.to_string(),
            site_url: feed
                .links
                .first()
                .map(|l| l.href.clone())
                .unwrap_or_default(),
            folder_remote_id: None,
            icon_url: feed.icon.map(|i| i.uri),
        })
    }

    async fn delete_subscription(&self, _: &FeedIdentifier) -> DomainResult<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
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

    #[tokio::test]
    async fn pull_entries_fetches_and_parses() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("user-agent", LOCAL_PROVIDER_USER_AGENT)
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = LocalProvider::new();
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

        let provider = LocalProvider::new();
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

        let provider = LocalProvider::new();
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

        let provider = LocalProvider::new();
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
    async fn pull_entries_rejects_non_local_scope() {
        let provider = LocalProvider::new();
        let scope = PullScope::All;
        let result = provider.pull_entries(scope, None).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn create_subscription_uses_url_when_feed_title_and_site_link_are_missing() {
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
            .with_body(feed)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = LocalProvider::new();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.remote_id, feed_url);
        assert_eq!(subscription.title, subscription.url);
        assert_eq!(subscription.site_url, "");
        assert_eq!(subscription.folder_remote_id, None);
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

        let provider = LocalProvider::new();
        let error = provider
            .create_subscription(&feed_url, None)
            .await
            .expect_err("HTTP status errors should not be parsed as feeds");

        assert!(matches!(error, DomainError::Network(_)));
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

        let provider = LocalProvider::new();
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

        let provider = LocalProvider::new();
        let subscription = provider.create_subscription(&feed_url, None).await.unwrap();

        assert_eq!(subscription.title, "Atom Feed");
        assert_eq!(
            subscription.icon_url.as_deref(),
            Some("https://example.com/icon.png")
        );
        mock.assert_async().await;
    }
}
