use std::collections::HashSet;
use std::net::{IpAddr, ToSocketAddrs};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::url_policy::{
    is_private_ip, validate_public_http_url, PRIVATE_URL_VALIDATION_MESSAGE,
    UNSUPPORTED_URL_VALIDATION_MESSAGE,
};
use crate::infra::provider::http_defaults;

const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str = "HTTPS to HTTP redirects are not allowed";
/// Feed discovery identifies itself with the shared provider HTTP user agent.
const DISCOVERY_USER_AGENT_POLICY: &str = http_defaults::PROVIDER_USER_AGENT;

/// A discovered feed from an HTML page.
#[derive(Debug, Clone)]
pub struct DiscoveredFeed {
    pub url: String,
    pub title: String,
}

/// Fetch the given URL and discover RSS/Atom feed links from the HTML.
///
/// Discovery is a user-initiated single URL probe, not a crawler. It uses the
/// shared provider User-Agent and does not prefetch robots.txt before the target
/// request.
///
/// If the URL itself points to a feed (Content-Type contains xml or json feed),
/// it is returned as-is. Otherwise, the HTML `<link rel="alternate">` tags are parsed.
pub async fn discover_feeds(url: &str) -> DomainResult<Vec<DiscoveredFeed>> {
    let initial_url = reqwest::Url::parse(url)
        .map_err(|_| DomainError::Validation(UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string()))?;
    validate_discovery_request_url(&initial_url)?;

    let client = discovery_http_client_builder()
        .build()
        .map_err(|e| DomainError::Network(e.to_string()))?;

    let response = client
        .get(initial_url)
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
    validate_discovery_response_content_type(&content_type)?;

    let body = response_text_with_limit(response).await?;

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

        match validate_discovery_redirect(attempt.previous(), attempt.url()) {
            Ok(()) => attempt.follow(),
            Err(error) => attempt.error(error.to_string()),
        }
    })
}

fn discovery_http_client_builder() -> reqwest::ClientBuilder {
    http_defaults::http_client_builder()
        .user_agent(DISCOVERY_USER_AGENT_POLICY)
        .redirect(discovery_redirect_policy())
}

fn validate_discovery_redirect(
    previous_urls: &[reqwest::Url],
    next_url: &reqwest::Url,
) -> DomainResult<()> {
    validate_discovery_request_url(next_url)?;

    if previous_urls
        .last()
        .is_some_and(|previous| previous.scheme() == "https" && next_url.scheme() == "http")
    {
        return Err(DomainError::Validation(
            DOWNGRADE_REDIRECT_VALIDATION_MESSAGE.to_string(),
        ));
    }

    Ok(())
}

pub(crate) fn validate_discovery_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_public_http_url(url)
}

fn validate_discovery_request_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_discovery_url(url)?;
    validate_resolved_host_is_public(url)
}

fn validate_resolved_host_is_public(url: &reqwest::Url) -> DomainResult<()> {
    let Some(host) = url.host_str() else {
        return Ok(());
    };
    if host.parse::<IpAddr>().is_ok() {
        return Ok(());
    }
    let port = url.port_or_known_default().unwrap_or(80);
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|error| DomainError::Network(error.to_string()))?;

    for address in addresses {
        if is_private_ip(address.ip()) {
            return Err(DomainError::Validation(
                PRIVATE_URL_VALIDATION_MESSAGE.to_string(),
            ));
        }
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
    if message.contains(DOWNGRADE_REDIRECT_VALIDATION_MESSAGE) {
        return DomainError::Validation(DOWNGRADE_REDIRECT_VALIDATION_MESSAGE.to_string());
    }

    DomainError::Network(message)
}

async fn response_text_with_limit(response: reqwest::Response) -> DomainResult<String> {
    let body = http_defaults::response_bytes_with_decoded_cap(
        response,
        http_defaults::DISCOVERY_RESPONSE_BODY_CAP_BYTES,
        discovery_body_too_large_error,
        |error| DomainError::Network(error.to_string()),
    )
    .await?;

    Ok(decode_discovery_response_body(&body))
}

fn discovery_body_too_large_error() -> DomainError {
    DomainError::Validation(format!(
        "Feed discovery response body exceeds {} bytes",
        http_defaults::DISCOVERY_RESPONSE_BODY_CAP_BYTES
    ))
}

