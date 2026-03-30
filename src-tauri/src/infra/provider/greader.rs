use async_trait::async_trait;
use chrono::DateTime;
use reqwest::header::HeaderValue;
use serde::{Deserialize, Deserializer};
use std::time::Duration;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

use super::traits::{Credentials, FeedProvider};

// --- Google Reader API response types ---

#[derive(Deserialize)]
struct SubscriptionListResponse {
    subscriptions: Vec<GReaderSubscription>,
}

#[derive(Deserialize)]
struct GReaderSubscription {
    id: String,
    title: String,
    url: String,
    #[serde(rename = "htmlUrl")]
    html_url: String,
    categories: Vec<GReaderCategory>,
    #[serde(rename = "iconUrl")]
    icon_url: Option<String>,
}

#[derive(Deserialize)]
struct GReaderCategory {
    id: String,
    #[allow(dead_code)]
    label: String,
}

#[derive(Deserialize)]
struct StreamContentsResponse {
    items: Vec<GReaderItem>,
    continuation: Option<String>,
}

#[derive(Deserialize)]
struct GReaderItem {
    id: String,
    title: Option<String>,
    #[allow(dead_code)]
    canonical: Option<Vec<GReaderLink>>,
    alternate: Option<Vec<GReaderLink>>,
    summary: Option<GReaderContent>,
    content: Option<GReaderContent>,
    author: Option<String>,
    published: Option<i64>,
    updated: Option<i64>,
    #[serde(
        rename = "timestampUsec",
        default,
        deserialize_with = "deserialize_optional_i64_from_string_or_number"
    )]
    timestamp_usec: Option<i64>,
    origin: Option<GReaderOrigin>,
    categories: Vec<String>,
}

#[derive(Deserialize)]
struct GReaderLink {
    href: String,
}

#[derive(Deserialize)]
struct GReaderContent {
    content: String,
}

#[derive(Deserialize)]
struct GReaderOrigin {
    #[serde(rename = "streamId")]
    stream_id: String,
    #[allow(dead_code)]
    title: Option<String>,
}

#[derive(Deserialize)]
struct TagListResponse {
    tags: Vec<GReaderTag>,
}

#[derive(Deserialize)]
struct GReaderTag {
    id: String,
}

#[derive(Deserialize)]
struct StreamItemIdsResponse {
    #[serde(rename = "itemRefs")]
    item_refs: Option<Vec<ItemRef>>,
}

#[derive(Deserialize)]
struct ItemRef {
    id: String,
}

// --- Constants ---

const STATE_READ: &str = "user/-/state/com.google/read";
const STATE_STARRED: &str = "user/-/state/com.google/starred";
const STATE_READING_LIST: &str = "user/-/state/com.google/reading-list";
const LABEL_PREFIX: &str = "user/-/label/";
const STREAM_CONTENTS_LIMIT: u32 = 200;
const STREAM_IDS_LIMIT: u32 = 10000;

// --- Provider ---

/// Generic Google Reader API provider that supports FreshRSS, Inoreader, and other
/// GReader-compatible services.
pub struct GReaderProvider {
    kind: ProviderKind,
    /// Base URL for API calls (e.g., "http://server/api/greader.php" or "https://www.inoreader.com")
    api_base: String,
    /// Base URL for authentication (e.g., "http://server/api/greader.php" or "https://www.inoreader.com")
    auth_base: String,
    /// Inoreader requires AppId/AppKey headers on all requests (None for FreshRSS)
    app_id: Option<String>,
    app_key: Option<String>,
    http_client: reqwest::Client,
    auth_token: Option<String>,
}

impl GReaderProvider {
    /// Create a provider configured for FreshRSS.
    pub fn for_freshrss(server_url: &str) -> Self {
        let base = server_url.trim_end_matches('/');
        Self {
            kind: ProviderKind::FreshRss,
            api_base: format!("{base}/api/greader.php"),
            auth_base: format!("{base}/api/greader.php"),
            app_id: None,
            app_key: None,
            http_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_default(),
            auth_token: None,
        }
    }

