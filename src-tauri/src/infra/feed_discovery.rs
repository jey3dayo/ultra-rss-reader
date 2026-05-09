use std::collections::HashSet;

use crate::domain::error::{DomainError, DomainResult};

const PRIVATE_URL_VALIDATION_MESSAGE: &str =
    "Requests to private/loopback addresses are not allowed";
const UNSUPPORTED_URL_VALIDATION_MESSAGE: &str = "Only http:// and https:// URLs are supported";

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
    let initial_url = reqwest::Url::parse(url)
        .map_err(|_| DomainError::Validation(UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string()))?;
    validate_discovery_url(&initial_url)?;

    let client = reqwest::Client::builder()
        .redirect(discovery_redirect_policy())
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| DomainError::Network(e.to_string()))?;

    let response = client
        .get(initial_url)
        .header("User-Agent", "UltraRSSReader/0.1")
        .send()
        .await
        .map_err(map_feed_discovery_request_error)?;
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
    if is_feed_body_fallback(&body) {
        return Ok(vec![DiscoveredFeed {
            url: final_url,
            title: String::new(),
        }]);
    }

    let feeds = extract_feed_links(&body, &final_url);
    Ok(feeds)
}

fn discovery_redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() > 5 {
            return attempt.error("too many redirects");
        }

        match validate_discovery_url(attempt.url()) {
            Ok(()) => attempt.follow(),
            Err(error) => attempt.error(error.to_string()),
        }
    })
}

