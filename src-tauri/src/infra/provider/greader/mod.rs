use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::header::HeaderValue;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer};
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;
use crate::domain::url_policy::validate_http_url_without_credentials;
use crate::infra::feed_discovery::{
    resolve_validated_public_addrs, validate_discovery_url, validated_public_dns_resolver,
};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum UnreadPullTermination {
    Normal,
    EmptyPageWithContinuation,
    RepeatedContinuation,
    FullPageWithoutContinuation,
}

#[derive(Debug, Clone)]
pub(crate) struct UnreadPullResult {
    pub(crate) entries: Vec<RemoteEntry>,
    pub(crate) next_cursor: Option<SyncCursor>,
    pub(crate) has_more: bool,
    pub(crate) termination: UnreadPullTermination,
}

struct PullEntriesPage {
    result: PullResult,
    raw_item_count: usize,
    repeated_continuation: bool,
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
    // Keep setup failures for legacy infallible constructors so the first
    // provider operation returns the error instead of silently using a default client.
    http_client: Result<reqwest::Client, DomainError>,
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
    stream_id.strip_prefix(GREADER_FEED_ID_PREFIX)
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

fn resolve_greader_base_addrs(url: &reqwest::Url) -> DomainResult<Vec<SocketAddr>> {
    validate_http_url_without_credentials(url)?;

    if let Some(address) = explicit_greader_base_addr(url) {
        // A literal/private FreshRSS base is an explicit user-selected endpoint:
        // it cannot be DNS-rebound, so account URL verification (url_policy / #65)
        // owns the UX decision about whether private servers are acceptable.
        return Ok(vec![address]);
    }

    resolve_validated_public_addrs(url)
}

fn explicit_greader_base_addr(url: &reqwest::Url) -> Option<SocketAddr> {
    let host = url.host_str()?;
    let port = url.port_or_known_default().unwrap_or(80);

    if let Ok(ip) = host.parse::<IpAddr>() {
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

    fn build_http_client(base: &str) -> DomainResult<reqwest::Client> {
        let base_url = reqwest::Url::parse(base).map_err(|_| {
            DomainError::Validation(
                crate::domain::url_policy::UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
            )
        })?;
        let explicit_base_addr = explicit_greader_base_addr(&base_url);
        let resolved_addresses = resolve_greader_base_addrs(&base_url)?;
        let base_host = base_url.host_str();
        let resolver = validated_public_dns_resolver();
        if let Some(host) = base_host.filter(|_| explicit_base_addr.is_none()) {
            resolver.seed(host, resolved_addresses.clone())?;
        }

        let mut builder = http_client_builder()
            .dns_resolver(Arc::new(resolver))
            .redirect(http_defaults::provider_redirect_policy(
                false,
                validate_discovery_url,
            ));
        if let Some(host) = base_host {
            if !resolved_addresses.is_empty() {
                builder = builder.resolve_to_addrs(host, &resolved_addresses);
            }
        }

        http_defaults::build_http_client(builder)
    }

    #[cfg(test)]
    fn build_test_http_client_allowing_private_urls() -> DomainResult<reqwest::Client> {
        http_defaults::build_http_client(http_client_builder().redirect(
            http_defaults::provider_redirect_policy(true, validate_discovery_url),
        ))
    }

    #[cfg(test)]
    fn validate_redirect(
        previous_urls: &[reqwest::Url],
        next_url: &reqwest::Url,
    ) -> DomainResult<()> {
        http_defaults::validate_provider_redirect(previous_urls, next_url, validate_discovery_url)
    }

    fn http_client(&self) -> DomainResult<&reqwest::Client> {
        self.http_client.as_ref().map_err(|error| error.clone())
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
            .http_client()?
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
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
    ) -> DomainResult<PullEntriesPage> {
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
            .http_client()?
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
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

        Ok(PullEntriesPage {
            result: PullResult {
                entries,
                next_cursor,
                has_more,
                not_modified: false,
                skipped_entries,
            },
            raw_item_count,
            repeated_continuation,
        })
    }

    pub(crate) async fn get_unread_count_map(&self) -> DomainResult<HashMap<String, i32>> {
        self.fetch_unread_count_map().await
    }

    pub(crate) async fn pull_unread_entries_for_feed(
        &self,
        remote_id: &str,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<UnreadPullResult> {
        let page = self
            .pull_entries_for_stream(remote_id, Some(STATE_READ), cursor, Some(remote_id))
            .await?;
        let termination = if page.repeated_continuation {
            UnreadPullTermination::RepeatedContinuation
        } else if page.result.entries.is_empty() && page.result.has_more {
            UnreadPullTermination::EmptyPageWithContinuation
        } else if page.raw_item_count >= STREAM_CONTENTS_LIMIT as usize && !page.result.has_more {
            UnreadPullTermination::FullPageWithoutContinuation
        } else {
            UnreadPullTermination::Normal
        };

        Ok(UnreadPullResult {
            entries: page.result.entries,
            next_cursor: page.result.next_cursor,
            has_more: page.result.has_more,
            termination,
        })
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
            .http_client()?
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
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

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        let url = self.api_url("/reader/api/0/subscription/list?output=json");
        let resp = self
            .http_client()?
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
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
            .http_client()?
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
            .and_then(Self::ensure_success_response)?;
        let resp: TagListResponse = Self::read_json_response(resp).await?;

        let mut folders = Vec::with_capacity(resp.tags.len());
        for tag in resp.tags {
            if !tag.id.starts_with(LABEL_PREFIX) {
                continue;
            }
            let (remote_id, name) = normalize_label_remote_id(&tag.id, tag.label.as_deref())
                .ok_or_else(|| {
                    DomainError::Parse(
                        "FreshRSS folder snapshot contained an invalid label".to_string(),
                    )
                })?;
            folders.push(RemoteFolder {
                remote_id,
                name,
                sort_order: None,
            });
        }

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
        .map(|page| page.result)
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
            .http_client()?
            .post(&api_url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
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
mod tests;