    /// Create a provider configured for Inoreader.
    /// `app_id` and `app_key` are required for Inoreader API access.
    /// Register at https://www.inoreader.com/developers to obtain them.
    pub fn for_inoreader(app_id: Option<String>, app_key: Option<String>) -> Self {
        Self {
            kind: ProviderKind::Inoreader,
            api_base: "https://www.inoreader.com".to_string(),
            auth_base: "https://www.inoreader.com".to_string(),
            app_id,
            app_key,
            http_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_default(),
            auth_token: None,
        }
    }

    fn api_url(&self, path: &str) -> String {
        format!("{}{}", self.api_base, path)
    }

    fn auth_url(&self, path: &str) -> String {
        format!("{}{}", self.auth_base, path)
    }

    /// Apply Inoreader-specific AppId/AppKey headers to a request builder.
    fn apply_app_headers(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        let mut b = builder;
        if let Some(ref app_id) = self.app_id {
            b = b.header("AppId", app_id.as_str());
        }
        if let Some(ref app_key) = self.app_key {
            b = b.header("AppKey", app_key.as_str());
        }
        b
    }

    fn auth_header(&self) -> DomainResult<HeaderValue> {
        let token = self
            .auth_token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Not authenticated".into()))?;
        HeaderValue::from_str(&format!("GoogleLogin auth={token}"))
            .map_err(|e| DomainError::Auth(e.to_string()))
    }

    fn item_cursor_timestamp_usec(item: &GReaderItem) -> Option<i64> {
        item.timestamp_usec
            .or_else(|| item.updated.map(|ts| ts.saturating_mul(1_000_000)))
            .or_else(|| item.published.map(|ts| ts.saturating_mul(1_000_000)))
    }

    fn map_item_to_entry(item: GReaderItem) -> Option<RemoteEntry> {
        let origin = item.origin?;

        let url = item
            .alternate
            .as_ref()
            .and_then(|links| links.first())
            .map(|l| l.href.clone());

        let content = item
            .content
            .map(|c| c.content)
            .or_else(|| item.summary.as_ref().map(|s| s.content.clone()))
            .unwrap_or_default();

        let summary = item.summary.map(|s| s.content);

        let is_read = if item.categories.iter().any(|c| c.contains(STATE_READ)) {
            Some(true)
        } else {
            Some(false)
        };

        let is_starred = if item.categories.iter().any(|c| c.contains(STATE_STARRED)) {
            Some(true)
        } else {
            Some(false)
        };

        let published_at = item
            .published
            .and_then(|ts| DateTime::from_timestamp(ts, 0));

        let updated_at = item.updated.and_then(|ts| DateTime::from_timestamp(ts, 0));

        Some(RemoteEntry {
            id: Some(item.id),
            source_feed_id: FeedIdentifier::Remote {
                remote_id: origin.stream_id,
            },
            title: item.title.unwrap_or_default(),
            content,
            summary,
            url,
            published_at,
            updated_at,
            thumbnail: None,
            author: item.author,
            is_read,
            is_starred,
        })
    }
}