fn validate_discovery_url(url: &reqwest::Url) -> DomainResult<()> {
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(DomainError::Validation(
            UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }

    if url.host_str().is_some_and(is_private_host) {
        return Err(DomainError::Validation(
            PRIVATE_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }

    Ok(())
}

fn map_feed_discovery_request_error(error: reqwest::Error) -> DomainError {
    let message = error.to_string();
    if message.contains(PRIVATE_URL_VALIDATION_MESSAGE) {
        return DomainError::Validation(PRIVATE_URL_VALIDATION_MESSAGE.to_string());
    }
    if message.contains(UNSUPPORTED_URL_VALIDATION_MESSAGE) {
        return DomainError::Validation(UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string());
    }

    DomainError::Network(message)
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

fn is_feed_body_fallback(body: &str) -> bool {
    let trimmed = body.trim_start();
    trimmed.starts_with("<?xml") || trimmed.starts_with("<rss") || trimmed.starts_with("<feed")
}

/// Extract feed URLs from HTML `<link>` tags using simple string parsing.
///
/// Looks for `<link rel="alternate" type="application/rss+xml" ...>`,
/// `<link rel="alternate" type="application/atom+xml" ...>`, and
/// `<link rel="alternate" type="application/feed+json" ...>` tags.
fn extract_feed_links(html: &str, base_url: &str) -> Vec<DiscoveredFeed> {
    let mut feeds = Vec::new();
    let mut seen_urls = HashSet::new();
    let html_lower = html.to_lowercase();
    let feed_base_url = resolve_html_base_url(html, &html_lower, base_url);

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
        let Some(resolved_url) = resolve_feed_candidate_url(&feed_base_url, &href) else {
            continue;
        };
        if !seen_urls.insert(resolved_url.clone()) {
            continue;
        }

        feeds.push(DiscoveredFeed {
            url: resolved_url,
            title,
        });
    }

    feeds
}

fn resolve_html_base_url(html: &str, html_lower: &str, base_url: &str) -> String {
    let Some(start) = html_lower.find("<base") else {
        return base_url.to_string();
    };
    let remaining = &html_lower[start..];
    let Some(end) = remaining.find('>') else {
        return base_url.to_string();
    };
    let tag = &html[start..start + end + 1];
    let Some(href) = extract_attribute(tag, "href").filter(|href| !href.trim().is_empty()) else {
        return base_url.to_string();
    };

    resolve_url(base_url, &href)
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
    let mut cursor = 0;

    while cursor < tag.len() {
        let Some(name_start_offset) = tag[cursor..].find(|c: char| !c.is_ascii_whitespace()) else {
            break;
        };
        let name_start = cursor + name_start_offset;
        let name_end = tag[name_start..]
            .find(|c: char| c.is_ascii_whitespace() || c == '=' || c == '>')
            .map_or(tag.len(), |end| name_start + end);

        if name_start == name_end {
            cursor = name_start + 1;
            continue;
        }

        let mut after_name = name_end;
        while tag[after_name..].starts_with(|c: char| c.is_ascii_whitespace()) {
            after_name += tag[after_name..].chars().next()?.len_utf8();
        }

        if !tag[after_name..].starts_with('=') {
            cursor = after_name;
            continue;
        }

        let mut value_start = after_name + '='.len_utf8();
        while tag[value_start..].starts_with(|c: char| c.is_ascii_whitespace()) {
            value_start += tag[value_start..].chars().next()?.len_utf8();
        }

        let quote = tag[value_start..].chars().next()?;
        if quote != '"' && quote != '\'' {
            let value_end = tag[value_start..]
                .find(|c: char| c.is_ascii_whitespace() || c == '>')
                .map_or(tag.len(), |end| value_start + end);
            if value_end == value_start {
                cursor = value_start + quote.len_utf8();
                continue;
            }
            if tag[name_start..name_end].eq_ignore_ascii_case(attr_name) {
                return Some(tag[value_start..value_end].to_string());
            }

            cursor = value_end;
            continue;
        }

        value_start += quote.len_utf8();
        let value_end_offset = tag[value_start..].find(quote)?;
        if tag[name_start..name_end].eq_ignore_ascii_case(attr_name) {
            return Some(tag[value_start..value_start + value_end_offset].to_string());
        }

        cursor = value_start + value_end_offset + quote.len_utf8();
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

fn resolve_feed_candidate_url(base: &str, href: &str) -> Option<String> {
    let resolved_url = resolve_url(base, href);
    let parsed_url = reqwest::Url::parse(&resolved_url).ok()?;
    validate_discovery_url(&parsed_url).ok()?;
    Some(parsed_url.to_string())
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
    fn test_extract_feed_links_accepts_attribute_whitespace_around_equals() {
        let html = r#"
            <html><head>
            <link rel = "alternate" type = "application/rss+xml" title = "RSS" href = "/rss.xml">
            <link rel='alternate' type = 'application/atom+xml' title='Atom' href = 'atom.xml'>
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("https://example.com/rss.xml", "RSS"),
                ("https://example.com/articles/atom.xml", "Atom"),
            ],
        );
    }

    #[test]
    fn test_extract_feed_links_accepts_unquoted_attributes() {
        let html = r#"
            <html><head>
            <link rel=alternate type=application/rss+xml href=/feed.xml title=Feed>
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![("https://example.com/feed.xml", "Feed")],
        );
    }

    #[test]
    fn test_extract_feed_links_dedupes_resolved_urls_preserving_first_order() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="First RSS" href="/feed.xml">
            <link rel="alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
            <link rel="alternate" type="application/rss+xml" title="Duplicate RSS" href="https://example.com/feed.xml">
            <link rel="alternate" type="application/feed+json" title="JSON" href="/feed.json">
            <link rel="alternate" type="application/rss+xml" title="Duplicate Atom" href="./atom.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("https://example.com/feed.xml", "First RSS"),
                ("https://example.com/atom.xml", "Atom"),
                ("https://example.com/feed.json", "JSON"),
            ],
        );
    }

    #[test]
    fn test_extract_feed_links_normalizes_candidates_without_network() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml; charset=utf-8" title="RSS" href="./feed.xml">
            <link rel="alternate" type="application/atom+xml" title="" href="//cdn.example.com/atom.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("https://example.com/articles/feed.xml", "RSS"),
                ("https://cdn.example.com/atom.xml", ""),
            ],
        );
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
    fn test_extract_feed_links_resolves_relative_href_from_html_base_href() {
        let html = r#"
            <html><head>
            <base href="https://cdn.example.com/site/subdir/">
            <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
            <link rel="alternate" type="application/atom+xml" title="Atom" href="../atom.xml">
            <link rel="alternate" type="application/feed+json" title="JSON" href="/json/feed.json">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("https://cdn.example.com/site/subdir/feeds/rss.xml", "RSS"),
                ("https://cdn.example.com/site/atom.xml", "Atom"),
                ("https://cdn.example.com/json/feed.json", "JSON"),
            ],
        );
    }

    #[test]
    fn test_extract_feed_links_resolves_relative_base_href_from_final_page_url() {
        let html = r#"
            <html><head>
            <base href="../feeds/">
            <link rel="alternate" type="application/rss+xml" title="RSS" href="rss.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].url, "https://example.com/articles/feeds/rss.xml");
    }

    #[test]
    fn test_extract_feed_links_filters_resolved_private_and_unsupported_candidates() {
        let html = r#"
            <html><head>
            <base href="http://127.0.0.1/private/">
            <link rel="alternate" type="application/rss+xml" title="Loopback Relative" href="rss.xml">
            <link rel="alternate" type="application/atom+xml" title="Loopback Absolute" href="http://127.0.0.1/atom.xml">
            <link rel="alternate" type="application/feed+json" title="File Feed" href="file:///tmp/feed.json">
            <link rel="alternate" type="application/rss+xml" title="Public Feed" href="https://example.com/feed.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.org/articles/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![("https://example.com/feed.xml", "Public Feed")],
        );
    }

    #[test]
    fn test_resolve_url_protocol_relative() {
        assert_eq!(
            resolve_url("https://example.com", "//cdn.example.com/feed.xml"),
            "https://cdn.example.com/feed.xml"
        );
    }

    #[test]
    fn validate_discovery_url_allows_public_http_and_https_urls() {
        for url in [
            reqwest::Url::parse("https://example.com/feed.xml").unwrap(),
            reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
        ] {
            assert!(validate_discovery_url(&url).is_ok());
        }
    }

    #[test]
    fn validate_discovery_url_rejects_private_and_loopback_redirect_targets() {
        for url in [
            reqwest::Url::parse("http://localhost/feed.xml").unwrap(),
            reqwest::Url::parse("http://127.0.0.1/feed.xml").unwrap(),
            reqwest::Url::parse("http://10.0.0.2/feed.xml").unwrap(),
            reqwest::Url::parse("http://[::1]/feed.xml").unwrap(),
        ] {
            assert!(matches!(
                validate_discovery_url(&url),
                Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[test]
    fn validate_discovery_url_rejects_unsupported_redirect_schemes() {
        let url = reqwest::Url::parse("file:///etc/passwd").unwrap();

        assert!(matches!(
            validate_discovery_url(&url),
            Err(DomainError::Validation(message)) if message == UNSUPPORTED_URL_VALIDATION_MESSAGE
        ));
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
    fn test_feed_body_fallback_accepts_rss_atom_and_xml_when_content_type_is_misleading_or_missing()
    {
        for body in [
            r#"<rss version="2.0"><channel><title>RSS</title></channel></rss>"#,
            r#"<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title></feed>"#,
            r#"<?xml version="1.0"?><rss version="2.0"></rss>"#,
            r#"
                <?xml version="1.0"?><feed></feed>
            "#,
        ] {
            assert!(
                is_feed_body_fallback(body),
                "body should be treated as a feed fallback: {body}"
            );
        }
    }

    #[test]
    fn test_feed_body_fallback_rejects_html_when_content_type_is_misleading_or_missing() {
        for body in [
            r#"<html><head><title>Site</title></head><body></body></html>"#,
            r#"{"version":"https://jsonfeed.org/version/1.1","items":[]}"#,
            "",
        ] {
            assert!(
                !is_feed_body_fallback(body),
                "body should not be treated as a feed fallback: {body}"
            );
        }
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

    #[test]
    fn test_extract_attribute_allows_whitespace_around_equals() {
        let tag = r#"<link rel = "alternate" type = 'application/rss+xml' href = "/feed.xml">"#;

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
    fn test_extract_attribute_accepts_unquoted_values() {
        let tag = r#"<link rel=alternate type=application/rss+xml href=/feed.xml title=Feed>"#;

        assert_eq!(extract_attribute(tag, "rel"), Some("alternate".to_string()));
        assert_eq!(
            extract_attribute(tag, "type"),
            Some("application/rss+xml".to_string())
        );
        assert_eq!(
            extract_attribute(tag, "href"),
            Some("/feed.xml".to_string())
        );
        assert_eq!(extract_attribute(tag, "title"), Some("Feed".to_string()));
    }

    #[test]
    fn test_extract_attribute_ignores_attribute_like_text_inside_values() {
        let tag = r#"<link title='href = "/not-feed.xml"' href = "/feed.xml">"#;

        assert_eq!(
            extract_attribute(tag, "href"),
            Some("/feed.xml".to_string())
        );
    }
}
