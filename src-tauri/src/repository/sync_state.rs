use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;

const WEAK_ETAG_PREFIX: &str = "W/";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncStateScopeKey {
    Scheduler,
    GReaderAccountAll,
    GReaderRemoteStateFull,
    Feed(String),
    LocalFeed(String),
    Raw(String),
    LegacyRaw(String),
}

impl SyncStateScopeKey {
    pub fn scheduler() -> Self {
        Self::Scheduler
    }

    pub fn greader_account_all() -> Self {
        Self::GReaderAccountAll
    }

    pub fn greader_remote_state_full() -> Self {
        Self::GReaderRemoteStateFull
    }

    pub fn feed(remote_id: impl Into<String>) -> Self {
        Self::Feed(remote_id.into())
    }

    pub fn local_feed(feed_url: impl Into<String>) -> Self {
        Self::LocalFeed(normalize_local_feed_scope_url(&feed_url.into()))
    }

    pub fn raw(scope_key: impl Into<String>) -> Self {
        Self::Raw(scope_key.into())
    }

    pub fn as_string(&self) -> String {
        match self {
            Self::Scheduler => "scheduler".to_string(),
            Self::GReaderAccountAll => "account:greader:all".to_string(),
            Self::GReaderRemoteStateFull => "account:greader:remote-state-full".to_string(),
            Self::Feed(remote_id) => format!("feed:{remote_id}"),
            Self::LocalFeed(feed_url) => format!("local_feed:{feed_url}"),
            Self::Raw(scope_key) => format!("raw:{scope_key}"),
            Self::LegacyRaw(scope_key) => scope_key.clone(),
        }
    }
}

fn normalize_local_feed_scope_url(feed_url: &str) -> String {
    let Ok(mut url) = reqwest::Url::parse(feed_url) else {
        return feed_url.to_string();
    };

    url.set_fragment(None);

    if url.query().is_some() {
        let mut pairs = url
            .query_pairs()
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect::<Vec<_>>();
        pairs.sort();
        url.query_pairs_mut().clear().extend_pairs(pairs);
    }

    url.to_string()
}

pub fn normalize_http_etag_validator(value: Option<String>) -> Option<String> {
    let value = value?.trim().to_string();
    if value.is_empty() || value.contains(['\r', '\n']) {
        return None;
    }

    let strong = value
        .strip_prefix(WEAK_ETAG_PREFIX)
        .or_else(|| value.strip_prefix("w/"))
        .unwrap_or(value.as_str());
    if strong.len() >= 2 && strong.starts_with('"') && strong.ends_with('"') {
        return Some(value);
    }

    None
}

pub fn normalize_http_last_modified_validator(value: Option<String>) -> Option<String> {
    let value = value?.trim().to_string();
    if value.is_empty() || value.contains(['\r', '\n']) {
        return None;
    }

    chrono::DateTime::parse_from_rfc2822(&value)
        .ok()
        .map(|_| value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_feed_scope_key_normalizes_url_for_validator_lookup() {
        let normalized = SyncStateScopeKey::local_feed(
            "HTTPS://Example.COM:443/feed.xml?z=last&a=first&a=again#fragment",
        );

        assert_eq!(
            normalized.as_string(),
            "local_feed:https://example.com/feed.xml?a=again&a=first&z=last"
        );
    }

    #[test]
    fn local_feed_scope_key_keeps_http_and_https_distinct() {
        assert_ne!(
            SyncStateScopeKey::local_feed("http://example.com/feed.xml").as_string(),
            SyncStateScopeKey::local_feed("https://example.com/feed.xml").as_string()
        );
    }

    #[test]
    fn local_feed_scope_key_keeps_unparseable_legacy_value() {
        assert_eq!(
            SyncStateScopeKey::local_feed("not a url").as_string(),
            "local_feed:not a url"
        );
    }

    #[test]
    fn http_etag_validator_accepts_quoted_strong_and_weak_values() {
        assert_eq!(
            normalize_http_etag_validator(Some(" \"strong\" ".to_string())).as_deref(),
            Some("\"strong\"")
        );
        assert_eq!(
            normalize_http_etag_validator(Some("W/\"weak\"".to_string())).as_deref(),
            Some("W/\"weak\"")
        );
    }

    #[test]
    fn http_etag_validator_rejects_unquoted_or_injected_values() {
        assert_eq!(
            normalize_http_etag_validator(Some("unquoted".to_string())),
            None
        );
        assert_eq!(
            normalize_http_etag_validator(Some("\"ok\"\r\nx: y".to_string())),
            None
        );
    }

    #[test]
    fn http_last_modified_validator_requires_rfc2822_http_date() {
        assert_eq!(
            normalize_http_last_modified_validator(Some(
                "Thu, 02 Jan 2025 00:00:00 GMT".to_string()
            ))
            .as_deref(),
            Some("Thu, 02 Jan 2025 00:00:00 GMT")
        );
        assert_eq!(
            normalize_http_last_modified_validator(Some("not-a-date".to_string())),
            None
        );
    }
}

impl From<&str> for SyncStateScopeKey {
    fn from(value: &str) -> Self {
        match value {
            "scheduler" => Self::Scheduler,
            "account:greader:all" => Self::GReaderAccountAll,
            "account:greader:remote-state-full" => Self::GReaderRemoteStateFull,
            value => value
                .strip_prefix("feed:")
                .map(|remote_id| Self::Feed(remote_id.to_string()))
                .or_else(|| value.strip_prefix("local_feed:").map(Self::local_feed))
                .or_else(|| {
                    value
                        .strip_prefix("raw:")
                        .map(|scope_key| Self::Raw(scope_key.to_string()))
                })
                .unwrap_or_else(|| Self::LegacyRaw(value.to_string())),
        }
    }
}

impl From<&String> for SyncStateScopeKey {
    fn from(value: &String) -> Self {
        value.as_str().into()
    }
}

impl From<&SyncStateScopeKey> for SyncStateScopeKey {
    fn from(value: &SyncStateScopeKey) -> Self {
        value.clone()
    }
}

impl From<String> for SyncStateScopeKey {
    fn from(value: String) -> Self {
        value.as_str().into()
    }
}

#[derive(Debug, Clone)]
pub struct SyncState {
    pub account_id: AccountId,
    pub scope_key: String,
    pub timestamp_usec: Option<i64>,
    pub continuation: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub last_success_at: Option<String>,
    pub last_error: Option<String>,
    pub error_count: i32,
    pub next_retry_at: Option<String>,
}

pub trait SyncStateRepository {
    fn get<K>(&self, account_id: &AccountId, scope_key: K) -> DomainResult<Option<SyncState>>
    where
        K: Into<SyncStateScopeKey>;
    fn save(&self, state: &SyncState) -> DomainResult<()>;
}