#[async_trait]
impl FeedProvider for GReaderProvider {
    fn kind(&self) -> ProviderKind {
        self.kind.clone()
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_folders: true,
            supports_starring: true,
            supports_search: true,
            supports_delta_sync: true,
            supports_remote_state: true,
        }
    }

    async fn authenticate(&mut self, credentials: &Credentials) -> DomainResult<()> {
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
            .apply_app_headers(self.http_client.post(&url))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(DomainError::Auth(format!(
                "Authentication failed: {}",
                response.status()
            )));
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

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        let url = self.api_url("/reader/api/0/subscription/list?output=json");
        let resp: SubscriptionListResponse = self
            .apply_app_headers(self.http_client.get(&url))
            .header("Authorization", self.auth_header()?)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?
            .json()
            .await?;

        let subscriptions = resp
            .subscriptions
            .into_iter()
            .map(|s| {
                let folder_remote_id = s.categories.first().map(|c| c.id.clone());
                RemoteSubscription {
                    remote_id: s.id,
                    title: s.title,
                    url: s.url,
                    site_url: s.html_url,
                    folder_remote_id,
                    icon_url: s.icon_url,
                }
            })
            .collect();

        Ok(subscriptions)
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        let url = self.api_url("/reader/api/0/tag/list?output=json");
        let resp: TagListResponse = self
            .apply_app_headers(self.http_client.get(&url))
            .header("Authorization", self.auth_header()?)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?
            .json()
            .await?;

        let folders = resp
            .tags
            .into_iter()
            .filter_map(|tag| {
                tag.id.strip_prefix(LABEL_PREFIX).map(|label| RemoteFolder {
                    remote_id: tag.id.clone(),
                    name: label.to_string(),
                    sort_order: None,
                })
            })
            .collect();

        Ok(folders)
    }

    async fn pull_entries(
        &self,
        scope: PullScope,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        let (stream_id, exclude_target) = match &scope {
            PullScope::Feed(FeedIdentifier::Remote { remote_id }) => (remote_id.clone(), None),
            PullScope::Feed(FeedIdentifier::Local { .. }) => {
                return Err(DomainError::Validation(
                    "GReaderProvider does not support local feeds".into(),
                ));
            }
            PullScope::All => (STATE_READING_LIST.to_string(), None),
            PullScope::Unread => (STATE_READING_LIST.to_string(), Some(STATE_READ.to_string())),
            PullScope::Starred => (STATE_STARRED.to_string(), None),
        };

        let mut url = format!(
            "{}?output=json&n={STREAM_CONTENTS_LIMIT}",
            self.api_url(&format!(
                "/reader/api/0/stream/contents/{}",
                urlencoded(&stream_id)
            ))
        );

        if let Some(ref xt) = exclude_target {
            url.push_str(&format!("&xt={}", urlencoded(xt)));
        }

        if let Some(ref c) = cursor {
            if let Some(ref cont) = c.continuation {
                url.push_str(&format!("&c={}", urlencoded(cont)));
            }
            if let Some(since) = c.since {
                url.push_str(&format!("&ot={}", since.timestamp_micros()));
            }
        }

        let resp: StreamContentsResponse = self
            .apply_app_headers(self.http_client.get(&url))
            .header("Authorization", self.auth_header()?)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?
            .json()
            .await?;

        let next_since_usec = resp
            .items
            .iter()
            .filter_map(Self::item_cursor_timestamp_usec)
            .max();
        let has_more = resp.continuation.is_some();
        let next_cursor =
            if resp.continuation.is_some() || next_since_usec.is_some() || cursor.is_some() {
                Some(SyncCursor {
                    continuation: resp.continuation,
                    since: next_since_usec
                        .and_then(DateTime::from_timestamp_micros)
                        .or_else(|| cursor.as_ref().and_then(|current| current.since)),
                    etag: cursor.as_ref().and_then(|current| current.etag.clone()),
                    last_modified: cursor
                        .as_ref()
                        .and_then(|current| current.last_modified.clone()),
                })
            } else {
                None
            };

        let entries = resp
            .items
            .into_iter()
            .filter_map(Self::map_item_to_entry)
            .collect();

        Ok(PullResult {
            entries,
            next_cursor,
            has_more,
        })
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        let read_url = format!(
            "{}?output=json&n={STREAM_IDS_LIMIT}",
            self.api_url(&format!(
                "/reader/api/0/stream/items/ids?s={}",
                urlencoded(STATE_READ)
            ))
        );

        let starred_url = format!(
            "{}?output=json&n={STREAM_IDS_LIMIT}",
            self.api_url(&format!(
                "/reader/api/0/stream/items/ids?s={}",
                urlencoded(STATE_STARRED)
            ))
        );

        let auth = self.auth_header()?;

        let (read_resp, starred_resp) = tokio::try_join!(
            async {
                self.apply_app_headers(self.http_client.get(&read_url))
                    .header("Authorization", auth.clone())
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|e| DomainError::Network(e.to_string()))?
                    .json::<StreamItemIdsResponse>()
                    .await
                    .map_err(DomainError::from)
            },
            async {
                self.apply_app_headers(self.http_client.get(&starred_url))
                    .header("Authorization", auth.clone())
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|e| DomainError::Network(e.to_string()))?
                    .json::<StreamItemIdsResponse>()
                    .await
                    .map_err(DomainError::from)
            }
        )?;

        let read_ids = read_resp
            .item_refs
            .unwrap_or_default()
            .into_iter()
            .map(|r| normalize_item_id(&r.id))
            .collect();

        let starred_ids = starred_resp
            .item_refs
            .unwrap_or_default()
            .into_iter()
            .map(|r| normalize_item_id(&r.id))
            .collect();

        Ok(RemoteState {
            read_ids,
            starred_ids,
        })
    }

    async fn push_mutations(&self, mutations: &[Mutation]) -> DomainResult<()> {
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

            self.apply_app_headers(self.http_client.post(&url))
                .header("Authorization", auth.clone())
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(body)
                .send()
                .await?
                .error_for_status()
                .map_err(|e| DomainError::Network(e.to_string()))?;
        }

        Ok(())
    }

    async fn create_subscription(
        &self,
        url: &str,
        folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        let api_url = self.api_url("/reader/api/0/subscription/quickadd");
        let auth = self.auth_header()?;

        let mut body = format!("quickadd={}", urlencoded(url));
        if let Some(folder_name) = folder {
            body.push_str(&format!(
                "&a={}{}",
                urlencoded(LABEL_PREFIX),
                urlencoded(folder_name)
            ));
        }

        let resp = self
            .apply_app_headers(self.http_client.post(&api_url))
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?;

        let _text = resp.text().await?;

        // After quickadd, fetch subscriptions to find the new one
        let subs = self.get_subscriptions().await?;
        subs.into_iter()
            .find(|s| s.url == url || s.remote_id.contains(url))
            .ok_or_else(|| {
                DomainError::Validation(format!(
                    "Subscription was created but could not be found: {url}"
                ))
            })
    }

    async fn delete_subscription(&self, id: &FeedIdentifier) -> DomainResult<()> {
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

        self.apply_app_headers(self.http_client.post(&url))
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?;

        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum IntOrString {
    Int(i64),
    String(String),
}

fn deserialize_optional_i64_from_string_or_number<'de, D>(
    deserializer: D,
) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<IntOrString>::deserialize(deserializer)?;
    match value {
        Some(IntOrString::Int(value)) => Ok(Some(value)),
        Some(IntOrString::String(value)) => value
            .parse::<i64>()
            .map(Some)
            .map_err(serde::de::Error::custom),
        None => Ok(None),
    }
}

