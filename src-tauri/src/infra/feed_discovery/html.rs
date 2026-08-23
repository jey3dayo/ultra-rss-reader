use std::collections::HashSet;

use super::DiscoveredFeed;

/// Extract feed URLs from HTML `<link>` tags using simple string parsing.
///
/// Looks for `<link rel="alternate" type="application/rss+xml" ...>`,
/// `<link rel="alternate" type="application/atom+xml" ...>`, and
/// `<link rel="alternate" type="application/feed+json" ...>` tags.
pub(crate) fn extract_feed_links(html: &str, base_url: &str) -> Vec<DiscoveredFeed> {
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

pub(crate) fn resolve_html_base_url(html: &str, html_lower: &str, base_url: &str) -> String {
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

pub(crate) fn has_alternate_rel(tag: &str) -> bool {
    extract_attribute(tag, "rel").is_some_and(|rel| {
        rel.split_ascii_whitespace()
            .any(|token| token.eq_ignore_ascii_case("alternate"))
    })
}

pub(crate) fn is_feed_link_type(feed_type: &str) -> bool {
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
pub(crate) fn extract_attribute(tag: &str, attr_name: &str) -> Option<String> {
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

pub(crate) fn decode_html_attribute_value(value: &str) -> String {
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

pub(crate) fn resolve_url(base: &str, href: &str) -> String {
    reqwest::Url::parse(base)
        .and_then(|base_url| base_url.join(href))
        .map(|url| url.to_string())
        .unwrap_or_else(|_| href.to_string())
}

pub(crate) fn resolve_feed_candidate_url(base: &str, href: &str) -> Option<String> {
    let resolved_url = resolve_url(base, href);
    let parsed_url = reqwest::Url::parse(&resolved_url).ok()?;
    super::validate_discovery_url(&parsed_url).ok()?;
    Some(parsed_url.to_string())
}
