use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer};
use std::collections::HashSet;

use super::{LABEL_PREFIX, STREAM_CONTENTS_LIMIT};
use crate::domain::provider::{RemoteSubscription, GREADER_FEED_ID_PREFIX};

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
