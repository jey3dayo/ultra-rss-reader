use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::header::HeaderValue;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer};
use std::collections::{HashMap, HashSet};
use std::fmt;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

use super::http_defaults::{self, http_client_builder};
use super::normalizer::{normalize_provider_metadata_url, normalize_trusted_backend_article_url};
use super::traits::{Credentials, FeedProvider};

// --- Google Reader API response types ---

#[derive(Deserialize)]
struct SubscriptionListResponse {
    subscriptions: Vec<GReaderSubscription>,
}

#[derive(Deserialize)]
struct QuickAddResponse {
    #[serde(rename = "streamId")]
    stream_id: Option<String>,
    #[serde(rename = "query")]
    query: Option<String>,
}

#[derive(Deserialize)]
struct GReaderSubscription {
    id: String,
    title: String,
    url: String,
    #[serde(rename = "htmlUrl")]
    #[serde(default)]
    html_url: String,
    #[serde(default)]
    categories: Vec<GReaderCategory>,
    #[serde(rename = "iconUrl")]
    icon_url: Option<String>,
}

#[derive(Deserialize)]
struct GReaderCategory {
    id: String,
    label: Option<String>,
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
    #[serde(default)]
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
}

#[derive(Deserialize)]
struct TagListResponse {
    tags: Vec<GReaderTag>,
}

#[derive(Deserialize)]
struct GReaderTag {
    id: String,
    label: Option<String>,
}

#[derive(Deserialize)]
struct UnreadCountsResponse {
    unreadcounts: Vec<UnreadCountEntry>,
}

#[derive(Deserialize)]
struct UnreadCountEntry {
    id: String,
    count: i64,
}

#[derive(Deserialize)]
struct StreamItemIdsResponse {
    #[serde(rename = "itemRefs")]
    item_refs: Option<Vec<ItemRef>>,
    continuation: Option<String>,
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
const G_READER_MAX_PAGES: usize = 100;
const G_READER_MAX_STREAM_IDS: usize = 50_000;

// --- Provider ---

/// Generic Google Reader API provider for GReader-compatible services.
pub struct GReaderProvider {
    kind: ProviderKind,
    /// Base URL for API calls (e.g., "http://server/api/greader.php")
    api_base: String,
    /// Base URL for authentication (e.g., "http://server/api/greader.php")
    auth_base: String,
    http_client: reqwest::Client,
    auth_token: Option<String>,
}

impl fmt::Debug for GReaderProvider {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("GReaderProvider")
            .field("kind", &self.kind)
            .field("api_base", &"[redacted]")
            .field("auth_base", &"[redacted]")
            .field(
                "auth_token",
                &self.auth_token.as_ref().map(|_| "[redacted]"),
            )
            .finish_non_exhaustive()
    }
}

fn freshrss_api_base(server_url: &str) -> String {
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

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return None;
            }
            let hex = &input[index + 1..index + 3];
            let value = u8::from_str_radix(hex, 16).ok()?;
            output.push(value);
            index += 3;
            continue;
        }
        output.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(output).ok()
}

fn normalize_label_remote_id(raw_id: &str, label: Option<&str>) -> Option<(String, String)> {
    let raw_label = raw_id.strip_prefix(LABEL_PREFIX)?;
    let display_label = label
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| percent_decode(raw_label))?;
    if display_label.trim().is_empty() || display_label.contains('/') {
        return None;
    }
    Some((format!("{LABEL_PREFIX}{display_label}"), display_label))
}

fn normalize_unread_count(count: i64) -> i32 {
    count.clamp(0, i64::from(i32::MAX)) as i32
}

fn normalized_url_match_key(raw_url: &str) -> Option<String> {
    let mut url = reqwest::Url::parse(raw_url.trim()).ok()?;
    url.set_fragment(None);
    Some(url.to_string())
}

fn feed_stream_url(stream_id: &str) -> Option<&str> {
    stream_id.strip_prefix("feed/")
}

fn quickadd_match_keys(requested_url: &str, response_body: &str) -> HashSet<String> {
    let mut keys = HashSet::new();
    if let Some(key) = normalized_url_match_key(requested_url) {
        keys.insert(key);
    }

    if let Ok(response) = serde_json::from_str::<QuickAddResponse>(response_body) {
        for candidate in [
            response.query.as_deref(),
            response.stream_id.as_deref().and_then(feed_stream_url),
        ]
        .into_iter()
        .flatten()
        {
            if let Some(key) = normalized_url_match_key(candidate) {
                keys.insert(key);
            }
        }
    }

    keys
}

fn quickadd_fallback_subscription(
    requested_url: &str,
    response_body: &str,
) -> Option<RemoteSubscription> {
    let response = serde_json::from_str::<QuickAddResponse>(response_body).ok()?;
    let remote_id = response.stream_id?;
    let url = feed_stream_url(&remote_id)
        .unwrap_or(requested_url)
        .to_string();
    Some(RemoteSubscription {
        remote_id,
        title: response.query.unwrap_or_else(|| requested_url.to_string()),
        url,
        site_url: requested_url.to_string(),
        folder_remote_id: None,
        icon_url: None,
    })
}

fn subscription_matches_quickadd_keys(
    subscription: &RemoteSubscription,
    quickadd_keys: &HashSet<String>,
) -> bool {
    [
        subscription.url.as_str(),
        subscription.site_url.as_str(),
        feed_stream_url(&subscription.remote_id).unwrap_or_default(),
    ]
    .into_iter()
    .filter_map(normalized_url_match_key)
    .any(|candidate_key| quickadd_keys.contains(&candidate_key))
}

fn next_ot_timestamp_usec(
    item_timestamps: &[i64],
    has_continuation: bool,
    raw_item_count: usize,
) -> Option<i64> {
    let oldest_timestamp = item_timestamps.iter().min().copied()?;
    if has_continuation || raw_item_count < STREAM_CONTENTS_LIMIT as usize {
        return Some(oldest_timestamp);
    }

    oldest_timestamp.checked_add(1).or(Some(oldest_timestamp))
}

fn valid_item_cursor_timestamp_usec(timestamp_usec: i64) -> Option<i64> {
    if timestamp_usec < 0 {
        return None;
    }
    let timestamp = DateTime::from_timestamp_micros(timestamp_usec)?;
    if timestamp > Utc::now() {
        return None;
    }
    Some(timestamp_usec)
}

fn greader_json_body_too_large_error() -> DomainError {
    DomainError::Network(format!(
        "GReader JSON response body exceeds {} bytes",
        http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
    ))
}

impl GReaderProvider {
    /// Create a provider configured for FreshRSS.
    pub fn for_freshrss(server_url: &str) -> Self {
        let base = freshrss_api_base(server_url);
        Self {
            kind: ProviderKind::FreshRss,
            api_base: base.clone(),
            auth_base: base,
            http_client: http_client_builder().build().unwrap_or_default(),
            auth_token: None,
        }
    }

    fn api_url(&self, path: &str) -> String {
        format!("{}{}", self.api_base, path)
    }

    fn auth_url(&self, path: &str) -> String {
        format!("{}{}", self.auth_base, path)
    }

    fn auth_header(&self) -> DomainResult<HeaderValue> {
        let token = self
            .auth_token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Not authenticated".into()))?;
        HeaderValue::from_str(&format!("GoogleLogin auth={token}"))
            .map_err(|e| DomainError::Auth(e.to_string()))
    }

