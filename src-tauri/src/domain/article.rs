use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::types::{ArticleId, FeedId};

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

/// Generate a stable article ID. Account-scoped to prevent cross-account collision.
/// Priority: 1) GUID  2) URL-based hash  3) title-based hash
pub fn generate_entry_id(
    account_id: &str,
    guid: Option<&str>,
    feed_url: &str,
    entry_url: Option<&str>,
    title: Option<&str>,
) -> ArticleId {
    if let Some(id) = guid {
        if !id.is_empty() {
            return ArticleId(format!("{account_id}:{id}"));
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
        assert_eq!(id, ArticleId("acc1:guid-123".to_string()));
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
    fn no_url_no_title_still_works() {
        let id = generate_entry_id("acc1", None, "http://feed.com", None, None);
        assert_eq!(id.0.len(), 64);
    }
}
