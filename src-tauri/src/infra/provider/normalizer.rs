use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{FeedIdentifier, RemoteEntry};
use crate::domain::url_policy::{has_url_credentials, is_private_host};

const MAX_PROVIDER_METADATA_URL_BYTES: usize = 2048;

fn contains_control_char(value: &str) -> bool {
    value.chars().any(char::is_control)
}

pub fn normalize_provider_metadata_url(raw_url: &str) -> Option<String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty()
        || trimmed.len() > MAX_PROVIDER_METADATA_URL_BYTES
        || contains_control_char(trimmed)
    {
        return None;
    }

    let mut url = reqwest::Url::parse(trimmed).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }
    if url.host_str().is_some_and(is_private_host) {
        return None;
    }
    if has_url_credentials(&url) {
        return None;
    }
    url.set_fragment(None);
    Some(url.to_string())
}

pub fn normalize_provider_article_url(raw_url: &str) -> Option<String> {
    normalize_http_article_url(raw_url, ArticleUrlCredentialPolicy::Reject)
}

pub fn normalize_trusted_backend_article_url(raw_url: &str) -> Option<String> {
    normalize_http_article_url(raw_url, ArticleUrlCredentialPolicy::Strip)
}

#[derive(Debug, Clone, Copy)]
enum ArticleUrlCredentialPolicy {
    Reject,
    Strip,
}