    fn ensure_success_response(response: reqwest::Response) -> DomainResult<reqwest::Response> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }

        Err(DomainError::from_provider_http_response_status(
            status,
            response.headers(),
        ))
    }

    async fn read_json_response<T>(response: reqwest::Response) -> DomainResult<T>
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

    async fn fetch_unread_count_map(&self) -> DomainResult<HashMap<String, i32>> {
        let url = self.api_url("/reader/api/0/unread-count?output=json&all=true");
        let response = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;
        let response: UnreadCountsResponse = Self::read_json_response(response).await?;

        Ok(response
            .unreadcounts
            .into_iter()
            .map(|entry| (entry.id, normalize_unread_count(entry.count)))
            .collect())
    }

    async fn pull_entries_for_stream(
        &self,
        stream_id: &str,
        exclude_target: Option<&str>,
        cursor: Option<SyncCursor>,
        fallback_stream_id: Option<&str>,
    ) -> DomainResult<PullResult> {
        let mut url = format!(
            "{}?output=json&n={STREAM_CONTENTS_LIMIT}",
            self.api_url(&format!(
                "/reader/api/0/stream/contents/{}",
                urlencoded(stream_id)
            ))
        );

        if let Some(xt) = exclude_target {
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

        let resp = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;
        let resp: StreamContentsResponse = Self::read_json_response(resp).await?;

        let raw_item_count = resp.items.len();
        let item_timestamps = resp
            .items
            .iter()
            .filter_map(Self::item_cursor_timestamp_usec)
            .collect::<Vec<_>>();
        let repeated_continuation = resp.continuation.as_ref().is_some_and(|next| {
            cursor
                .as_ref()
                .and_then(|current| current.continuation.as_ref())
                == Some(next)
        });
        let has_more = resp.continuation.is_some() && !repeated_continuation;
        let next_since_usec = next_ot_timestamp_usec(&item_timestamps, has_more, raw_item_count);
        let next_cursor =
            if resp.continuation.is_some() || next_since_usec.is_some() || cursor.is_some() {
                Some(SyncCursor {
                    continuation: if repeated_continuation {
                        None
                    } else {
                        resp.continuation
                    },
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
            .filter_map(|item| Self::map_item_to_entry(item, fallback_stream_id))
            .collect::<Vec<_>>();
        let skipped_entries = raw_item_count.saturating_sub(entries.len());

        Ok(PullResult {
            entries,
            next_cursor,
            has_more,
            not_modified: false,
            skipped_entries,
        })
    }

    pub(crate) async fn get_unread_count_map(&self) -> DomainResult<HashMap<String, i32>> {
        self.fetch_unread_count_map().await
    }

    pub(crate) async fn pull_unread_entries_for_feed(
        &self,
        remote_id: &str,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        self.pull_entries_for_stream(remote_id, Some(STATE_READ), cursor, Some(remote_id))
            .await
    }

    fn item_cursor_timestamp_usec(item: &GReaderItem) -> Option<i64> {
        item.timestamp_usec
            .and_then(valid_item_cursor_timestamp_usec)
            .or_else(|| {
                item.updated
                    .and_then(|ts| ts.checked_mul(1_000_000))
                    .and_then(valid_item_cursor_timestamp_usec)
            })
            .or_else(|| {
                item.published
                    .and_then(|ts| ts.checked_mul(1_000_000))
                    .and_then(valid_item_cursor_timestamp_usec)
            })
    }

    fn first_non_empty_link_href(links: Option<&[GReaderLink]>) -> Option<String> {
        links?
            .iter()
            .find_map(|link| normalize_trusted_backend_article_url(&link.href))
    }

    fn item_url(item: &GReaderItem) -> Option<String> {
        Self::first_non_empty_link_href(item.alternate.as_deref())
            .or_else(|| Self::first_non_empty_link_href(item.canonical.as_deref()))
    }

    async fn pull_item_ids_page(
        &self,
        stream_id: &str,
        continuation: Option<&str>,
    ) -> DomainResult<StreamItemIdsResponse> {
        let mut url = format!(
            "{}?output=json&n={STREAM_IDS_LIMIT}&s={}",
            self.api_url("/reader/api/0/stream/items/ids"),
            urlencoded(stream_id)
        );

        if let Some(continuation) = continuation {
            url.push_str(&format!("&c={}", urlencoded(continuation)));
        }

        let response = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;
        Self::read_json_response(response).await
    }

    async fn pull_all_item_ids(&self, stream_id: &str) -> DomainResult<Vec<String>> {
        let mut ids = Vec::new();
        let mut seen_ids = HashSet::new();
        let mut continuation: Option<String> = None;

        for _ in 0..G_READER_MAX_PAGES {
            let response = self
                .pull_item_ids_page(stream_id, continuation.as_deref())
                .await?;
            for item in response.item_refs.unwrap_or_default() {
                let normalized_id = normalize_item_id(&item.id);
                if seen_ids.insert(normalized_id.clone()) {
                    ids.push(normalized_id);
                    if ids.len() > G_READER_MAX_STREAM_IDS {
                        return Err(DomainError::Network(format!(
                            "Incomplete GReader item id sync: reached {G_READER_MAX_STREAM_IDS} unique ids for stream {stream_id}"
                        )));
                    }
                }
            }

            let Some(next) = response.continuation else {
                continuation = None;
                break;
            };
            if continuation.as_deref() == Some(next.as_str()) {
                continuation = None;
                break;
            }
            continuation = Some(next);
        }

        if let Some(remaining_continuation) = continuation {
            tracing::warn!(
                stream_id,
                remaining_continuation,
                max_pages = G_READER_MAX_PAGES,
                "Incomplete GReader item id sync reached page limit"
            );
            return Err(DomainError::Network(format!(
                "Incomplete GReader item id sync: reached {G_READER_MAX_PAGES} pages with continuation remaining for stream {stream_id}: {remaining_continuation}"
            )));
        }

        Ok(ids)
    }

    fn map_item_to_entry(
        item: GReaderItem,
        fallback_stream_id: Option<&str>,
    ) -> Option<RemoteEntry> {
        let source_feed_remote_id = item
            .origin
            .as_ref()
            .map(|origin| origin.stream_id.clone())
            .or_else(|| fallback_stream_id.map(str::to_string))?;

        let url = Self::item_url(&item);

        let content = item
            .content
            .map(|c| c.content)
            .or_else(|| item.summary.as_ref().map(|s| s.content.clone()))
            .unwrap_or_default();

        let summary = item.summary.map(|s| s.content);

        let is_read = if item.categories.iter().any(|c| c == STATE_READ) {
            Some(true)
        } else {
            Some(false)
        };

        let is_starred = if item.categories.iter().any(|c| c == STATE_STARRED) {
            Some(true)
        } else {
            Some(false)
        };

        let published_at = item
            .published
            .or(item.updated)
            .and_then(|ts| DateTime::from_timestamp(ts, 0));

        let updated_at = item.updated.and_then(|ts| DateTime::from_timestamp(ts, 0));

        Some(RemoteEntry {
            id: Some(item.id),
            source_feed_id: FeedIdentifier::Remote {
                remote_id: source_feed_remote_id,
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
        self.kind.capabilities()
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
            .http_client
            .post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?;

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

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        let url = self.api_url("/reader/api/0/subscription/list?output=json");
        let resp = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;
        let resp: SubscriptionListResponse = Self::read_json_response(resp).await?;

        let subscriptions = resp
            .subscriptions
            .into_iter()
            .map(|s| {
                let folder_remote_id = s.categories.iter().find_map(|category| {
                    normalize_label_remote_id(&category.id, category.label.as_deref())
                        .map(|(remote_id, _)| remote_id)
                });
                RemoteSubscription {
                    remote_id: s.id,
                    title: s.title,
                    url: s.url,
                    site_url: normalize_provider_metadata_url(&s.html_url).unwrap_or_default(),
                    folder_remote_id,
                    icon_url: s
                        .icon_url
                        .and_then(|icon_url| normalize_provider_metadata_url(&icon_url)),
                }
            })
            .collect();

        Ok(subscriptions)
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        let url = self.api_url("/reader/api/0/tag/list?output=json");
        let resp = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;
        let resp: TagListResponse = Self::read_json_response(resp).await?;

        let folders = resp
            .tags
            .into_iter()
            .filter_map(|tag| {
                normalize_label_remote_id(&tag.id, tag.label.as_deref()).map(|(remote_id, name)| {
                    RemoteFolder {
                        remote_id,
                        name,
                        sort_order: None,
                    }
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

        let fallback_stream_id = match &scope {
            PullScope::Feed(FeedIdentifier::Remote { remote_id }) => Some(remote_id.as_str()),
            _ => None,
        };

        self.pull_entries_for_stream(
            &stream_id,
            exclude_target.as_deref(),
            cursor,
            fallback_stream_id,
        )
        .await
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        let (read_resp, starred_resp) = tokio::try_join!(
            self.pull_all_item_ids(STATE_READ),
            self.pull_all_item_ids(STATE_STARRED)
        )?;

        Ok(RemoteState {
            read_ids: read_resp,
            starred_ids: starred_resp,
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

            self.http_client
                .post(&url)
                .header("Authorization", auth.clone())
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(body)
                .send()
                .await
                .map_err(DomainError::from_provider_http_error)
                .and_then(Self::ensure_success_response)?;
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
            .http_client
            .post(&api_url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;

        let response_body = resp.text().await?;

        // After quickadd, fetch subscriptions to find the new one. If the
        // verification fetch fails after the remote mutation succeeded, keep a
        // minimal local subscription when the quickadd response gives us a stream id.
        let subs = match self.get_subscriptions().await {
            Ok(subs) => subs,
            Err(error) => {
                if let Some(subscription) = quickadd_fallback_subscription(url, &response_body) {
                    tracing::warn!(
                        "GReader quickadd succeeded but subscription verification failed: {error}"
                    );
                    return Ok(subscription);
                }
                return Err(error);
            }
        };
        let quickadd_keys = quickadd_match_keys(url, &response_body);
        let mut matches = subs
            .into_iter()
            .filter(|subscription| subscription_matches_quickadd_keys(subscription, &quickadd_keys))
            .collect::<Vec<_>>();

        match matches.len() {
            1 => Ok(matches.remove(0)),
            0 => Err(DomainError::Validation(format!(
                "Subscription was created but could not be found by feed URL: {url}"
            ))),
            _ => Err(DomainError::Validation(format!(
                "Subscription was created but feed URL match is ambiguous: {url}"
            ))),
        }
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

        self.http_client
            .post(&url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;

        Ok(())
    }

    async fn edit_subscription(
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

        self.http_client
            .post(&url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(DomainError::from_provider_http_error)
            .and_then(Self::ensure_success_response)?;

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
    use crate::commands::dto::AppError;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::borrow::Cow;
    use std::io::Write;

    struct ProviderHttpResponseFixture<'a> {
        status: usize,
        headers: &'a [(&'a str, &'a str)],
        body: Cow<'a, str>,
    }

    impl<'a> ProviderHttpResponseFixture<'a> {
        fn ok(body: &'static str) -> ProviderHttpResponseFixture<'static> {
            ProviderHttpResponseFixture {
                status: 200,
                headers: &[],
                body: Cow::Borrowed(body),
            }
        }

        fn json(body: &'static str) -> ProviderHttpResponseFixture<'static> {
            Self::ok(body).with_headers(&[("content-type", "application/json")])
        }

        fn malformed_json() -> ProviderHttpResponseFixture<'static> {
            Self::json(r#"{ "items": ["#)
        }

        fn item_refs_page(
            item_ids: &[&str],
            continuation: Option<&str>,
        ) -> ProviderHttpResponseFixture<'static> {
            let item_refs = item_ids
                .iter()
                .map(|id| format!(r#"{{ "id": "{id}" }}"#))
                .collect::<Vec<_>>()
                .join(", ");
            let continuation = continuation
                .map(|value| format!(r#", "continuation": "{value}""#))
                .unwrap_or_default();
            ProviderHttpResponseFixture {
                status: 200,
                headers: &[("content-type", "application/json")],
                body: Cow::Owned(format!(r#"{{ "itemRefs": [{item_refs}]{continuation} }}"#)),
            }
        }

        fn status(status: usize) -> ProviderHttpResponseFixture<'static> {
            ProviderHttpResponseFixture {
                status,
                headers: &[],
                body: Cow::Borrowed(""),
            }
        }

        fn with_headers(self, headers: &'a [(&'a str, &'a str)]) -> Self {
            ProviderHttpResponseFixture {
                status: self.status,
                headers,
                body: self.body,
            }
        }
    }

    trait ProviderMockResponseExt {
        fn with_greader_response(self, response: ProviderHttpResponseFixture<'_>) -> Self;
    }

    impl ProviderMockResponseExt for mockito::Mock {
        fn with_greader_response(self, response: ProviderHttpResponseFixture<'_>) -> Self {
            apply_provider_response(self, response)
        }
    }

    fn apply_provider_response(
        mock: mockito::Mock,
        response: ProviderHttpResponseFixture<'_>,
    ) -> mockito::Mock {
        response.headers.iter().fold(
            mock.with_status(response.status)
                .with_body(response.body.as_ref()),
            |mock, (name, value)| mock.with_header(*name, value),
        )
    }

    fn oversized_json_body() -> String {
        format!(
            r#"{{ "padding": "{}" }}"#,
            "x".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize)
        )
    }

    fn gzip_body(body: &str) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(body.as_bytes())
            .expect("gzip fixture should encode");
        encoder.finish().expect("gzip fixture should finish")
    }

    fn greader_json_body_limit_error_message() -> String {
        format!(
            "GReader JSON response body exceeds {} bytes",
            http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
        )
    }

    #[test]
    fn for_freshrss_appends_greader_endpoint_to_base_url() {
        let provider = GReaderProvider::for_freshrss("https://freshrss.example.com");

        assert_eq!(
            provider.api_base,
            "https://freshrss.example.com/api/greader.php"
        );
        assert_eq!(
            provider.auth_base,
            "https://freshrss.example.com/api/greader.php"
        );
    }

    #[test]
    fn for_freshrss_normalizes_trailing_slashes_before_appending_greader_endpoint() {
        let provider = GReaderProvider::for_freshrss("https://freshrss.example.com///");

        assert_eq!(
            provider.api_base,
            "https://freshrss.example.com/api/greader.php"
        );
        assert_eq!(
            provider.auth_base,
            "https://freshrss.example.com/api/greader.php"
        );
    }

    #[test]
    fn for_freshrss_accepts_full_greader_endpoint_without_duplication() {
        let provider =
            GReaderProvider::for_freshrss("https://freshrss.example.com/api/greader.php");

        assert_eq!(
            provider.api_base,
            "https://freshrss.example.com/api/greader.php"
        );
        assert_eq!(
            provider.auth_base,
            "https://freshrss.example.com/api/greader.php"
        );
    }

    #[test]
    fn for_freshrss_normalizes_trailing_slash_after_full_greader_endpoint() {
        let provider =
            GReaderProvider::for_freshrss("https://freshrss.example.com/api/greader.php/");

        assert_eq!(
            provider.api_base,
            "https://freshrss.example.com/api/greader.php"
        );
        assert_eq!(
            provider.auth_base,
            "https://freshrss.example.com/api/greader.php"
        );
    }

    #[test]
    fn for_freshrss_trims_surrounding_whitespace() {
        let provider =
            GReaderProvider::for_freshrss("  https://freshrss.example.com/api/greader.php  ");

        assert_eq!(
            provider.api_base,
            "https://freshrss.example.com/api/greader.php"
        );
        assert_eq!(
            provider.auth_base,
            "https://freshrss.example.com/api/greader.php"
        );
    }

    #[test]
    fn for_freshrss_preserves_loopback_http_base_url() {
        let provider = GReaderProvider::for_freshrss("http://localhost:8080/");

        assert_eq!(provider.api_base, "http://localhost:8080/api/greader.php");
        assert_eq!(provider.auth_base, "http://localhost:8080/api/greader.php");
    }

    #[test]
    fn for_freshrss_strips_url_credentials_before_building_auth_base() {
        let provider = GReaderProvider::for_freshrss("https://alice:secret@freshrss.example.com/");

        assert_eq!(
            provider.api_base,
            "https://freshrss.example.com/api/greader.php"
        );
        assert_eq!(
            provider.auth_base,
            "https://freshrss.example.com/api/greader.php"
        );
    }

    #[test]
    fn normalize_label_remote_id_decodes_missing_label() {
        assert_eq!(
            normalize_label_remote_id("user/-/label/Dev%20News", None),
            Some(("user/-/label/Dev News".to_string(), "Dev News".to_string()))
        );
    }

    #[test]
    fn normalize_label_remote_id_prefers_label_over_encoded_id() {
        assert_eq!(
            normalize_label_remote_id("user/-/label/Encoded%20Id", Some("Display Name")),
            Some((
                "user/-/label/Display Name".to_string(),
                "Display Name".to_string(),
            ))
        );
    }

    #[test]
    fn normalize_label_remote_id_rejects_invalid_or_path_like_labels() {
        assert_eq!(normalize_label_remote_id("user/-/label/Bad%ZZ", None), None);
        assert_eq!(
            normalize_label_remote_id("user/-/label/Bad%2FName", None),
            None
        );
        assert_eq!(
            normalize_label_remote_id("user/-/label/Encoded", Some("Bad/Name")),
            None
        );
        assert_eq!(normalize_label_remote_id("user/-/label/%20%20", None), None);
        assert_eq!(normalize_label_remote_id(STATE_READ, None), None);
    }

    #[test]
    fn normalize_label_remote_id_trims_unicode_label_for_folder_contract() {
        assert_eq!(
            normalize_label_remote_id("user/-/label/%E9%96%8B%E7%99%BA", Some(" 開発 ")),
            Some(("user/-/label/開発".to_string(), "開発".to_string()))
        );
    }

    #[test]
    fn item_cursor_timestamp_policy_ignores_invalid_clock_values() {
        let future_usec = (Utc::now() + chrono::Duration::hours(1)).timestamp_micros();

        assert_eq!(valid_item_cursor_timestamp_usec(-1), None);
        assert_eq!(valid_item_cursor_timestamp_usec(i64::MAX), None);
        assert_eq!(valid_item_cursor_timestamp_usec(future_usec), None);
        assert_eq!(
            valid_item_cursor_timestamp_usec(1_700_000_000_000_000),
            Some(1_700_000_000_000_000)
        );
    }

    #[tokio::test]
    async fn get_unread_count_map_normalizes_counts_and_keeps_last_duplicate_entry() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::ok(
                r#"{
                    "unreadcounts": [
                        { "id": "feed/https://example.com/rss", "count": 4 },
                        { "id": "feed/https://example.com/negative", "count": -2 },
                        { "id": "feed/https://example.com/overflow", "count": 2147483648 },
                        { "id": "feed/https://example.com/rss", "count": 7 }
                    ]
                }"#,
            ))
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

        let unread_counts = provider.get_unread_count_map().await.unwrap();

        assert_eq!(unread_counts.get("feed/https://example.com/rss"), Some(&7));
        assert_eq!(
            unread_counts.get("feed/https://example.com/negative"),
            Some(&0)
        );
        assert_eq!(
            unread_counts.get("feed/https://example.com/overflow"),
            Some(&i32::MAX)
        );
    }

    #[tokio::test]
    async fn greader_rate_limit_preserves_retry_after_seconds_as_structured_error() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
            .create_async()
            .await;

        let subscriptions = server
            .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
            .match_query(mockito::Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(
                ProviderHttpResponseFixture::status(429).with_headers(&[("retry-after", "120")]),
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

        let error = provider
            .get_subscriptions()
            .await
            .expect_err("429 should surface as rate limit");

        assert!(matches!(
            error,
            DomainError::RateLimitWithRetryAfter {
                message,
                retry_after_seconds: 120
            } if message == "HTTP 429 Too Many Requests"
        ));
        subscriptions.assert_async().await;
    }

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
    async fn authenticate_request_sends_no_store_headers() {
        let mut server = mockito::Server::new_async().await;
        let auth_mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_header("Content-Type", "application/x-www-form-urlencoded")
            .match_header("Cache-Control", "no-store")
            .match_header("Pragma", "no-cache")
            .with_status(200)
            .with_body("Auth=test-token-123\n")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("secret-password".into()),
                token: Some("secret-user@example.com".into()),
            })
            .await
            .expect("auth request should include provider no-store headers");

        auth_mock.assert_async().await;
    }

    #[tokio::test]
    async fn authenticate_maps_provider_http_status_categories() {
        let cases = [
            (401, "Auth error: HTTP 401 Unauthorized"),
            (403, "Auth error: HTTP 403 Forbidden"),
            (429, "Rate limit error: HTTP 429 Too Many Requests"),
            (502, "Network error: HTTP 502 Bad Gateway"),
        ];

        for (status, expected_message) in cases {
            let mut server = mockito::Server::new_async().await;
            let auth_mock = server
                .mock("POST", "/api/greader.php/accounts/ClientLogin")
                .match_header("Content-Type", "application/x-www-form-urlencoded")
                .with_status(status)
                .create_async()
                .await;

            let mut provider = GReaderProvider::for_freshrss(&server.url());
            let error = provider
                .authenticate(&Credentials {
                    password: Some("p".into()),
                    token: Some("u".into()),
                })
                .await
                .expect_err("auth status errors should preserve domain failure category");

            assert_eq!(error.to_string(), expected_message);
            auth_mock.assert_async().await;
        }
    }

    #[tokio::test]
    async fn authenticate_preserves_retry_after_seconds_for_rate_limit() {
        let mut server = mockito::Server::new_async().await;
        let auth_mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_header("Content-Type", "application/x-www-form-urlencoded")
            .with_status(429)
            .with_header("Retry-After", "180")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        let error = provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .expect_err("rate limit should preserve retry-after seconds");

        assert_eq!(
            error.to_string(),
            "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=180"
        );
        auth_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_subscriptions_preserves_retry_after_seconds_for_rate_limit() {
        let mut server = mockito::Server::new_async().await;
        let subs_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
            .match_query(mockito::Matcher::UrlEncoded(
                "output".to_string(),
                "json".to_string(),
            ))
            .with_status(429)
            .with_header("Retry-After", "240")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider.auth_token = Some("token".to_string());
        let error = provider
            .get_subscriptions()
            .await
            .expect_err("rate limit should preserve retry-after seconds");

        assert_eq!(
            error.to_string(),
            "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=240"
        );
        subs_mock.assert_async().await;
    }

    #[tokio::test]
    async fn redaction_authenticate_auth_failure_does_not_surface_credentials() {
        let mut server = mockito::Server::new_async().await;
        let auth_mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_header("Content-Type", "application/x-www-form-urlencoded")
            .with_status(401)
            .create_async()
            .await;
        let username = "secret-user@example.com";
        let password = "secret-password";

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        let error = provider
            .authenticate(&Credentials {
                password: Some(password.into()),
                token: Some(username.into()),
            })
            .await
            .expect_err("auth failure should return a domain error");
        let domain_message = error.to_string();

        assert_eq!(domain_message, "Auth error: HTTP 401 Unauthorized");
        assert!(!domain_message.contains(username));
        assert!(!domain_message.contains(password));

        match AppError::from(error) {
            AppError::UserVisible { message } => {
                assert_eq!(message, "Auth error: HTTP 401 Unauthorized");
                assert!(!message.contains(username));
                assert!(!message.contains(password));
            }
            AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
                panic!("auth failures should remain user visible: {message}");
            }
        }
        auth_mock.assert_async().await;
    }

    #[test]
    fn redaction_debug_output_redacts_greader_auth_token() {
        let mut provider = GReaderProvider::for_freshrss(
            "https://secret-user:secret-password@freshrss.example.com",
        );
        provider.auth_token = Some("secret-auth-token".into());

        let debug_output = format!("{provider:?}");

        assert!(debug_output.contains("[redacted]"));
        assert!(!debug_output.contains("secret-auth-token"));
        assert!(!debug_output.contains("secret-user"));
        assert!(!debug_output.contains("secret-password"));
        assert!(!debug_output.contains("freshrss.example.com"));
    }

    #[test]
    fn redaction_auth_header_error_does_not_surface_greader_auth_token() {
        let mut provider = GReaderProvider::for_freshrss("https://freshrss.example.com");
        provider.auth_token = Some("secret-auth-token\ninvalid".into());

        let error = provider
            .auth_header()
            .expect_err("invalid header token should fail");
        let message = error.to_string();

        assert!(matches!(error, DomainError::Auth(_)));
        assert!(!message.contains("secret-auth-token"));
        assert!(!message.contains("invalid"));
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
                                {"id": "user/-/state/com.google/reading-list", "label": "reading-list"},
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
    async fn get_subscriptions_allows_missing_categories_and_html_url() {
        let mut server = mockito::Server::new_async().await;
        server
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
                            "url": "https://example.com/rss"
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
        assert_eq!(subs[0].remote_id, "feed/https://example.com/rss");
        assert_eq!(subs[0].site_url, "");
        assert_eq!(subs[0].folder_remote_id, None);
        sub_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_subscriptions_applies_metadata_url_policy_fixtures() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
            .create_async()
            .await;

        let sub_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/subscription/list?output=json",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::ok(
                r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/javascript",
                            "title": "JavaScript URL",
                            "url": "https://example.com/javascript",
                            "htmlUrl": "javascript:alert(1)",
                            "iconUrl": "data:image/png;base64,abc"
                        },
                        {
                            "id": "feed/https://example.com/ok",
                            "title": "OK Feed",
                            "url": "https://example.com/ok",
                            "htmlUrl": " https://example.com/home#section ",
                            "iconUrl": "https://example.com/icon.png"
                        },
                        {
                            "id": "feed/https://example.com/relative",
                            "title": "Relative URL",
                            "url": "https://example.com/relative",
                            "htmlUrl": "//example.com/home",
                            "iconUrl": "/icon.png"
                        },
                        {
                            "id": "feed/https://example.com/userinfo",
                            "title": "Credential URL",
                            "url": "https://example.com/userinfo",
                            "htmlUrl": "https://alice:secret@example.com/home",
                            "iconUrl": "https://alice:secret@example.com/icon.png"
                        },
                        {
                            "id": "feed/https://example.com/unicode",
                            "title": "Unicode Host",
                            "url": "https://example.com/unicode",
                            "htmlUrl": "https://例え.テスト/home",
                            "iconUrl": "https://例え.テスト/icon.png#private"
                        }
                    ]
                }"#,
            ))
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

        assert_eq!(subs[0].site_url, "");
        assert_eq!(subs[0].icon_url, None);
        assert_eq!(subs[1].site_url, "https://example.com/home");
        assert_eq!(
            subs[1].icon_url.as_deref(),
            Some("https://example.com/icon.png")
        );
        assert_eq!(subs[2].site_url, "");
        assert_eq!(subs[2].icon_url, None);
        assert_eq!(subs[3].site_url, "");
        assert_eq!(subs[3].icon_url, None);
        assert_eq!(subs[4].site_url, "https://xn--r8jz45g.xn--zckzah/home");
        assert_eq!(
            subs[4].icon_url.as_deref(),
            Some("https://xn--r8jz45g.xn--zckzah/icon.png")
        );
        sub_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_subscriptions_normalizes_label_remote_ids() {
        let mut server = mockito::Server::new_async().await;
        server
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
                            "id": "feed/https://example.com/dev",
                            "title": "Dev Feed",
                            "url": "https://example.com/dev",
                            "htmlUrl": "https://example.com/dev",
                            "categories": [
                                {"id": "user/-/label/Dev%20News"}
                            ]
                        },
                        {
                            "id": "feed/https://example.com/display",
                            "title": "Display Feed",
                            "url": "https://example.com/display",
                            "htmlUrl": "https://example.com/display",
                            "categories": [
                                {"id": "user/-/label/Encoded%20Id", "label": "Display Name"}
                            ]
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

        assert_eq!(
            subs.iter()
                .map(|sub| sub.folder_remote_id.as_deref())
                .collect::<Vec<_>>(),
            [
                Some("user/-/label/Dev News"),
                Some("user/-/label/Display Name")
            ]
        );
        sub_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_subscriptions_maps_provider_http_status_categories() {
        let cases = [
            (401, "Auth error: HTTP 401 Unauthorized"),
            (429, "Rate limit error: HTTP 429 Too Many Requests"),
            (502, "Network error: HTTP 502 Bad Gateway"),
        ];

        for (status, expected_message) in cases {
            let mut server = mockito::Server::new_async().await;
            server
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
                .with_status(status)
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

            let error = provider.get_subscriptions().await.unwrap_err();

            assert_eq!(error.to_string(), expected_message);
            sub_mock.assert_async().await;
        }
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
    async fn get_folders_normalizes_url_encoded_label_ids_and_label_fields() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list?output=json")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "tags": [
                        {"id": "user/-/label/Dev%20News"},
                        {"id": "user/-/label/Encoded%20Id", "label": "Display Name"}
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

        assert_eq!(
            folders
                .iter()
                .map(|folder| folder.remote_id.as_str())
                .collect::<Vec<_>>(),
            ["user/-/label/Dev News", "user/-/label/Display Name"]
        );
        assert_eq!(
            folders
                .iter()
                .map(|folder| folder.name.as_str())
                .collect::<Vec<_>>(),
            ["Dev News", "Display Name"]
        );
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
            .with_greader_response(ProviderHttpResponseFixture::json(
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
            ))
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
        assert_eq!(result.skipped_entries, 1);

        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_defaults_missing_item_categories_to_unread_and_unstarred() {
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
                            "id": "entry-without-categories",
                            "title": "Missing categories",
                            "alternate": [{"href": "https://example.com/missing-categories"}],
                            "summary": {"content": "Summary"},
                            "published": 1700000000,
                            "updated": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            }
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

        let result = provider.pull_entries(PullScope::All, None).await.unwrap();

        assert_eq!(result.entries.len(), 1);
        assert_eq!(
            result.entries[0].id.as_deref(),
            Some("entry-without-categories")
        );
        assert_eq!(result.entries[0].is_read, Some(false));
        assert_eq!(result.entries[0].is_starred, Some(false));
        stream_mock.assert_async().await;
    }

    #[test]
    fn map_item_to_entry_uses_exact_read_and_starred_state_ids() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Exact state ids only".to_string()),
            canonical: None,
            alternate: None,
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![
                format!("{STATE_READ}/archive"),
                format!("label/{STATE_STARRED}"),
                STATE_READING_LIST.to_string(),
            ],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        assert_eq!(entry.is_read, Some(false));
        assert_eq!(entry.is_starred, Some(false));
    }

    #[test]
    fn map_item_to_entry_uses_updated_as_published_fallback() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Updated fallback".to_string()),
            canonical: None,
            alternate: None,
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: Some(1_700_000_100),
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        let expected = DateTime::from_timestamp(1_700_000_100, 0);
        assert_eq!(entry.published_at, expected);
        assert_eq!(entry.updated_at, expected);
    }

    #[test]
    fn map_item_to_entry_uses_alternate_before_canonical_url_fallback() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Canonical fallback".to_string()),
            canonical: Some(vec![
                GReaderLink {
                    href: String::new(),
                },
                GReaderLink {
                    href: "https://example.com/canonical".to_string(),
                },
            ]),
            alternate: Some(vec![
                GReaderLink {
                    href: String::new(),
                },
                GReaderLink {
                    href: "https://example.com/alternate".to_string(),
                },
            ]),
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        assert_eq!(entry.url.as_deref(), Some("https://example.com/alternate"));
    }

    #[test]
    fn map_item_to_entry_uses_canonical_url_when_alternate_is_missing() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Canonical fallback".to_string()),
            canonical: Some(vec![
                GReaderLink {
                    href: String::new(),
                },
                GReaderLink {
                    href: "https://example.com/canonical".to_string(),
                },
            ]),
            alternate: None,
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        assert_eq!(entry.url.as_deref(), Some("https://example.com/canonical"));
    }

    #[test]
    fn map_item_to_entry_normalizes_canonical_url_with_article_link_policy() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Canonical fallback".to_string()),
            canonical: Some(vec![GReaderLink {
                href: " HTTPS://Example.COM:443/Article?utm_source=reader#tracking ".to_string(),
            }]),
            alternate: None,
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        assert_eq!(
            entry.url.as_deref(),
            Some("https://example.com/Article?utm_source=reader")
        );
    }

    #[test]
    fn map_item_to_entry_uses_canonical_url_when_alternate_href_is_blank() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Canonical fallback".to_string()),
            canonical: Some(vec![GReaderLink {
                href: "https://example.com/canonical".to_string(),
            }]),
            alternate: Some(vec![GReaderLink {
                href: " \n\t ".to_string(),
            }]),
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        assert_eq!(entry.url.as_deref(), Some("https://example.com/canonical"));
    }

    #[test]
    fn map_item_to_entry_strips_url_credentials_and_fragment() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Private URL".to_string()),
            canonical: None,
            alternate: Some(vec![GReaderLink {
                href: "https://alice:secret@example.com/article#token".to_string(),
            }]),
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        assert_eq!(entry.url.as_deref(), Some("https://example.com/article"));
    }

    #[test]
    fn map_item_to_entry_skips_invalid_article_urls() {
        let item = GReaderItem {
            id: "entry-1".to_string(),
            title: Some("Invalid URL".to_string()),
            canonical: Some(vec![GReaderLink {
                href: "https://example.com/canonical".to_string(),
            }]),
            alternate: Some(vec![
                GReaderLink {
                    href: "javascript:alert(1)".to_string(),
                },
                GReaderLink {
                    href: "https://example.com/alternate\u{8}".to_string(),
                },
            ]),
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: vec![],
        };

        let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

        assert_eq!(entry.url.as_deref(), Some("https://example.com/canonical"));
    }

    #[tokio::test]
    async fn pull_entries_for_feed_scope_uses_requested_stream_when_origin_is_missing() {
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
                            "title": "Feed-scoped Article",
                            "alternate": [{"href": "https://example.com/article"}],
                            "summary": {"content": "Short summary"},
                            "content": {"content": "<p>Full content</p>"},
                            "author": "Alice",
                            "timestampUsec": "1700000100000000",
                            "published": 1700000000,
                            "updated": 1700000100,
                            "categories": [
                                "user/-/state/com.google/reading-list"
                            ]
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

        let result = provider
            .pull_entries(
                PullScope::Feed(FeedIdentifier::Remote {
                    remote_id: "feed/2".to_string(),
                }),
                None,
            )
            .await
            .unwrap();

        assert_eq!(result.entries.len(), 1);
        match &result.entries[0].source_feed_id {
            FeedIdentifier::Remote { remote_id } => {
                assert_eq!(remote_id, "feed/2");
            }
            _ => panic!("Expected Remote feed identifier"),
        }
        assert_eq!(result.skipped_entries, 0);

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

    #[tokio::test]
    async fn pull_entries_uses_oldest_timestamp_for_ot_cursor_fallback() {
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
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "newer",
                            "title": "Newer",
                            "timestampUsec": "1700000200000000",
                            "origin": { "streamId": "feed/https://example.com/rss" }
                        },
                        {
                            "id": "older",
                            "title": "Older",
                            "timestampUsec": "1700000100000000",
                            "origin": { "streamId": "feed/https://example.com/rss" }
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

        let result = provider.pull_entries(PullScope::All, None).await.unwrap();

        assert_eq!(
            result
                .next_cursor
                .and_then(|cursor| cursor.since)
                .map(|timestamp| timestamp.timestamp_micros()),
            Some(1_700_000_100_000_000)
        );
        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_keeps_equal_timestamp_reachable_when_ot_fallback_page_is_full() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let items = (0..STREAM_CONTENTS_LIMIT)
            .map(|index| {
                format!(
                    r#"{{
                        "id": "entry-{index}",
                        "title": "Entry {index}",
                        "timestampUsec": "1700000100000000",
                        "origin": {{ "streamId": "feed/https://example.com/rss" }}
                    }}"#
                )
            })
            .collect::<Vec<_>>()
            .join(",");
        let body = format!(r#"{{ "items": [{items}] }}"#);

        let stream_mock = server
            .mock(
                "GET",
                mockito::Matcher::Regex(
                    r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
                ),
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(body)
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

        assert_eq!(result.entries.len(), STREAM_CONTENTS_LIMIT as usize);
        assert_eq!(
            result
                .next_cursor
                .and_then(|cursor| cursor.since)
                .map(|timestamp| timestamp.timestamp_micros()),
            Some(1_700_000_100_000_001)
        );
        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_stops_when_continuation_repeats() {
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
                mockito::Matcher::UrlEncoded("c".into(), "same-page".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::json(
                r#"{ "items": [], "continuation": "same-page" }"#,
            ))
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

        let result = provider
            .pull_entries(
                PullScope::All,
                Some(SyncCursor {
                    continuation: Some("same-page".to_string()),
                    since: None,
                    etag: None,
                    last_modified: None,
                }),
            )
            .await
            .unwrap();

        assert!(!result.has_more);
        assert_eq!(
            result.next_cursor.and_then(|cursor| cursor.continuation),
            None
        );
        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_surfaces_malformed_json_fixture_error() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
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
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::malformed_json())
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

        provider
            .pull_entries(PullScope::All, None)
            .await
            .expect_err("malformed provider JSON should surface a parse error");
        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_unread_count_map_rejects_oversized_json_before_parse_without_secret_diagnostics() {
        let mut server = mockito::Server::new_async().await;
        let token = "secret-auth-token";
        let unread_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=secret-auth-token")
            .with_status(200)
            .with_body(oversized_json_body())
            .with_header("content-type", "application/json")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider.auth_token = Some(token.to_string());

        let error = provider
            .get_unread_count_map()
            .await
            .expect_err("oversized unread-count JSON should be rejected before parsing");
        let message = error.to_string();

        assert_eq!(
            message,
            format!("Network error: {}", greader_json_body_limit_error_message())
        );
        assert!(!message.contains(token));
        assert!(!message.contains(&server.url()));
        unread_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_rejects_oversized_stream_contents_json_before_parse() {
        let mut server = mockito::Server::new_async().await;
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
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(oversized_json_body())
            .with_header("content-type", "application/json")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider.auth_token = Some("tok".to_string());

        let error = provider
            .pull_entries(PullScope::All, None)
            .await
            .expect_err("oversized stream contents JSON should be rejected before parsing");

        assert!(matches!(
            error,
            DomainError::Network(message) if message == greader_json_body_limit_error_message()
        ));
        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_item_ids_page_rejects_oversized_json_before_parse() {
        let mut server = mockito::Server::new_async().await;
        let ids_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(oversized_json_body())
            .with_header("content-type", "application/json")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider.auth_token = Some("tok".to_string());

        let result = provider.pull_item_ids_page(STATE_READ, None).await;
        let Err(error) = result else {
            panic!("oversized item IDs JSON should be rejected before parsing");
        };

        assert!(matches!(
            error,
            DomainError::Network(message) if message == greader_json_body_limit_error_message()
        ));
        ids_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_unread_count_map_rejects_gzip_decoded_oversized_json_before_parse() {
        let oversized_body = oversized_json_body();
        let compressed_body = gzip_body(&oversized_body);
        assert!(
            compressed_body.len() < http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize,
            "fixture must be compressed below the cap to prove decoded size is enforced"
        );

        let mut server = mockito::Server::new_async().await;
        let unread_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(compressed_body)
            .with_header("content-type", "application/json")
            .with_header("content-encoding", "gzip")
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider.auth_token = Some("tok".to_string());

        let error = provider
            .get_unread_count_map()
            .await
            .expect_err("gzip-decoded oversized GReader JSON should be rejected before parsing");

        assert!(matches!(
            error,
            DomainError::Network(message) if message == greader_json_body_limit_error_message()
        ));
        unread_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_state_requests_read_and_starred_stream_ids_with_valid_queries() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let read_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
            .create_async()
            .await;

        let starred_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
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

        let state = provider.pull_state().await.unwrap();

        assert!(state.read_ids.is_empty());
        assert!(state.starred_ids.is_empty());
        read_mock.assert_async().await;
        starred_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_state_follows_continuation_until_all_ids_are_loaded() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let read_page_1 = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::item_refs_page(
                &["1"],
                Some("read-next"),
            ))
            .create_async()
            .await;

        let read_page_2 = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
                mockito::Matcher::UrlEncoded("c".into(), "read-next".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::item_refs_page(&["2"], None))
            .create_async()
            .await;

        let starred_page_1 = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::item_refs_page(
                &["3"],
                Some("star-next"),
            ))
            .create_async()
            .await;

        let starred_page_2 = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
                mockito::Matcher::UrlEncoded("c".into(), "star-next".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_greader_response(ProviderHttpResponseFixture::item_refs_page(&["4"], None))
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

        let state = provider.pull_state().await.unwrap();

        assert_eq!(
            state.read_ids,
            vec![
                "tag:google.com,2005:reader/item/0000000000000001".to_string(),
                "tag:google.com,2005:reader/item/0000000000000002".to_string(),
            ]
        );
        assert_eq!(
            state.starred_ids,
            vec![
                "tag:google.com,2005:reader/item/0000000000000003".to_string(),
                "tag:google.com,2005:reader/item/0000000000000004".to_string(),
            ]
        );
        read_page_1.assert_async().await;
        read_page_2.assert_async().await;
        starred_page_1.assert_async().await;
        starred_page_2.assert_async().await;
    }

    #[tokio::test]
    async fn pull_state_dedupes_stream_ids_before_memory_cap_counting() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let read_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [{ "id": "1" }, { "id": "1" }, { "id": "2" }] }"#)
            .create_async()
            .await;

        let starred_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
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

        let state = provider.pull_state().await.unwrap();

        assert_eq!(
            state.read_ids,
            vec![
                "tag:google.com,2005:reader/item/0000000000000001".to_string(),
                "tag:google.com,2005:reader/item/0000000000000002".to_string(),
            ]
        );
        read_mock.assert_async().await;
        starred_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_state_stops_when_ids_continuation_repeats() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let read_page_1 = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [{ "id": "1" }], "continuation": "repeat" }"#)
            .create_async()
            .await;

        let read_page_2 = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
                mockito::Matcher::UrlEncoded("c".into(), "repeat".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [{ "id": "2" }], "continuation": "repeat" }"#)
            .create_async()
            .await;

        let starred_page = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
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

        let state = provider.pull_state().await.unwrap();

        assert_eq!(
            state.read_ids,
            vec![
                "tag:google.com,2005:reader/item/0000000000000001".to_string(),
                "tag:google.com,2005:reader/item/0000000000000002".to_string(),
            ]
        );
        assert!(state.starred_ids.is_empty());
        read_page_1.assert_async().await;
        read_page_2.assert_async().await;
        starred_page.assert_async().await;
    }

    #[tokio::test]
    async fn pull_all_item_ids_errors_when_max_pages_leave_continuation() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let mut page_mocks = Vec::new();
        for page in 0..G_READER_MAX_PAGES {
            let mut query_matchers = vec![
                mockito::Matcher::UrlEncoded("output".into(), "json".into()),
                mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
                mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            ];
            if page > 0 {
                query_matchers.push(mockito::Matcher::UrlEncoded(
                    "c".into(),
                    format!("page-{page}"),
                ));
            }

            page_mocks.push(
                server
                    .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
                    .match_query(mockito::Matcher::AllOf(query_matchers))
                    .match_header("Authorization", "GoogleLogin auth=tok")
                    .with_status(200)
                    .with_body(format!(
                        r#"{{ "itemRefs": [{{ "id": "{page}" }}], "continuation": "page-{}" }}"#,
                        page + 1
                    ))
                    .create_async()
                    .await,
            );
        }

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let error = provider
            .pull_all_item_ids(STATE_READ)
            .await
            .expect_err("remaining continuation after max pages should fail");

        assert!(matches!(error, DomainError::Network(_)));
        assert_eq!(
            error.to_string(),
            "Network error: Incomplete GReader item id sync: reached 100 pages with continuation remaining for stream user/-/state/com.google/read: page-100"
        );
        for page_mock in page_mocks {
            page_mock.assert_async().await;
        }
    }

    // === Live integration tests ===
    // Run with: dotenvx run -- cargo test --manifest-path src-tauri/Cargo.toml freshrss_live -- --ignored
    // Or: mise test:live

    struct LiveFreshRssCredentials {
        url: String,
        user: String,
        pass: String,
    }

    fn live_freshrss_credentials() -> Option<LiveFreshRssCredentials> {
        let url = std::env::var("FRESHRSS_URL").ok()?;
        let user = std::env::var("FRESHRSS_USER").ok()?;
        let pass = std::env::var("FRESHRSS_PASS").ok()?;
        Some(LiveFreshRssCredentials { url, user, pass })
    }

    fn skip_live_freshrss_test_when_env_is_missing(test_name: &str) {
        eprintln!(
            "skipping {test_name}: set FRESHRSS_URL, FRESHRSS_USER, and FRESHRSS_PASS to run manually"
        );
    }

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_auth() {
        let Some(credentials) = live_freshrss_credentials() else {
            skip_live_freshrss_test_when_env_is_missing("freshrss_live_auth");
            return;
        };

        let mut provider = GReaderProvider::for_freshrss(&credentials.url);
        let creds = Credentials {
            token: Some(credentials.user),
            password: Some(credentials.pass),
        };
        provider.authenticate(&creds).await.unwrap();
        assert!(provider.auth_token.is_some());
        println!("Auth token: [redacted]");
    }

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_subscriptions() {
        let Some((provider, _)) = live_provider("freshrss_live_subscriptions").await else {
            return;
        };
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
        let Some((provider, _)) = live_provider("freshrss_live_folders").await else {
            return;
        };
        let folders = provider.get_folders().await.unwrap();
        println!("Folders: {}", folders.len());
        for f in &folders {
            println!("  - {} ({})", f.name, f.remote_id);
        }
    }

    #[tokio::test]
    #[ignore]
    async fn freshrss_live_pull_entries() {
        let Some((provider, _)) = live_provider("freshrss_live_pull_entries").await else {
            return;
        };
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
        let Some((provider, _)) = live_provider("freshrss_live_pull_state").await else {
            return;
        };
        let state = provider.pull_state().await.unwrap();
        println!("Read IDs: {}", state.read_ids.len());
        println!("Starred IDs: {}", state.starred_ids.len());
    }

    /// Helper: create an authenticated live provider
    async fn live_provider(test_name: &str) -> Option<(GReaderProvider, ())> {
        let Some(credentials) = live_freshrss_credentials() else {
            skip_live_freshrss_test_when_env_is_missing(test_name);
            return None;
        };

        let mut provider = GReaderProvider::for_freshrss(&credentials.url);
        provider
            .authenticate(&Credentials {
                token: Some(credentials.user),
                password: Some(credentials.pass),
            })
            .await
            .unwrap();
        Some((provider, ()))
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

    #[tokio::test]
    async fn push_mutations_stops_after_first_failed_edit_tag() {
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
            .match_body("i=entry-1&a=user%2F-%2Fstate%2Fcom.google%2Fread")
            .with_status(200)
            .with_body("OK")
            .create_async()
            .await;
        let mark_unread_mock = server
            .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .match_body("i=entry-2&r=user%2F-%2Fstate%2Fcom.google%2Fread")
            .with_status(500)
            .with_body("failed")
            .create_async()
            .await;
        let star_mock = server
            .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .match_body("i=entry-3&a=user%2F-%2Fstate%2Fcom.google%2Fstarred")
            .expect(0)
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

        let error = provider
            .push_mutations(&mutations)
            .await
            .expect_err("first failed edit-tag should stop the remaining replay batch");

        assert!(matches!(error, DomainError::Network(_)));
        mark_read_mock.assert_async().await;
        mark_unread_mock.assert_async().await;
        star_mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_uses_exact_feed_url_match_after_quickadd() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let quickadd_mock = server
            .mock(
                "POST",
                "/api/greader.php/reader/api/0/subscription/quickadd",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body("OK")
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
                            "id": "feed/https://example.com/rss-extra",
                            "title": "Collision",
                            "url": "https://example.com/rss-extra",
                            "htmlUrl": "https://example.com/collision"
                        },
                        {
                            "id": "feed/opaque-remote-id",
                            "title": "Exact",
                            "url": "https://example.com/rss",
                            "htmlUrl": "https://example.com"
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

        let subscription = provider
            .create_subscription("https://example.com/rss", None)
            .await
            .unwrap();

        assert_eq!(subscription.remote_id, "feed/opaque-remote-id");
        quickadd_mock.assert_async().await;
        sub_mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_uses_quickadd_stream_id_when_subscription_lookup_fails() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let quickadd_mock = server
            .mock(
                "POST",
                "/api/greader.php/reader/api/0/subscription/quickadd",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "streamId": "feed/https://example.com/rss",
                    "query": "Example Feed"
                }"#,
            )
            .create_async()
            .await;

        let sub_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/subscription/list?output=json",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(500)
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

        let subscription = provider
            .create_subscription("https://example.com/rss", None)
            .await
            .unwrap();

        assert_eq!(subscription.remote_id, "feed/https://example.com/rss");
        assert_eq!(subscription.url, "https://example.com/rss");
        assert_eq!(subscription.title, "Example Feed");
        quickadd_mock.assert_async().await;
        sub_mock.assert_async().await;
    }

    #[tokio::test]
    async fn create_subscription_matches_quickadd_stream_and_html_url_after_redirect() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let quickadd_mock = server
            .mock(
                "POST",
                "/api/greader.php/reader/api/0/subscription/quickadd",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "numResults": 1,
                    "query": "https://example.com/start",
                    "streamId": "feed/https://feeds.example.com/final.xml"
                }"#,
            )
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
                            "id": "feed/https://other.example.com/rss",
                            "title": "Other",
                            "url": "https://other.example.com/rss",
                            "htmlUrl": "https://example.com/other"
                        },
                        {
                            "id": "feed/opaque-final-id",
                            "title": "Final",
                            "url": "https://feeds.example.com/final.xml",
                            "htmlUrl": "https://example.com/final"
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

        let subscription = provider
            .create_subscription("https://example.com/start", None)
            .await
            .unwrap();

        assert_eq!(subscription.remote_id, "feed/opaque-final-id");
        quickadd_mock.assert_async().await;
        sub_mock.assert_async().await;
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

    #[tokio::test]
    async fn edit_subscription_sends_rename_only_request() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let edit_mock = server
            .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .match_body(mockito::Matcher::AllOf(vec![
                mockito::Matcher::Regex("(^|&)ac=edit(&|$)".to_string()),
                mockito::Matcher::Regex(
                    "(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string(),
                ),
                mockito::Matcher::Regex("(^|&)t=New%20Title(&|$)".to_string()),
            ]))
            .with_status(200)
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

        provider
            .edit_subscription("feed/http://example.com/rss", Some("New Title"), None, None)
            .await
            .unwrap();

        edit_mock.assert_async().await;
    }

    #[tokio::test]
    async fn edit_subscription_sends_folder_move_with_add_and_remove_labels() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let edit_mock = server
            .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .match_body(mockito::Matcher::AllOf(vec![
                mockito::Matcher::Regex("(^|&)ac=edit(&|$)".to_string()),
                mockito::Matcher::Regex(
                    "(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string(),
                ),
                mockito::Matcher::Regex("(^|&)a=user%2F-%2Flabel%2FNew(&|$)".to_string()),
                mockito::Matcher::Regex("(^|&)r=user%2F-%2Flabel%2FOld(&|$)".to_string()),
            ]))
            .with_status(200)
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

        provider
            .edit_subscription(
                "feed/http://example.com/rss",
                None,
                Some("New"),
                Some("Old"),
            )
            .await
            .unwrap();

        edit_mock.assert_async().await;
    }

    #[tokio::test]
    async fn edit_subscription_maps_non_success_status_to_domain_error() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        server
            .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(500)
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

        let error = provider
            .edit_subscription("feed/http://example.com/rss", Some("New Title"), None, None)
            .await
            .expect_err("non-2xx subscription/edit response should map to a domain error");

        assert!(!matches!(error, DomainError::Validation(_)));
    }
}
