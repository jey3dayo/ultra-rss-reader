use chrono::DateTime;
use std::collections::{HashMap, HashSet};

use super::super::http_defaults;
use super::super::normalizer::normalize_trusted_backend_article_url;
use super::stream_types::{
    next_ot_timestamp_usec, normalize_item_id, valid_item_cursor_timestamp_usec, GReaderItem,
    GReaderLink, StreamContentsResponse, StreamItemIdsResponse,
};
use super::{
    urlencoded, GReaderProvider, G_READER_MAX_PAGES, G_READER_MAX_STREAM_IDS, STATE_READ,
    STATE_READING_LIST, STATE_STARRED, STREAM_CONTENTS_LIMIT, STREAM_IDS_LIMIT,
};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

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
        let response: super::stream_types::UnreadCountsResponse =
            Self::read_json_response(response).await?;

        Ok(response
            .unreadcounts
            .into_iter()
            .map(|entry| {
                (
                    entry.id,
                    super::stream_types::normalize_unread_count(entry.count),
                )
            })
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
            let continuation_bytes = remaining_continuation.len();
            tracing::warn!(
                continuation_bytes,
                max_pages = G_READER_MAX_PAGES,
                reason = "page_limit",
                "Incomplete GReader item id sync reached page limit"
            );
            return Err(DomainError::Network(format!(
                "Incomplete GReader item id sync: reached {G_READER_MAX_PAGES} pages with continuation remaining (reason=page_limit, continuation_bytes={continuation_bytes})"
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
}