fn normalize_http_article_url(
    raw_url: &str,
    credential_policy: ArticleUrlCredentialPolicy,
) -> Option<String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty()
        || trimmed.len() > MAX_PROVIDER_METADATA_URL_BYTES
        || contains_control_char(trimmed)
    {
        return None;
    }

    let mut url = reqwest::Url::parse(trimmed).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }
    if has_url_credentials(&url) {
        match credential_policy {
            ArticleUrlCredentialPolicy::Reject => return None,
            ArticleUrlCredentialPolicy::Strip => {
                let _ = url.set_username("");
                let _ = url.set_password(None);
            }
        }
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
                id: if entry.id.trim().is_empty() {
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
        .filter(|link| is_article_html_link(link))
        .find_map(|link| normalize_provider_article_url(&link.href))
        .or_else(|| {
            links
                .iter()
                .filter(|link| !link.href.trim().is_empty())
                .find_map(|link| normalize_provider_article_url(&link.href))
        })
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
        .and_then(|u| normalize_provider_metadata_url(u.as_str()))
        .or_else(|| {
            entry
                .links
                .iter()
                .find(|l| is_image_media_type(l.media_type.as_deref()) && !l.href.trim().is_empty())
                .and_then(|l| normalize_provider_metadata_url(&l.href))
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
    fn whitespace_only_entry_id_is_treated_as_blank() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Whitespace ID</title>
    <id>   </id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link href="https://example.com/article"/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(entries[0].id, None);
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
    fn feed_parser_boundary_normalizes_atom_xhtml_content_and_relative_link_base() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.com/blog/">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry xml:base="posts/">
    <title>XHTML Content</title>
    <id>xhtml-1</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="xhtml-1" type="application/xhtml+xml"/>
    <content type="xhtml">
      <div xmlns="http://www.w3.org/1999/xhtml">
        <p>Hello <strong>Atom</strong></p>
      </div>
    </content>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(
            entries[0].url,
            Some("https://example.com/blog/posts/xhtml-1".to_string())
        );
        assert!(entries[0]
            .content
            .contains("<p>Hello <strong>Atom</strong></p>"));
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
    fn untrusted_feed_article_url_rejects_credentials_and_strips_fragment() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Private Link</title>
    <id>atom-private-link</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link href="https://alice:secret@example.com/article#token"/>
  </entry>
  <entry>
    <title>Fragment Link</title>
    <id>atom-fragment-link</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link href="https://example.com/article#token"/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(entries[0].url, None);
        assert_eq!(
            entries[1].url,
            Some("https://example.com/article".to_string())
        );
    }

    #[test]
    fn article_url_normalization_keeps_path_query_and_host_case_policy() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Canonical Form</title>
    <id>atom-canonical-form</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href=" HTTPS://Example.COM:443/Article?utm_source=feed#section "/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].url,
            Some("https://example.com/Article?utm_source=feed".to_string())
        );
    }

    #[test]
    fn feed_entry_link_normalization_policy_preserves_query_and_punycode_but_drops_fragment() {
        let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Unicode Link</title>
    <id>atom-unicode-link</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href=" https://例え.テスト:443/記事?utm_source=feed#section "/>
  </entry>
</feed>"#;

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].url,
            Some("https://xn--r8jz45g.xn--zckzah/%E8%A8%98%E4%BA%8B?utm_source=feed".to_string())
        );
    }

    #[test]
    fn feed_entry_link_policy_decodes_html_entities_keeps_query_and_drops_fragment() {
        let rss = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Entity Link Feed</title>
    <link>https://example.com/</link>
    <item>
      <title>Entity Link Article</title>
      <link>https://example.com/article?utm_source=feed&amp;id=1#comments</link>
      <guid>entity-link-article</guid>
    </item>
  </channel>
</rss>"#;

        let entries = normalize_feed(rss.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].url,
            Some("https://example.com/article?utm_source=feed&id=1".to_string())
        );
    }

    #[test]
    fn article_url_skips_invalid_links() {
        let atom = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<feed xmlns=\"http://www.w3.org/2005/Atom\">
  <title>Atom Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Invalid Link</title>
    <id>atom-invalid-link</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link href=\"javascript:alert(1)\"/>
  </entry>
</feed>";

        let entries = normalize_feed(atom.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(entries[0].url, None);
    }

    #[test]
    fn feed_parser_boundary_does_not_expand_external_xml_entities() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE rss [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<rss version="2.0">
  <channel>
    <title>Entity Feed</title>
    <link>https://example.com/</link>
    <item>
      <title>&xxe;</title>
      <link>https://example.com/entity</link>
      <guid>entity-1</guid>
    </item>
  </channel>
</rss>"#;

        let entries = normalize_feed(feed.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, Some("entity-1".to_string()));
        assert_eq!(entries[0].title, "");
    }

    #[test]
    fn feed_parser_boundary_does_not_expand_nested_xml_entities() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE rss [
  <!ENTITY a "boom">
  <!ENTITY b "&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;">
]>
<rss version="2.0">
  <channel>
    <title>Entity Feed</title>
    <link>https://example.com/</link>
    <item>
      <title>&c;</title>
      <link>https://example.com/entity</link>
      <guid>entity-1</guid>
    </item>
  </channel>
</rss>"#;

        let entries = normalize_feed(feed.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "");
    }

    #[test]
    fn article_url_rejects_control_characters_before_parsing() {
        assert_eq!(
            normalize_provider_article_url("https://example.com/article\u{8}"),
            None
        );
    }

    #[test]
    fn provider_metadata_url_policy_fixture_matches_frontend_url_policy_cases() {
        struct MetadataUrlPolicyFixture {
            name: &'static str,
            raw_url: &'static str,
            expected_metadata_url: Option<&'static str>,
        }

        let fixtures = [
            MetadataUrlPolicyFixture {
                name: "http",
                raw_url: "http://example.com/feed.xml",
                expected_metadata_url: Some("http://example.com/feed.xml"),
            },
            MetadataUrlPolicyFixture {
                name: "https with tracking query",
                raw_url: " https://example.com/feed.xml?utm_source=reader#section ",
                expected_metadata_url: Some("https://example.com/feed.xml?utm_source=reader"),
            },
            MetadataUrlPolicyFixture {
                name: "protocol relative",
                raw_url: "//example.com/feed.xml",
                expected_metadata_url: None,
            },
            MetadataUrlPolicyFixture {
                name: "relative path",
                raw_url: "/feed.xml",
                expected_metadata_url: None,
            },
            MetadataUrlPolicyFixture {
                name: "userinfo",
                raw_url: "https://alice:secret@example.com/feed.xml",
                expected_metadata_url: None,
            },
            MetadataUrlPolicyFixture {
                name: "unicode host",
                raw_url: "https://例え.テスト/feed.xml",
                expected_metadata_url: Some("https://xn--r8jz45g.xn--zckzah/feed.xml"),
            },
            MetadataUrlPolicyFixture {
                name: "icon url",
                raw_url: "https://cdn.example.com/icon.png#private",
                expected_metadata_url: Some("https://cdn.example.com/icon.png"),
            },
        ];

        for fixture in fixtures {
            assert_eq!(
                normalize_provider_metadata_url(fixture.raw_url).as_deref(),
                fixture.expected_metadata_url,
                "{}",
                fixture.name
            );
        }
    }

    #[test]
    fn trusted_backend_article_url_strips_credentials_and_fragment() {
        assert_eq!(
            normalize_trusted_backend_article_url("https://alice:secret@example.com/article#token"),
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
    fn thumbnail_fixture_normalizes_media_and_enclosure_privacy_boundaries() {
        let feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Media Feed</title>
  <id>https://example.com/feed</id>
  <updated>2026-03-27T12:00:00Z</updated>
  <entry>
    <title>Media Content</title>
    <id>media-content</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/media-content" type="text/html"/>
    <media:content url="https://cdn.example.com/thumb.jpg?tracking=1#private" type="image/jpeg" fileSize="999999999999999999999999"/>
  </entry>
  <entry>
    <title>Image Enclosure</title>
    <id>image-enclosure</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/image-enclosure" type="text/html"/>
    <link rel="enclosure" href="https://cdn.example.com/fallback.png#fragment" type="image/png" length="184467440737095516150"/>
  </entry>
  <entry>
    <title>Audio Enclosure</title>
    <id>audio-enclosure</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/audio-enclosure" type="text/html"/>
    <link rel="enclosure" href="https://cdn.example.com/audio.mp3?token=private" type="audio/mpeg" length="123"/>
  </entry>
  <entry>
    <title>Private Media</title>
    <id>private-media</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/private-media" type="text/html"/>
    <media:content url="http://127.0.0.1/thumb.jpg" type="image/jpeg"/>
  </entry>
  <entry>
    <title>Userinfo Thumbnail</title>
    <id>userinfo-thumbnail</id>
    <updated>2026-03-27T12:00:00Z</updated>
    <link rel="alternate" href="https://example.com/articles/userinfo-thumbnail" type="text/html"/>
    <link rel="enclosure" href="https://user:secret@cdn.example.com/thumb.png" type="image/png" length="123"/>
  </entry>
</feed>"#;

        let entries = normalize_feed(feed.as_bytes(), "https://example.com/feed.xml").unwrap();

        assert_eq!(
            entries[0].thumbnail.as_deref(),
            Some("https://cdn.example.com/thumb.jpg?tracking=1")
        );
        assert_eq!(
            entries[1].thumbnail.as_deref(),
            Some("https://cdn.example.com/fallback.png")
        );
        assert_eq!(entries[2].thumbnail, None);
        assert_eq!(entries[3].thumbnail, None);
        assert_eq!(entries[4].thumbnail, None);
    }

    #[test]
    fn parse_errors_do_not_store_or_surface_feed_body_samples() {
        let malformed =
            b"\xFF\xFE<rss><channel><item><description>token=private-feed-token</description>";

        let error = normalize_feed(malformed, "https://example.com/feed.xml")
            .expect_err("malformed feed should stay a parser error");
        let message = error.to_string();

        assert!(matches!(error, DomainError::Parse(_)));
        assert!(!message.contains("private-feed-token"));
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