/// Simple percent-encoding for URL form values.
fn urlencoded(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                String::from(b as char)
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Convert short-form decimal item ID (from `stream/items/ids`) to the
/// canonical long-form tag URI used by `stream/contents`.
///
/// Example: `"1774810819788671"` → `"tag:google.com,2005:reader/item/00064e2e5874ff7f"`
///
/// Already long-form or non-numeric IDs are returned unchanged.
fn normalize_item_id(id: &str) -> String {
    const TAG_PREFIX: &str = "tag:google.com,2005:reader/item/";
    if id.starts_with(TAG_PREFIX) {
        return id.to_string();
    }
    match id.parse::<u64>() {
        Ok(n) => format!("{TAG_PREFIX}{n:016x}"),
        Err(_) => id.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn authenticate_successful() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_header("Content-Type", "application/x-www-form-urlencoded")
            .with_status(200)
            .with_body("SID=unused\nLSID=unused\nAuth=test-token-123\n")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        let creds = Credentials {
            password: Some("mypassword".into()),
            token: Some("myuser".into()),
        };

        provider.authenticate(&creds).await.unwrap();
        assert_eq!(provider.auth_token.as_deref(), Some("test-token-123"));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_subscriptions_parses_list() {
        let mut server = mockito::Server::new_async().await;
        let auth_mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let sub_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/subscription/list?output=json",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/rss",
                            "title": "Example Feed",
                            "url": "https://example.com/rss",
                            "htmlUrl": "https://example.com",
                            "categories": [
                                {"id": "user/-/label/Tech", "label": "Tech"}
                            ],
                            "iconUrl": "https://example.com/icon.png"
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let subs = provider.get_subscriptions().await.unwrap();
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].title, "Example Feed");
        assert_eq!(subs[0].remote_id, "feed/https://example.com/rss");
        assert_eq!(
            subs[0].folder_remote_id.as_deref(),
            Some("user/-/label/Tech")
        );
        assert_eq!(
            subs[0].icon_url.as_deref(),
            Some("https://example.com/icon.png")
        );

        auth_mock.assert_async().await;
        sub_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_folders_filters_labels() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let tag_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list?output=json")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "tags": [
                        {"id": "user/-/state/com.google/starred"},
                        {"id": "user/-/state/com.google/reading-list"},
                        {"id": "user/-/label/Tech"},
                        {"id": "user/-/label/News"}
                    ]
                }"#,
            )
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let folders = provider.get_folders().await.unwrap();
        assert_eq!(folders.len(), 2);
        assert_eq!(folders[0].name, "Tech");
        assert_eq!(folders[0].remote_id, "user/-/label/Tech");
        assert_eq!(folders[1].name, "News");

        tag_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_parses_stream_with_continuation() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let stream_mock = server
            .mock(
                "GET",
                mockito::Matcher::Regex(
                    r"/api/greader.php/reader/api/0/stream/contents/.*output=json.*".to_string(),
                ),
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Test Article",
                            "alternate": [{"href": "https://example.com/article"}],
                            "summary": {"content": "Short summary"},
                            "content": {"content": "<p>Full content</p>"},
                            "author": "Alice",
                            "timestampUsec": "1700000100000000",
                            "published": 1700000000,
                            "updated": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": [
                                "user/-/state/com.google/reading-list",
                                "user/-/state/com.google/read"
                            ]
                        },
                        {
                            "id": "entry-2",
                            "title": "No Origin Article",
                            "categories": []
                        }
                    ],
                    "continuation": "page2token"
                }"#,
            )
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let result = provider.pull_entries(PullScope::All, None).await.unwrap();

        // entry-2 has no origin, so it's filtered out
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].title, "Test Article");
        assert_eq!(
            result.entries[0].url.as_deref(),
            Some("https://example.com/article")
        );
        assert_eq!(result.entries[0].content, "<p>Full content</p>");
        assert_eq!(result.entries[0].summary.as_deref(), Some("Short summary"));
        assert_eq!(result.entries[0].author.as_deref(), Some("Alice"));
        assert_eq!(result.entries[0].is_read, Some(true));
        assert_eq!(result.entries[0].is_starred, Some(false));

        // Check source_feed_id
        match &result.entries[0].source_feed_id {
            FeedIdentifier::Remote { remote_id } => {
                assert_eq!(remote_id, "feed/https://example.com/rss");
            }
            _ => panic!("Expected Remote feed identifier"),
        }

        // Continuation
        assert!(result.has_more);
        let cursor = result.next_cursor.unwrap();
        assert_eq!(cursor.continuation.as_deref(), Some("page2token"));
        assert_eq!(
            cursor.since.map(|ts| ts.timestamp_micros()),
            Some(1_700_000_100_000_000)
        );

        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_includes_ot_when_since_cursor_is_present() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let stream_mock = server
            .mock(
                "GET",
                mockito::Matcher::Regex(
                    r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
                ),
            )
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "200".into()),
                mockito::Matcher::UrlEncoded("c".into(), "page1".into()),
                mockito::Matcher::UrlEncoded("ot".into(), "1700000100000000".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let cursor = SyncCursor {
            continuation: Some("page1".to_string()),
            since: Some(DateTime::from_timestamp_micros(1_700_000_100_000_000).unwrap()),
            etag: None,
            last_modified: None,
        };
        let result = provider
            .pull_entries(PullScope::All, Some(cursor))
            .await
            .unwrap();

        assert!(!result.has_more);
        assert!(result.entries.is_empty());
        stream_mock.assert_async().await;
    }

    // === Live integration tests ===
    // Run with: dotenvx run -- cargo test --manifest-path src-tauri/Cargo.toml freshrss_live -- --ignored
    // Or: mise test:live

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_auth() {
        let url = std::env::var("FRESHRSS_URL").expect("Set FRESHRSS_URL");
        let user = std::env::var("FRESHRSS_USER").expect("Set FRESHRSS_USER");
        let pass = std::env::var("FRESHRSS_PASS").expect("Set FRESHRSS_PASS");

        let mut provider = GReaderProvider::for_freshrss(&url);
        let creds = Credentials {
            token: Some(user),
            password: Some(pass),
        };
        provider.authenticate(&creds).await.unwrap();
        assert!(provider.auth_token.is_some());
        println!("Auth token: {:?}", provider.auth_token);
    }

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_subscriptions() {
        let (provider, _) = live_provider().await;
        let subs = provider.get_subscriptions().await.unwrap();
        println!("Subscriptions: {}", subs.len());
        for sub in &subs {
            println!("  - {} ({})", sub.title, sub.remote_id);
        }
        assert!(!subs.is_empty(), "Should have at least one subscription");
    }

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_folders() {
        let (provider, _) = live_provider().await;
        let folders = provider.get_folders().await.unwrap();
        println!("Folders: {}", folders.len());
        for f in &folders {
            println!("  - {} ({})", f.name, f.remote_id);
        }
    }

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_pull_entries() {
        let (provider, _) = live_provider().await;
        let result = provider.pull_entries(PullScope::All, None).await.unwrap();
        println!("Entries: {}", result.entries.len());
        println!("Has more: {}", result.has_more);
        for entry in result.entries.iter().take(5) {
            println!(
                "  - {} (read={:?}, starred={:?})",
                entry.title, entry.is_read, entry.is_starred
            );
        }
        assert!(!result.entries.is_empty(), "Should have at least one entry");
    }

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_pull_state() {
        let (provider, _) = live_provider().await;
        let state = provider.pull_state().await.unwrap();
        println!("Read IDs: {}", state.read_ids.len());
        println!("Starred IDs: {}", state.starred_ids.len());
    }

    /// Helper: create an authenticated live provider
    async fn live_provider() -> (GReaderProvider, ()) {
        let url = std::env::var("FRESHRSS_URL").expect("Set FRESHRSS_URL");
        let user = std::env::var("FRESHRSS_USER").expect("Set FRESHRSS_USER");
        let pass = std::env::var("FRESHRSS_PASS").expect("Set FRESHRSS_PASS");

        let mut provider = GReaderProvider::for_freshrss(&url);
        provider
            .authenticate(&Credentials {
                token: Some(user),
                password: Some(pass),
            })
            .await
            .unwrap();
        (provider, ())
    }

    #[tokio::test]
    async fn push_mutations_sends_edit_tags() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let mark_read_mock = server
            .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body("OK")
            .expect(3)
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let mutations = vec![
            Mutation::MarkRead {
                remote_entry_id: "entry-1".into(),
            },
            Mutation::MarkUnread {
                remote_entry_id: "entry-2".into(),
            },
            Mutation::SetStarred {
                remote_entry_id: "entry-3".into(),
                starred: true,
            },
        ];

        provider.push_mutations(&mutations).await.unwrap();
        mark_read_mock.assert_async().await;
    }

    #[test]
    fn normalize_item_id_converts_decimal_to_long_form() {
        assert_eq!(
            normalize_item_id("1774810819788671"),
            "tag:google.com,2005:reader/item/00064e2e5874ff7f"
        );
    }

    #[test]
    fn normalize_item_id_passes_through_long_form() {
        let long = "tag:google.com,2005:reader/item/00064e2e5874ff7f";
        assert_eq!(normalize_item_id(long), long);
    }

    #[test]
    fn normalize_item_id_passes_through_non_numeric() {
        assert_eq!(normalize_item_id("some-other-id"), "some-other-id");
    }

    #[test]
    fn normalize_item_id_handles_zero() {
        assert_eq!(
            normalize_item_id("0"),
            "tag:google.com,2005:reader/item/0000000000000000"
        );
    }
}
