use crate::domain::error::{DomainError, DomainResult};

/// A discovered feed from an HTML page.
#[derive(Debug, Clone)]
pub struct DiscoveredFeed {
    pub url: String,
    pub title: String,
}

/// Fetch the given URL and discover RSS/Atom feed links from the HTML.
///
/// If the URL itself points to a feed (Content-Type contains xml or json feed),
/// it is returned as-is. Otherwise, the HTML `<link rel="alternate">` tags are parsed.
pub async fn discover_feeds(url: &str) -> DomainResult<Vec<DiscoveredFeed>> {
    // Only allow http/https schemes to prevent SSRF against internal services
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(DomainError::Validation(
            "Only http:// and https:// URLs are supported".to_string(),
        ));
    }

    // Block requests to loopback and private network addresses
    if let Ok(parsed) = reqwest::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            if is_private_host(host) {
                return Err(DomainError::Validation(
                    "Requests to private/loopback addresses are not allowed".to_string(),
                ));
            }
        }
    }

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| DomainError::Network(e.to_string()))?;

    let response = client
        .get(url)
        .header("User-Agent", "UltraRSSReader/0.1")
        .send()
        .await
        .map_err(|e| DomainError::Network(e.to_string()))?;
    let final_url = response.url().to_string();

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();

    // If the URL itself is a feed, return it directly
    if is_feed_content_type(&content_type) {
        return Ok(vec![DiscoveredFeed {
            url: final_url,
            title: String::new(),
        }]);
    }

    let body = response
        .text()
        .await
        .map_err(|e| DomainError::Network(e.to_string()))?;

    // Try to detect if the body is a feed even without correct content-type
    let trimmed = body.trim_start();
    if trimmed.starts_with("<?xml") || trimmed.starts_with("<rss") || trimmed.starts_with("<feed") {
        return Ok(vec![DiscoveredFeed {
            url: final_url,
            title: String::new(),
        }]);
    }

    let feeds = extract_feed_links(&body, &final_url);
    Ok(feeds)
}

/// Check if a host string refers to a loopback or private network address.
fn is_private_host(host: &str) -> bool {
    let host_lower = host.to_lowercase();

    // Named loopback
    if host_lower == "localhost" {
        return true;
    }

    // Try parsing as IP address (strip [] for IPv6)
    let ip_str = host_lower.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = ip_str.parse::<std::net::IpAddr>() {
        return match ip {
            std::net::IpAddr::V4(v4) => {
                v4.is_loopback()           // 127.0.0.0/8
                    || v4.is_private()     // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                    || v4.is_unspecified() // 0.0.0.0
                    || v4.is_link_local() // 169.254.0.0/16
            }
            std::net::IpAddr::V6(v6) => {
                v6.is_loopback()       // ::1
                    || v6.is_unspecified() // ::
                    // Unique local (fc00::/7)
                    || (v6.segments()[0] & 0xfe00) == 0xfc00
                    // Link-local (fe80::/10)
                    || (v6.segments()[0] & 0xffc0) == 0xfe80
            }
        };
    }

    false
}

fn is_feed_content_type(ct: &str) -> bool {
    ct.contains("application/rss+xml")
        || ct.contains("application/atom+xml")
        || ct.contains("application/feed+json")
        || ct.contains("application/xml")
        || ct.contains("text/xml")
}

/// Extract feed URLs from HTML `<link>` tags using simple string parsing.
///
/// Looks for `<link rel="alternate" type="application/rss+xml" ...>`,
/// `<link rel="alternate" type="application/atom+xml" ...>`, and
/// `<link rel="alternate" type="application/feed+json" ...>` tags.
fn extract_feed_links(html: &str, base_url: &str) -> Vec<DiscoveredFeed> {
    let mut feeds = Vec::new();
    let html_lower = html.to_lowercase();

    // Find all <link ...> tags
    let mut search_from = 0;
    while let Some(start) = html_lower[search_from..].find("<link") {
        let abs_start = search_from + start;
        let remaining = &html_lower[abs_start..];
        let end = match remaining.find('>') {
            Some(e) => e,
            None => break,
        };
        let tag = &html[abs_start..abs_start + end + 1];
        search_from = abs_start + end + 1;

        if !has_alternate_rel(tag) {
            continue;
        }

        if !extract_attribute(tag, "type").is_some_and(|feed_type| is_feed_link_type(&feed_type)) {
            continue;
        }

        let href = extract_attribute(tag, "href").unwrap_or_default();
        if href.is_empty() {
            continue;
        }

        let title = extract_attribute(tag, "title").unwrap_or_default();
        let resolved_url = resolve_url(base_url, &href);

        feeds.push(DiscoveredFeed {
            url: resolved_url,
            title,
        });
    }

    feeds
}

fn has_alternate_rel(tag: &str) -> bool {
    extract_attribute(tag, "rel").is_some_and(|rel| {
        rel.split_ascii_whitespace()
            .any(|token| token.eq_ignore_ascii_case("alternate"))
    })
}

fn is_feed_link_type(feed_type: &str) -> bool {
    let normalized = feed_type
        .split(';')
        .next()
        .unwrap_or(feed_type)
        .trim()
        .to_ascii_lowercase();

    matches!(
        normalized.as_str(),
        "application/rss+xml" | "application/atom+xml" | "application/feed+json"
    )
}

