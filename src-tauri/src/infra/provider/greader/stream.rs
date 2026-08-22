use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer};
use std::collections::{HashMap, HashSet};

use super::super::http_defaults;
use super::super::normalizer::{
    normalize_provider_metadata_url, normalize_trusted_backend_article_url,
};
use super::{
    urlencoded, GReaderProvider, G_READER_MAX_PAGES, G_READER_MAX_STREAM_IDS, LABEL_PREFIX,
    STATE_READ, STATE_READING_LIST, STATE_STARRED, STREAM_CONTENTS_LIMIT, STREAM_IDS_LIMIT,
};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

// --- Google Reader API response types ---

#[derive(Deserialize)]
pub(super) struct SubscriptionListResponse {
    pub(super) subscriptions: Vec<GReaderSubscription>,
}

#[derive(Deserialize)]
pub(super) struct QuickAddResponse {
    #[serde(rename = "streamId")]
    pub(super) stream_id: Option<String>,
    #[serde(rename = "query")]
    pub(super) query: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct GReaderSubscription {
    pub(super) id: String,
    pub(super) title: String,
    pub(super) url: String,
    #[serde(rename = "htmlUrl")]
    #[serde(default)]
    pub(super) html_url: String,
    #[serde(default)]
    pub(super) categories: Vec<GReaderCategory>,
    #[serde(rename = "iconUrl")]
    pub(super) icon_url: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct GReaderCategory {
    pub(super) id: String,
    pub(super) label: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct StreamContentsResponse {
    pub(super) items: Vec<GReaderItem>,
    pub(super) continuation: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct GReaderItem {
    pub(super) id: String,
    pub(super) title: Option<String>,
    pub(super) canonical: Option<Vec<GReaderLink>>,
    pub(super) alternate: Option<Vec<GReaderLink>>,
    pub(super) summary: Option<GReaderContent>,
    pub(super) content: Option<GReaderContent>,
    pub(super) author: Option<String>,
    pub(super) published: Option<i64>,
    pub(super) updated: Option<i64>,
    #[serde(
        rename = "timestampUsec",
        default,
        deserialize_with = "deserialize_optional_i64_from_string_or_number"
    )]
    pub(super) timestamp_usec: Option<i64>,
    pub(super) origin: Option<GReaderOrigin>,
    #[serde(default)]
    pub(super) categories: Vec<String>,
}

#[derive(Deserialize)]
pub(super) struct GReaderLink {
    pub(super) href: String,
}

#[derive(Deserialize)]
pub(super) struct GReaderContent {
    pub(super) content: String,
}

#[derive(Deserialize)]
pub(super) struct GReaderOrigin {
    #[serde(rename = "streamId")]
    pub(super) stream_id: String,
}

#[derive(Deserialize)]
pub(super) struct TagListResponse {
    pub(super) tags: Vec<GReaderTag>,
}

#[derive(Deserialize)]
pub(super) struct GReaderTag {
    pub(super) id: String,
    pub(super) label: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct UnreadCountsResponse {
    pub(super) unreadcounts: Vec<UnreadCountEntry>,
}

#[derive(Deserialize)]
pub(super) struct UnreadCountEntry {
    pub(super) id: String,
    pub(super) count: i64,
}

#[derive(Deserialize)]
pub(super) struct StreamItemIdsResponse {
    #[serde(rename = "itemRefs")]
    pub(super) item_refs: Option<Vec<ItemRef>>,
    pub(super) continuation: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct ItemRef {
    pub(super) id: String,
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

pub(super) struct PullEntriesPage {
    pub(super) result: PullResult,
    pub(super) raw_item_count: usize,
    pub(super) repeated_continuation: bool,
}

pub(super) fn percent_decode(input: &str) -> Option<String> {
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

pub(super) fn normalize_label_remote_id(
    raw_id: &str,
    label: Option<&str>,
) -> Option<(String, String)> {
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

pub(super) fn normalize_unread_count(count: i64) -> i32 {
    count.clamp(0, i64::from(i32::MAX)) as i32
}

pub(super) fn normalized_url_match_key(raw_url: &str) -> Option<String> {
    let mut url = reqwest::Url::parse(raw_url.trim()).ok()?;
    url.set_fragment(None);
    Some(url.to_string())
}

pub(super) fn feed_stream_url(stream_id: &str) -> Option<&str> {
    stream_id.strip_prefix(GREADER_FEED_ID_PREFIX)
}

pub(super) fn quickadd_match_keys(requested_url: &str, response_body: &str) -> HashSet<String> {
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

pub(super) fn quickadd_fallback_subscription(
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

pub(super) fn subscription_matches_quickadd_keys(
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

pub(super) fn next_ot_timestamp_usec(
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

pub(super) fn valid_item_cursor_timestamp_usec(timestamp_usec: i64) -> Option<i64> {
    if timestamp_usec < 0 {
        return None;
    }
    let timestamp = DateTime::from_timestamp_micros(timestamp_usec)?;
    if timestamp > Utc::now() {
        return None;
    }
    Some(timestamp_usec)
}

impl GReaderProvider {
    pub(super) async fn fetch_unread_count_map(&self) -> DomainResult<HashMap<String, i32>> {
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

    pub(super) async fn pull_entries_for_stream(
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
}

pub(super) async fn pull_unread_entries_for_feed(
    provider: &GReaderProvider,
    remote_id: &str,
    cursor: Option<SyncCursor>,
) -> DomainResult<UnreadPullResult> {
    let page = provider
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

impl GReaderProvider {
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

    pub(super) async fn pull_item_ids_page(
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

    pub(super) async fn pull_all_item_ids(&self, stream_id: &str) -> DomainResult<Vec<String>> {
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

    pub(super) fn map_item_to_entry(
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

    pub(super) async fn get_subscriptions_impl(&self) -> DomainResult<Vec<RemoteSubscription>> {
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

    pub(super) async fn get_folders_impl(&self) -> DomainResult<Vec<RemoteFolder>> {
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

    pub(super) async fn pull_entries_impl(
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

    pub(super) async fn pull_state_impl(&self) -> DomainResult<RemoteState> {
        let (read_resp, starred_resp) = tokio::try_join!(
            self.pull_all_item_ids(STATE_READ),
            self.pull_all_item_ids(STATE_STARRED)
        )?;

        Ok(RemoteState {
            read_ids: read_resp,
            starred_ids: starred_resp,
        })
    }

    pub(super) async fn create_subscription_impl(
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
        let subs = match self.get_subscriptions_impl().await {
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
}

#[derive(Deserialize)]
#[serde(untagged)]
pub(super) enum IntOrString {
    Int(i64),
    String(String),
}

pub(super) fn deserialize_optional_i64_from_string_or_number<'de, D>(
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

pub(super) fn normalize_item_id(id: &str) -> String {
    const TAG_PREFIX: &str = "tag:google.com,2005:reader/item/";
    if id.starts_with(TAG_PREFIX) {
        return id.to_string();
    }
    match id.parse::<u64>() {
        Ok(n) => format!("{TAG_PREFIX}{n:016x}"),
        Err(_) => id.to_string(),
    }
}
