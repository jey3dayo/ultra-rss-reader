use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{FeedIdentifier, RemoteEntry};

pub fn normalize_feed(feed_data: &[u8], feed_url: &str) -> DomainResult<Vec<RemoteEntry>> {
    let feed = feed_rs::parser::parse(feed_data).map_err(|e| DomainError::Parse(e.to_string()))?;

    Ok(feed
        .entries
        .into_iter()
        .map(|entry| {
            let url = entry.links.first().map(|l| l.href.clone());
            let published_at = entry.published.or(entry.updated);
            let updated_at = entry.updated;
            let thumbnail = extract_thumbnail(&entry);
            let content = entry
                .content
                .and_then(|c| c.body)
                .or_else(|| entry.summary.as_ref().map(|s| s.content.clone()))
                .unwrap_or_default();

            RemoteEntry {
                id: if entry.id.is_empty() {
                    None
                } else {
                    Some(entry.id)
                },
                source_feed_id: FeedIdentifier::Local {
                    feed_url: feed_url.to_string(),
                },
                title: entry.title.map(|t| t.content).unwrap_or_default(),
                content,
                summary: entry.summary.map(|s| s.content),
                url,
                published_at,
                updated_at,
                thumbnail,
                author: entry.authors.first().map(|a| a.name.clone()),
                is_read: None,
                is_starred: None,
            }
        })
        .collect())
}

fn extract_thumbnail(entry: &feed_rs::model::Entry) -> Option<String> {
    // Try media content first, then enclosures
    entry
        .media
        .first()
        .and_then(|m| m.content.first())
        .and_then(|c| c.url.as_ref())
        .map(|u| u.to_string())
        .or_else(|| {
            entry
                .links
                .iter()
                .find(|l| {
                    l.media_type.as_deref() == Some("image/jpeg")
                        || l.media_type.as_deref() == Some("image/png")
                })
                .map(|l| l.href.clone())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <link>https://example.com</link>
        <item>
            <title>Test Article</title>
            <link>https://example.com/article1</link>
            <description>&lt;p&gt;Hello World&lt;/p&gt;</description>
            <pubDate>Wed, 26 Mar 2026 10:00:00 GMT</pubDate>
            <guid>guid-1</guid>
        </item>
        <item>
            <title>No GUID Article</title>
            <link>https://example.com/article2</link>
            <description>Simple text</description>
        </item>
    </channel>
    </rss>"#;

    #[test]
    fn parses_rss_feed() {
        let entries =
            normalize_feed(SAMPLE_RSS.as_bytes(), "https://example.com/feed.xml").unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn first_entry_has_correct_fields() {
        let entries =
            normalize_feed(SAMPLE_RSS.as_bytes(), "https://example.com/feed.xml").unwrap();
        let first = &entries[0];
        assert_eq!(first.title, "Test Article");
        assert_eq!(first.url, Some("https://example.com/article1".to_string()));
        assert_eq!(first.id, Some("guid-1".to_string()));
        assert!(first.published_at.is_some());
    }

    #[test]
    fn source_feed_id_is_local() {
        let entries =
            normalize_feed(SAMPLE_RSS.as_bytes(), "https://example.com/feed.xml").unwrap();
        match &entries[0].source_feed_id {
            FeedIdentifier::Local { feed_url } => {
                assert_eq!(feed_url, "https://example.com/feed.xml")
            }
            _ => panic!("Expected Local feed identifier"),
        }
    }
}
