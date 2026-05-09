use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{FeedIdentifier, RemoteEntry};

const MAX_PROVIDER_METADATA_URL_BYTES: usize = 2048;

pub fn normalize_provider_metadata_url(raw_url: &str) -> Option<String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_PROVIDER_METADATA_URL_BYTES {
        return None;
    }

    let mut url = reqwest::Url::parse(trimmed).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }
    if !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    url.set_fragment(None);
    Some(url.to_string())
}

pub fn normalize_feed(feed_data: &[u8], feed_url: &str) -> DomainResult<Vec<RemoteEntry>> {
    let feed = feed_rs::parser::parse(feed_data).map_err(|e| DomainError::Parse(e.to_string()))?;

    Ok(feed
        .entries
        .into_iter()
        .map(|entry| {
            let url = select_article_url(&entry.links);
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

fn select_article_url(links: &[feed_rs::model::Link]) -> Option<String> {
    links
        .iter()
        .find(|link| is_article_html_link(link))
        .or_else(|| links.iter().find(|link| !link.href.trim().is_empty()))
        .map(|link| link.href.trim().to_string())
}

fn is_article_html_link(link: &feed_rs::model::Link) -> bool {
    if link.href.trim().is_empty() {
        return false;
    }

    let rel = link.rel.as_deref().unwrap_or("alternate");
    if !rel.eq_ignore_ascii_case("alternate") {
        return false;
    }

    link.media_type
        .as_deref()
        .is_none_or(is_html_article_media_type)
}

fn is_html_article_media_type(media_type: &str) -> bool {
    let media_type = media_type.split(';').next().unwrap_or("").trim();

    media_type.eq_ignore_ascii_case("text/html")
        || media_type.eq_ignore_ascii_case("application/xhtml+xml")
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
                .find(|l| is_image_media_type(l.media_type.as_deref()) && !l.href.trim().is_empty())
                .map(|l| l.href.trim().to_string())
        })
}

fn is_image_media_type(media_type: Option<&str>) -> bool {
    media_type
        .map(|media_type| media_type.trim().to_ascii_lowercase().starts_with("image/"))
        .unwrap_or(false)
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
    fn article_url_prefers_alternate_html_link_over_self_and_enclosure_links() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <link rel="self" href="https://example.com/feed.atom" type="application/atom+xml"/>
  <entry>
    <title>Atom Article</title>
    <id>atom-1</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="self" href="https://example.com/api/items/atom-1" type="application/atom+xml"/>
    <link rel="enclosure" href="https://cdn.example.com/audio.mp3" type="audio/mpeg"/>
    <link rel="alternate" href="https://example.com/articles/atom-1" type="text/html"/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].url,
            Some("https://example.com/articles/atom-1".to_string())
        );
    }

    #[test]
    fn article_url_accepts_html_media_type_with_parameters() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Parameterized HTML Type</title>
    <id>atom-parameterized-html</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="self" href="https://example.com/feed.atom" type="application/atom+xml"/>
    <link rel="alternate" href="https://example.com/articles/parameterized-html" type="text/html; charset=utf-8"/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].url,
            Some("https://example.com/articles/parameterized-html".to_string())
        );
    }

    #[test]
    fn article_url_keeps_rss_item_link_when_link_has_no_rel_or_media_type() {
        let entries =
            normalize_feed(SAMPLE_RSS.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].url,
            Some("https://example.com/article1".to_string())
        );
    }

    #[test]
    fn article_url_trims_selected_link_href() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Atom Article</title>
    <id>atom-trimmed-link</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link href="  https://example.com/article  "/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].url,
            Some("https://example.com/article".to_string())
        );
    }

    #[test]
    fn thumbnail_fallback_accepts_common_image_media_types() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>WebP Thumbnail</title>
    <id>atom-webp</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/webp" type="text/html"/>
    <link rel="enclosure" href="https://cdn.example.com/thumb.webp" type="image/webp"/>
  </entry>
  <entry>
    <title>GIF Thumbnail</title>
    <id>atom-gif</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/gif" type="text/html"/>
    <link rel="enclosure" href="https://cdn.example.com/thumb.gif" type=" IMAGE/GIF "/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].thumbnail,
            Some("https://cdn.example.com/thumb.webp".to_string())
        );
        assert_eq!(
            entries[1].thumbnail,
            Some("https://cdn.example.com/thumb.gif".to_string())
        );
    }

    #[test]
    fn thumbnail_fallback_skips_non_image_media_types() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Audio Enclosure</title>
    <id>atom-audio</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/audio" type="text/html"/>
    <link rel="enclosure" href="https://cdn.example.com/audio.mp3" type="audio/mpeg"/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(entries[0].thumbnail, None);
    }

    #[test]
    fn thumbnail_fallback_skips_blank_image_href_and_trims_selected_href() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Trimmed WebP Thumbnail</title>
    <id>atom-trimmed-webp</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/trimmed-webp" type="text/html"/>
    <link rel="enclosure" href=" " type="image/png"/>
    <link rel="enclosure" href="  https://cdn.example.com/thumb.webp  " type="image/webp"/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].thumbnail,
            Some("https://cdn.example.com/thumb.webp".to_string())
        );
    }

    #[test]
    fn published_date_takes_precedence_over_updated_date() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Atom Article</title>
    <id>atom-1</id>
    <link href="https://example.com/article"/>
    <published>2026-03-26T10:00:00Z</published>
    <updated>2026-03-27T12:00:00Z</updated>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();
        let entry = &entries[0];

        assert_eq!(
            entry.published_at.map(|date| date.to_rfc3339()),
            Some("2026-03-26T10:00:00+00:00".to_string())
        );
        assert_eq!(
            entry.updated_at.map(|date| date.to_rfc3339()),
            Some("2026-03-27T12:00:00+00:00".to_string())
        );
    }

    #[test]
    fn updated_date_is_used_when_published_date_is_missing() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Updated Only</title>
    <id>atom-1</id>
    <link href="https://example.com/article"/>
    <updated>2026-03-27T12:00:00Z</updated>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();
        let entry = &entries[0];

        assert_eq!(
            entry.published_at.map(|date| date.to_rfc3339()),
            Some("2026-03-27T12:00:00+00:00".to_string())
        );
        assert_eq!(
            entry.updated_at.map(|date| date.to_rfc3339()),
            Some("2026-03-27T12:00:00+00:00".to_string())
        );
    }

    #[test]
    fn missing_published_and_updated_dates_remain_none() {
        let entries =
            normalize_feed(SAMPLE_RSS.as_bytes(), "https://example.com/feed.xml").unwrap();
        let entry_without_dates = &entries[1];

        assert_eq!(entry_without_dates.published_at, None);
        assert_eq!(entry_without_dates.updated_at, None);
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