fn unsupported_discovery_content_type_error(content_type: &str) -> DomainError {
    DomainError::Validation(format!(
        "Unsupported feed discovery response content type: {content_type}"
    ))
}

fn decode_discovery_response_body(body: &[u8]) -> String {
    String::from_utf8_lossy(body).into_owned()
}

fn is_feed_content_type(ct: &str) -> bool {
    let media_type = ct
        .split(';')
        .next()
        .unwrap_or(ct)
        .trim()
        .to_ascii_lowercase();

    matches!(
        media_type.as_str(),
        "application/rss+xml"
            | "application/atom+xml"
            | "application/feed+json"
            | "application/xml"
            | "text/xml"
    )
}

fn is_html_content_type(ct: &str) -> bool {
    ct.split(';')
        .next()
        .unwrap_or(ct)
        .trim()
        .eq_ignore_ascii_case("text/html")
}

fn validate_discovery_response_content_type(content_type: &str) -> DomainResult<()> {
    if content_type.trim().is_empty() || is_html_content_type(content_type) {
        return Ok(());
    }

    Err(unsupported_discovery_content_type_error(content_type))
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

    let resolved = resolve_url(base_url, &href);
    let Ok(page_url) = reqwest::Url::parse(base_url) else {
        return base_url.to_string();
    };
    let Ok(base_href_url) = reqwest::Url::parse(&resolved) else {
        return base_url.to_string();
    };

    if page_url.origin() == base_href_url.origin() {
        base_href_url.to_string()
    } else {
        base_url.to_string()
    }
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
                return Some(decode_html_attribute_value(&tag[value_start..value_end]));
            }

            cursor = value_end;
            continue;
        }

        value_start += quote.len_utf8();
        let value_end_offset = tag[value_start..].find(quote)?;
        if tag[name_start..name_end].eq_ignore_ascii_case(attr_name) {
            return Some(decode_html_attribute_value(
                &tag[value_start..value_start + value_end_offset],
            ));
        }

        cursor = value_start + value_end_offset + quote.len_utf8();
    }

    None
}

