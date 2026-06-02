use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::types::{AccountId, ArticleId, FeedId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: ArticleId,
    pub feed_id: FeedId,
    pub remote_id: Option<String>,
    pub title: String,
    pub content_raw: String,
    pub content_sanitized: String,
    pub sanitizer_version: u32,
    pub summary: Option<String>,
    pub url: Option<String>,
    pub author: Option<String>,
    pub published_at: DateTime<Utc>,
    pub thumbnail: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub fetched_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticleViewHistoryItem {
    pub account_id: AccountId,
    pub article: Article,
    pub viewed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArticleListItem {
    pub id: ArticleId,
    pub feed_id: FeedId,
    pub title: String,
    pub summary: Option<String>,
    pub url: Option<String>,
    pub author: Option<String>,
    pub published_at: DateTime<Utc>,
    pub thumbnail: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArticleListHistoryItem {
    pub account_id: AccountId,
    pub article: ArticleListItem,
    pub viewed_at: DateTime<Utc>,
}

/// Generate a stable article ID. Account/feed-scoped to prevent cross-feed collision.
/// Priority: 1) GUID  2) URL-based hash  3) title-based hash
pub fn generate_entry_id(
    account_id: &str,
    guid: Option<&str>,
    feed_url: &str,
    entry_url: Option<&str>,
    title: Option<&str>,
) -> ArticleId {
    if let Some(id) = guid.map(str::trim) {
        if !id.is_empty() {
            return ArticleId(sha256_hex(&format!("{account_id}|{feed_url}|guid|{id}")));
        }
    }
    let url = entry_url.unwrap_or("");
    if !url.is_empty() {
        return ArticleId(sha256_hex(&format!("{account_id}|{feed_url}|{url}")));
    }
    let t = title.unwrap_or("");
    ArticleId(sha256_hex(&format!("{account_id}|{feed_url}|{t}")))
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guid_takes_precedence() {
        let id = generate_entry_id("acc1", Some("guid-123"), "http://feed.com", None, None);
        assert_eq!(id.0.len(), 64);
    }

    #[test]
    fn guid_is_trimmed_before_use() {
        let id = generate_entry_id(
            "acc1",
            Some("  guid-123  "),
            "http://feed.com",
            Some("http://article.com/1"),
            Some("My Title"),
        );
        let untrimmed = generate_entry_id(
            "acc1",
            Some("guid-123"),
            "http://feed.com",
            Some("http://article.com/1"),
            Some("My Title"),
        );
        assert_eq!(id, untrimmed);
    }

    #[test]
    fn url_based_when_no_guid() {
        let id = generate_entry_id(
            "acc1",
            None,
            "http://feed.com",
            Some("http://article.com/1"),
            None,
        );
        assert_eq!(id.0.len(), 64); // sha256 hex
    }

    #[test]
    fn title_fallback_when_no_url() {
        let id = generate_entry_id("acc1", None, "http://feed.com", None, Some("My Title"));
        assert_eq!(id.0.len(), 64);
    }

    #[test]
    fn different_accounts_different_ids() {
        let id1 = generate_entry_id("acc1", Some("guid-1"), "http://feed.com", None, None);
        let id2 = generate_entry_id("acc2", Some("guid-1"), "http://feed.com", None, None);
        assert_ne!(id1, id2);
    }

    #[test]
    fn same_guid_in_different_feeds_has_different_ids() {
        let id1 = generate_entry_id(
            "acc1",
            Some("shared-guid"),
            "https://example.com/feed-a.xml",
            Some("https://example.com/a"),
            None,
        );
        let id2 = generate_entry_id(
            "acc1",
            Some("shared-guid"),
            "https://example.com/feed-b.xml",
            Some("https://example.com/b"),
            None,
        );

        assert_ne!(id1, id2);
    }

    #[test]
    fn guid_identity_ignores_entry_url_changes_within_same_feed() {
        let id1 = generate_entry_id(
            "acc1",
            Some("stable-guid"),
            "https://example.com/feed.xml",
            Some("https://example.com/old"),
            None,
        );
        let id2 = generate_entry_id(
            "acc1",
            Some("stable-guid"),
            "https://example.com/feed.xml",
            Some("https://example.com/new"),
            Some("New title"),
        );

        assert_eq!(id1, id2);
    }

    #[test]
    fn same_guid_after_feed_url_change_is_a_different_id() {
        let id1 = generate_entry_id(
            "acc1",
            Some("stable-guid"),
            "https://example.com/old-feed.xml",
            Some("https://example.com/article"),
            None,
        );
        let id2 = generate_entry_id(
            "acc1",
            Some("stable-guid"),
            "https://example.com/new-feed.xml",
            Some("https://example.com/article"),
            None,
        );

        assert_ne!(id1, id2);
    }

    #[test]
    fn empty_guid_falls_through() {
        let id = generate_entry_id(
            "acc1",
            Some(""),
            "http://feed.com",
            Some("http://article.com"),
            None,
        );
        assert_eq!(id.0.len(), 64); // should use URL hash, not empty guid
    }

    #[test]
    fn whitespace_guid_falls_back_to_url() {
        let id = generate_entry_id(
            "acc1",
            Some("  \n\t  "),
            "http://feed.com",
            Some("http://article.com"),
            Some("Ignored Title"),
        );
        let no_guid_id = generate_entry_id(
            "acc1",
            None,
            "http://feed.com",
            Some("http://article.com"),
            Some("Different Title"),
        );
        assert_eq!(id, no_guid_id);
    }

    #[test]
    fn url_fallback_is_scoped_by_account_and_feed() {
        let id = generate_entry_id(
            "acc1",
            None,
            "https://example.com/feed-a.xml",
            Some("https://example.com/article"),
            Some("Ignored Title"),
        );
        let different_account_id = generate_entry_id(
            "acc2",
            None,
            "https://example.com/feed-a.xml",
            Some("https://example.com/article"),
            Some("Ignored Title"),
        );
        let different_feed_id = generate_entry_id(
            "acc1",
            None,
            "https://example.com/feed-b.xml",
            Some("https://example.com/article"),
            Some("Ignored Title"),
        );

        assert_ne!(id, different_account_id);
        assert_ne!(id, different_feed_id);
    }

    #[test]
    fn title_fallback_is_scoped_by_account_and_feed() {
        let id = generate_entry_id(
            "acc1",
            None,
            "https://example.com/feed-a.xml",
            None,
            Some("Shared Title"),
        );
        let different_account_id = generate_entry_id(
            "acc2",
            None,
            "https://example.com/feed-a.xml",
            None,
            Some("Shared Title"),
        );
        let different_feed_id = generate_entry_id(
            "acc1",
            None,
            "https://example.com/feed-b.xml",
            None,
            Some("Shared Title"),
        );

        assert_ne!(id, different_account_id);
        assert_ne!(id, different_feed_id);
    }

    #[test]
    fn whitespace_guid_without_url_falls_back_to_title() {
        let id = generate_entry_id(
            "acc1",
            Some("  \n\t  "),
            "http://feed.com",
            None,
            Some("My Title"),
        );
        let no_guid_id = generate_entry_id("acc1", None, "http://feed.com", None, Some("My Title"));
        assert_eq!(id, no_guid_id);
    }

    #[test]
    fn no_url_no_title_still_works() {
        let id = generate_entry_id("acc1", None, "http://feed.com", None, None);
        assert_eq!(id.0.len(), 64);
    }
}