/// Extract the value of an HTML attribute from a tag string.
fn extract_attribute(tag: &str, attr_name: &str) -> Option<String> {
    let tag_lower = tag.to_lowercase();
    let patterns = [format!("{attr_name}=\""), format!("{attr_name}='")];

    for pattern in &patterns {
        if let Some(start) = tag_lower.find(pattern.as_str()) {
            let quote = pattern.chars().last().unwrap();
            let value_start = start + pattern.len();
            let remaining = &tag[value_start..];
            if let Some(end) = remaining.find(quote) {
                return Some(remaining[..end].to_string());
            }
        }
    }
    None
}

/// Resolve a potentially relative URL against a base URL.
fn resolve_url(base: &str, href: &str) -> String {
    reqwest::Url::parse(base)
        .and_then(|base_url| base_url.join(href))
        .map(|url| url.to_string())
        .unwrap_or_else(|_| href.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_feed_links_rss() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="Main Feed" href="/feed.xml">
            </head><body></body></html>
        "#;
        let feeds = extract_feed_links(html, "https://example.com");
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].url, "https://example.com/feed.xml");
        assert_eq!(feeds[0].title, "Main Feed");
    }

    #[test]
    fn test_extract_feed_links_atom() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="https://example.com/atom.xml">
            </head><body></body></html>
        "#;
        let feeds = extract_feed_links(html, "https://example.com");
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].url, "https://example.com/atom.xml");
        assert_eq!(feeds[0].title, "Atom Feed");
    }

    #[test]
    fn test_extract_multiple_feeds() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml">
            <link rel="alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
            </head><body></body></html>
        "#;
        let feeds = extract_feed_links(html, "https://example.com");
        assert_eq!(feeds.len(), 2);
    }

    #[test]
    fn test_extract_feed_links_with_rel_token_list() {
        let html = r#"
            <html><head>
            <link rel="alternate nofollow" type="application/rss+xml" title="RSS" href="/rss.xml">
            <link rel="canonical alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
            </head><body></body></html>
        "#;
        let feeds = extract_feed_links(html, "https://example.com");
        assert_eq!(feeds.len(), 2);
        assert_eq!(feeds[0].url, "https://example.com/rss.xml");
        assert_eq!(feeds[1].url, "https://example.com/atom.xml");
    }

    #[test]
    fn test_extract_feed_links_json_feed() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/feed+json" title="JSON Feed" href="/feed.json">
            </head><body></body></html>
        "#;
        let feeds = extract_feed_links(html, "https://example.com");
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].url, "https://example.com/feed.json");
        assert_eq!(feeds[0].title, "JSON Feed");
    }

    #[test]
    fn test_extract_feed_links_rejects_non_alternate_rel_tokens() {
        let html = r#"
            <html><head>
            <link rel="alternate-stylesheet" type="application/rss+xml" title="RSS" href="/rss.xml">
            </head><body></body></html>
        "#;
        let feeds = extract_feed_links(html, "https://example.com");
        assert!(feeds.is_empty());
    }

    #[test]
    fn test_extract_no_feeds() {
        let html = r#"
            <html><head>
            <link rel="stylesheet" href="/style.css">
            </head><body></body></html>
        "#;
        let feeds = extract_feed_links(html, "https://example.com");
        assert!(feeds.is_empty());
    }

    #[test]
    fn test_resolve_url_absolute() {
        assert_eq!(
            resolve_url("https://example.com", "https://other.com/feed.xml"),
            "https://other.com/feed.xml"
        );
    }

    #[test]
    fn test_resolve_url_root_relative() {
        assert_eq!(
            resolve_url("https://example.com/page", "/feed.xml"),
            "https://example.com/feed.xml"
        );
    }

    #[test]
    fn test_extract_feed_links_resolves_relative_href_from_final_page_url() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
            <link rel="alternate" type="application/atom+xml" title="Atom" href="../atom.xml">
            <link rel="alternate" type="application/feed+json" title="JSON" href="/json/feed.json">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

        assert_eq!(feeds.len(), 3);
        assert_eq!(
            feeds[0].url,
            "https://example.com/articles/2026/feeds/rss.xml"
        );
        assert_eq!(feeds[1].url, "https://example.com/articles/atom.xml");
        assert_eq!(feeds[2].url, "https://example.com/json/feed.json");
    }

    #[test]
    fn test_resolve_url_protocol_relative() {
        assert_eq!(
            resolve_url("https://example.com", "//cdn.example.com/feed.xml"),
            "https://cdn.example.com/feed.xml"
        );
    }

    #[test]
    fn test_is_feed_content_type() {
        assert!(is_feed_content_type("application/rss+xml; charset=utf-8"));
        assert!(is_feed_content_type("application/atom+xml"));
        assert!(is_feed_content_type("application/feed+json"));
        assert!(is_feed_content_type("text/xml"));
        assert!(!is_feed_content_type("text/html; charset=utf-8"));
    }

    #[test]
    fn test_extract_attribute_double_quotes() {
        let tag = r#"<link rel="alternate" type="application/rss+xml" href="/feed.xml">"#;
        assert_eq!(
            extract_attribute(tag, "href"),
            Some("/feed.xml".to_string())
        );
        assert_eq!(
            extract_attribute(tag, "type"),
            Some("application/rss+xml".to_string())
        );
    }

    #[test]
    fn test_extract_attribute_single_quotes() {
        let tag = "<link rel='alternate' type='application/rss+xml' href='/feed.xml'>";
        assert_eq!(
            extract_attribute(tag, "href"),
            Some("/feed.xml".to_string())
        );
    }
}