fn decode_html_attribute_value(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&#38;", "&")
        .replace("&#x26;", "&")
        .replace("&#X26;", "&")
        .replace("&quot;", "\"")
        .replace("&#34;", "\"")
        .replace("&#x22;", "\"")
        .replace("&#X22;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&#X27;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
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
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;

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
            <base href="https://example.com/site/subdir/">
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
                ("https://example.com/site/subdir/feeds/rss.xml", "RSS"),
                ("https://example.com/site/atom.xml", "Atom"),
                ("https://example.com/json/feed.json", "JSON"),
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
    fn test_extract_feed_links_handles_protocol_relative_base_and_private_candidate() {
        let html = r#"
            <html><head>
            <base href="//example.com/site/subdir/">
            <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
            <link rel="alternate" type="application/atom+xml" title="Private" href="//127.0.0.1/atom.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![("https://example.com/site/subdir/feeds/rss.xml", "RSS")],
        );
    }

    #[test]
    fn test_extract_feed_links_allows_same_origin_base_href_path_traversal_after_normalization() {
        let html = r#"
            <html><head>
            <base href="../../feeds/">
            <link rel="alternate" type="application/rss+xml" title="RSS" href="./rss.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![("https://example.com/feeds/rss.xml", "RSS")],
        );
    }

    #[test]
    fn test_extract_feed_links_decodes_html_attribute_entities_before_resolution() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="Tom &amp; Jerry" href="/feed.xml?format=rss&amp;lang=ja">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

        assert_eq!(feeds.len(), 1);
        assert_eq!(
            feeds[0].url,
            "https://example.com/feed.xml?format=rss&lang=ja"
        );
        assert_eq!(feeds[0].title, "Tom & Jerry");
    }

    #[test]
    fn test_extract_feed_links_decodes_numeric_html_attribute_entities_before_resolution() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="Tom &#38; Jerry" href="/feed.xml?format=rss&#x26;lang=ja&#X26;variant=full">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

        assert_eq!(feeds.len(), 1);
        assert_eq!(
            feeds[0].url,
            "https://example.com/feed.xml?format=rss&lang=ja&variant=full"
        );
        assert_eq!(feeds[0].title, "Tom & Jerry");
    }

    #[test]
    fn test_extract_feed_links_skips_malformed_link_tag_and_continues() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml href="/broken.xml">
            <link rel="alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![("https://example.com/atom.xml", "Atom")],
        );
    }

    #[test]
    fn test_extract_feed_links_ignores_cross_origin_base_href() {
        let html = r#"
            <html><head>
            <base href="https://cdn.example.com/site/subdir/">
            <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

        assert_eq!(feeds.len(), 1);
        assert_eq!(
            feeds[0].url,
            "https://example.com/articles/2026/feeds/rss.xml"
        );
    }

    #[test]
    fn test_extract_feed_links_ignores_cross_origin_base_href_even_with_path_traversal() {
        let html = r#"
            <html><head>
            <base href="https://cdn.example.com/site/../../feeds/">
            <link rel="alternate" type="application/rss+xml" title="RSS" href="rss.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![("https://example.com/articles/2026/rss.xml", "RSS")],
        );
    }

    #[test]
    fn test_extract_feed_links_dedupes_normalized_final_urls() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="First RSS" href="/feeds/../feed.xml">
            <link rel="alternate" type="application/rss+xml" title="Duplicate RSS" href="https://example.com:443/feed.xml">
            <link rel="alternate" type="application/atom+xml" title="Atom" href="./atom.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("https://example.com/feed.xml", "First RSS"),
                ("https://example.com/articles/atom.xml", "Atom"),
            ],
        );
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
            vec![
                ("https://example.org/articles/rss.xml", "Loopback Relative"),
                ("https://example.com/feed.xml", "Public Feed"),
            ],
        );
    }

    #[test]
    fn test_extract_feed_links_filters_private_url_corpus_after_base_resolution() {
        let html = r#"
            <html><head>
            <link rel="alternate" type="application/rss+xml" title="Loopback Relative" href="//127.0.0.1/rss.xml">
            <link rel="alternate" type="application/rss+xml" title="Localhost Trailing Dot" href="http://localhost./rss.xml">
            <link rel="alternate" type="application/rss+xml" title="Unspecified IPv4" href="http://0.0.0.0/rss.xml">
            <link rel="alternate" type="application/rss+xml" title="Link Local IPv4" href="http://169.254.1.1/rss.xml">
            <link rel="alternate" type="application/rss+xml" title="Unique Local IPv6" href="http://[fd00::1]/rss.xml">
            <link rel="alternate" type="application/atom+xml" title="Mapped IPv6" href="http://[::ffff:7f00:1]/atom.xml">
            <link rel="alternate" type="application/feed+json" title="Zone IPv6" href="http://[fe80::1%25en0]/feed.json">
            <link rel="alternate" type="application/rss+xml" title="Public IDNA" href="https://例え.テスト/feed.xml">
            <link rel="alternate" type="application/atom+xml" title="Punycode" href="https://xn--r8jz45g.xn--zckzah/atom.xml">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.org/articles/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.url.as_str(), feed.title.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("https://xn--r8jz45g.xn--zckzah/feed.xml", "Public IDNA"),
                ("https://xn--r8jz45g.xn--zckzah/atom.xml", "Punycode"),
            ],
        );
    }

    #[test]
    fn validate_resolved_host_rejects_dns_answers_to_private_ip() {
        let url = reqwest::Url::parse("http://localhost/feed.xml").unwrap();

        assert!(matches!(
            validate_resolved_host_is_public(&url),
            Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }

    #[test]
    fn validate_discovery_redirect_rejects_dns_rebinding_private_hostname_targets() {
        let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];
        let next = reqwest::Url::parse("https://localhost./feed.xml").unwrap();

        assert!(matches!(
            validate_discovery_redirect(&previous, &next),
            Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }

    #[test]
    fn validate_discovery_request_url_rejects_private_initial_boundary_corpus() {
        for raw_url in [
            "http://localhost./feed.xml",
            "http://0.0.0.0/feed.xml",
            "http://169.254.1.1/feed.xml",
            "http://[fd00::1]/feed.xml",
            "http://[fe80::1]/feed.xml",
            "http://[::ffff:a9fe:101]/feed.xml",
        ] {
            let url = reqwest::Url::parse(raw_url).unwrap();

            assert!(
                matches!(
                    validate_discovery_request_url(&url),
                    Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
                ),
                "{raw_url}"
            );
        }
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
            reqwest::Url::parse("http://[::ffff:7f00:1]/feed.xml").unwrap(),
            reqwest::Url::parse("http://[::ffff:a00:2]/feed.xml").unwrap(),
        ] {
            assert!(matches!(
                validate_discovery_url(&url),
                Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[test]
    fn discover_feeds_rejects_ipv6_zone_identifier_urls_before_network() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let error = runtime
            .block_on(discover_feeds("http://[fe80::1%25en0]/feed.xml"))
            .expect_err("IPv6 zone identifier URL should be rejected before request");

        assert!(matches!(
            error,
            DomainError::Validation(message) if message == UNSUPPORTED_URL_VALIDATION_MESSAGE
        ));
    }

    #[test]
    fn validate_discovery_url_allows_idna_and_punycode_public_hosts() {
        for (raw_url, expected_host) in [
            ("https://例え.テスト/feed.xml", "xn--r8jz45g.xn--zckzah"),
            (
                "https://xn--r8jz45g.xn--zckzah/feed.xml",
                "xn--r8jz45g.xn--zckzah",
            ),
        ] {
            let url = reqwest::Url::parse(raw_url).unwrap();

            assert_eq!(url.host_str(), Some(expected_host));
            assert!(validate_discovery_url(&url).is_ok());
        }
    }

    #[test]
    fn validate_discovery_url_rejects_credential_bearing_urls() {
        let url = reqwest::Url::parse("https://alice:secret@example.com/feed.xml").unwrap();

        assert!(validate_discovery_url(&url).is_err());
    }

    #[test]
    fn extract_feed_links_skips_private_and_credential_bearing_fixture_corpus() {
        let html = r#"
            <html><head>
            <base href="https://example.com/articles/">
            <link rel="alternate" type="application/rss+xml" title="Private Host" href="http://127.0.0.1/feed.xml">
            <link rel="alternate" type="application/rss+xml" title="Credential URL" href="https://alice:secret@example.com/feed.xml?token=raw">
            <link rel="alternate" type="application/rss+xml" title="Public Feed" href="feed.xml?token=raw">
            </head><body></body></html>
        "#;

        let feeds = extract_feed_links(html, "https://example.com/index.html");

        assert_eq!(
            feeds
                .iter()
                .map(|feed| (feed.title.as_str(), feed.url.as_str()))
                .collect::<Vec<_>>(),
            vec![(
                "Public Feed",
                "https://example.com/articles/feed.xml?token=raw"
            )],
        );
    }

    #[test]
    fn discover_feeds_rejects_private_and_unsupported_initial_urls_before_network() {
        let runtime = tokio::runtime::Runtime::new().unwrap();

        for url in [
            "http://localhost/feed.xml",
            "http://127.0.0.1/feed.xml",
            "http://10.0.0.2/feed.xml",
        ] {
            let error = runtime
                .block_on(discover_feeds(url))
                .expect_err("private initial discovery URL should be rejected");

            assert!(matches!(
                error,
                DomainError::Validation(message) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }

        for url in ["file:///tmp/feed.xml", "mailto:feed@example.com"] {
            let error = runtime
                .block_on(discover_feeds(url))
                .expect_err("unsupported initial discovery URL should be rejected");

            assert!(matches!(
                error,
                DomainError::Validation(message) if message == UNSUPPORTED_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[test]
    fn decode_discovery_response_body_uses_lossy_utf8_policy() {
        let body = b"<html><head><title>\xE3\x81broken</title></head></html>";

        assert_eq!(
            decode_discovery_response_body(body),
            "<html><head><title>\u{FFFD}broken</title></head></html>"
        );
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
    fn validate_discovery_redirect_rejects_https_to_http_downgrade() {
        let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];
        let next = reqwest::Url::parse("http://example.com/feed.xml").unwrap();

        assert!(matches!(
            validate_discovery_redirect(&previous, &next),
            Err(DomainError::Validation(message)) if message == DOWNGRADE_REDIRECT_VALIDATION_MESSAGE
        ));
    }

    #[test]
    fn validate_discovery_redirect_allows_http_to_https_upgrade() {
        let previous = vec![reqwest::Url::parse("http://example.com/page").unwrap()];
        let next = reqwest::Url::parse("https://example.com/feed.xml").unwrap();

        assert!(validate_discovery_redirect(&previous, &next).is_ok());
    }

    #[test]
    fn validate_discovery_redirect_rejects_private_redirect_targets() {
        let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];

        for next in [
            reqwest::Url::parse("https://localhost/feed.xml").unwrap(),
            reqwest::Url::parse("https://127.0.0.1/feed.xml").unwrap(),
            reqwest::Url::parse("https://10.0.0.2/feed.xml").unwrap(),
            reqwest::Url::parse("https://[::ffff:7f00:1]/feed.xml").unwrap(),
        ] {
            assert!(matches!(
                validate_discovery_redirect(&previous, &next),
                Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[test]
    fn validate_discovery_redirect_rejects_private_boundary_corpus() {
        let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];

        for raw_url in [
            "https://localhost./feed.xml",
            "https://0.0.0.0/feed.xml",
            "https://169.254.1.1/feed.xml",
            "https://[fd00::1]/feed.xml",
            "https://[fe80::1]/feed.xml",
            "https://[::ffff:a9fe:101]/feed.xml",
        ] {
            let next = reqwest::Url::parse(raw_url).unwrap();

            assert!(
                matches!(
                    validate_discovery_redirect(&previous, &next),
                    Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
                ),
                "{raw_url}"
            );
        }
    }

    #[test]
    fn test_is_feed_content_type() {
        assert!(is_feed_content_type("application/rss+xml; charset=utf-8"));
        assert!(is_feed_content_type("application/atom+xml"));
        assert!(is_feed_content_type("application/feed+json"));
        assert!(is_feed_content_type("text/xml"));
        assert!(!is_feed_content_type("text/html; charset=utf-8"));
        assert!(!is_feed_content_type(
            "text/plain; note=application/rss+xml"
        ));
    }

    #[test]
    fn validate_discovery_response_content_type_allows_html_and_missing_type() {
        assert!(validate_discovery_response_content_type("text/html; charset=utf-8").is_ok());
        assert!(validate_discovery_response_content_type("").is_ok());
    }

    #[test]
    fn validate_discovery_response_content_type_rejects_binary_type() {
        assert!(matches!(
            validate_discovery_response_content_type("application/octet-stream"),
            Err(DomainError::Validation(message))
                if message.contains("Unsupported feed discovery response content type")
        ));
    }

    #[test]
    fn validate_discovery_response_content_type_rejects_text_plain_xml_sniffing() {
        assert!(matches!(
            validate_discovery_response_content_type("text/plain; charset=utf-8"),
            Err(DomainError::Validation(message))
                if message.contains("Unsupported feed discovery response content type")
        ));
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

    #[tokio::test]
    async fn discovery_http_client_sends_shared_user_agent_and_does_not_prefetch_robots() {
        assert_eq!(
            DISCOVERY_USER_AGENT_POLICY,
            http_defaults::PROVIDER_USER_AGENT
        );

        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let (request_tx, request_rx) = mpsc::channel();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("client should connect");
            let mut request = [0_u8; 2048];
            let bytes_read = stream.read(&mut request).unwrap_or(0);
            request_tx
                .send(String::from_utf8_lossy(&request[..bytes_read]).into_owned())
                .expect("test should receive captured request");
            stream
                .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
                .expect("test server should write response");
        });

        let response = discovery_http_client_builder()
            .build()
            .expect("discovery client should build")
            .get(format!("http://{address}/page"))
            .send()
            .await
            .expect("discovery client should send request");

        assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        server.join().expect("test server should finish");
        let request = request_rx
            .recv()
            .expect("test should capture discovery request")
            .to_ascii_lowercase();
        assert!(request.starts_with("get /page "));
        assert!(!request.contains("/robots.txt"));
        assert!(request.contains(&format!(
            "user-agent: {}",
            DISCOVERY_USER_AGENT_POLICY.to_ascii_lowercase()
        )));
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
