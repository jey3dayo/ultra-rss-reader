use crate::domain::article::{generate_entry_id, Article};
use crate::domain::feed::Feed;
use crate::domain::provider::*;
use crate::domain::types::AccountId;
use crate::infra::sanitizer;
use chrono::Utc;

/// The single materialization of a provider `RemoteEntry` into an `Article`.
/// Every sync path (FreshRSS bulk, FreshRSS single-feed, Local) must build
/// articles through this function so field rules cannot drift.
pub(crate) fn article_from_remote_entry(
    account_id: &AccountId,
    feed: &Feed,
    entry: &RemoteEntry,
) -> Article {
    let id = generate_entry_id(
        account_id.as_ref(),
        entry.id.as_deref(),
        &feed.url,
        entry.url.as_deref(),
        Some(&entry.title),
    );
    Article {
        id,
        feed_id: feed.id.clone(),
        remote_id: entry.id.clone(),
        title: entry.title.clone(),
        content_raw: entry.content.clone(),
        content_sanitized: sanitizer::sanitize_html(&entry.content),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: entry.summary.as_deref().map(sanitizer::sanitize_html),
        url: entry.url.clone(),
        author: entry.author.clone(),
        published_at: entry.published_at.unwrap_or_else(Utc::now),
        thumbnail: entry.thumbnail.clone(),
        is_read: entry.is_read.unwrap_or(false),
        is_starred: entry.is_starred.unwrap_or(false),
        fetched_at: Utc::now(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::FeedId;

    fn test_account() -> Account {
        Account {
            id: AccountId::new(),
            kind: ProviderKind::Local,
            name: "Local".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn test_feed(account_id: &AccountId) -> Feed {
        Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Local Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            icon_url: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    #[test]
    fn article_from_remote_entry_materializes_all_fields_from_a_fully_populated_entry() {
        let account = test_account();
        let feed = test_feed(&account.id);
        let published_at = Utc::now() - chrono::Duration::hours(3);
        let entry = RemoteEntry {
            id: Some("remote-entry-1".to_string()),
            source_feed_id: FeedIdentifier::Remote {
                remote_id: "feed/remote".to_string(),
            },
            title: "Entry title".to_string(),
            content: "<p onclick=\"evil()\">Body</p>".to_string(),
            summary: Some("<script>alert(1)</script><p>Summary</p>".to_string()),
            url: Some("https://example.com/entry-1".to_string()),
            published_at: Some(published_at),
            updated_at: None,
            thumbnail: Some("https://example.com/thumb.png".to_string()),
            author: Some("Jane Doe".to_string()),
            is_read: Some(true),
            is_starred: Some(true),
        };

        let before = Utc::now();
        let article = article_from_remote_entry(&account.id, &feed, &entry);
        let after = Utc::now();

        let expected_id = generate_entry_id(
            account.id.as_ref(),
            entry.id.as_deref(),
            &feed.url,
            entry.url.as_deref(),
            Some(&entry.title),
        );
        assert_eq!(article.id, expected_id);
        assert_eq!(article.feed_id, feed.id);
        assert_eq!(article.remote_id, entry.id);
        assert_eq!(article.title, entry.title);
        assert_eq!(article.content_raw, entry.content);
        assert_eq!(
            article.content_sanitized,
            sanitizer::sanitize_html(&entry.content)
        );
        assert_eq!(article.sanitizer_version, sanitizer::SANITIZER_VERSION);
        assert_eq!(
            article.summary,
            entry.summary.as_deref().map(sanitizer::sanitize_html)
        );
        assert_eq!(article.url, entry.url);
        assert_eq!(article.author, entry.author);
        assert_eq!(article.published_at, published_at);
        assert_eq!(article.thumbnail, entry.thumbnail);
        assert!(article.is_read);
        assert!(article.is_starred);
        assert!(article.fetched_at >= before && article.fetched_at <= after);
    }

    #[test]
    fn article_from_remote_entry_falls_back_when_published_at_and_state_flags_are_missing() {
        let account = test_account();
        let feed = test_feed(&account.id);
        let entry = RemoteEntry {
            id: None,
            source_feed_id: FeedIdentifier::Local {
                feed_url: feed.url.clone(),
            },
            title: "No timestamp entry".to_string(),
            content: "Body".to_string(),
            summary: None,
            url: None,
            published_at: None,
            updated_at: None,
            thumbnail: None,
            author: None,
            is_read: None,
            is_starred: None,
        };

        let before = Utc::now();
        let article = article_from_remote_entry(&account.id, &feed, &entry);
        let after = Utc::now();

        assert!(article.published_at >= before && article.published_at <= after);
        assert!(!article.is_read);
        assert!(!article.is_starred);
    }
}
