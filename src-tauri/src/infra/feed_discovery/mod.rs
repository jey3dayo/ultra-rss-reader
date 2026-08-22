use std::collections::HashSet;
#[cfg(not(test))]
use std::net::ToSocketAddrs;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::url_policy::{
    is_private_ip, validate_public_http_url, PRIVATE_URL_VALIDATION_MESSAGE,
    UNSUPPORTED_URL_VALIDATION_MESSAGE,
};
use crate::infra::provider::http_defaults;

#[cfg(test)]
const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str =
    http_defaults::DOWNGRADE_REDIRECT_VALIDATION_MESSAGE;
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

    let client =
        http_defaults::build_http_client(discovery_http_client_builder_for_url(&initial_url)?)?;

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

    let body = response_text_with_limit(response).await?;

    // If the URL itself is a feed, return it directly after validating the body
    // shape. This avoids treating arbitrary XML or JSON documents as feeds.
    if is_feed_content_type(&content_type) {
        validate_feed_body_for_content_type(&body, &content_type)?;
        return Ok(vec![DiscoveredFeed {
            url: final_url,
            title: String::new(),
        }]);
    }
    validate_discovery_response_content_type(&content_type)?;

    // Try to detect if the body is a feed even without correct content-type.
    if is_feed_body_fallback(&body) {
        validate_feed_body_for_content_type(&body, "application/rss+xml")?;
        return Ok(vec![DiscoveredFeed {
            url: final_url,
            title: String::new(),
        }]);
    }

    let feeds = extract_feed_links(&body, &final_url);
    Ok(feeds)
}

fn discovery_redirect_policy() -> reqwest::redirect::Policy {
    http_defaults::provider_redirect_policy(false, validate_discovery_url)
}

fn discovery_http_client_builder() -> reqwest::ClientBuilder {
    http_defaults::http_client_builder()
        .user_agent(DISCOVERY_USER_AGENT_POLICY)
        .dns_resolver(Arc::new(validated_public_dns_resolver()))
        .redirect(discovery_redirect_policy())
}

fn discovery_http_client_builder_for_url(
    url: &reqwest::Url,
) -> DomainResult<reqwest::ClientBuilder> {
    let resolved_addresses = validate_and_resolve_discovery_request_url(url)?;
    let Some(host) = url.host_str() else {
        return Ok(discovery_http_client_builder());
    };

    let resolver = validated_public_dns_resolver();
    resolver.seed(host, resolved_addresses.clone())?;
    if resolved_addresses.is_empty() {
        return Ok(discovery_http_client_builder().dns_resolver(Arc::new(resolver)));
    }

    Ok(discovery_http_client_builder()
        .dns_resolver(Arc::new(resolver))
        .resolve_to_addrs(host, &resolved_addresses))
}

#[cfg(test)]
fn validate_discovery_redirect(
    previous_urls: &[reqwest::Url],
    next_url: &reqwest::Url,
) -> DomainResult<()> {
    http_defaults::validate_provider_redirect(
        previous_urls,
        next_url,
        validate_discovery_request_url,
    )
}

pub(crate) fn validate_discovery_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_public_http_url(url)
}

pub(crate) fn validate_discovery_request_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_and_resolve_discovery_request_url(url).map(|_| ())
}

/// Validate the URL, resolve its host, and return the resolved public socket
/// addresses so callers can pin the connection to the validated addresses.
///
/// Returns an empty vector when the host is a literal IP (nothing to pin); a
/// non-empty vector of public addresses for a resolvable hostname; and an error
/// when validation fails or any resolved address is private.
pub(crate) fn resolve_validated_public_addrs(url: &reqwest::Url) -> DomainResult<Vec<SocketAddr>> {
    validate_and_resolve_discovery_request_url(url)
}

pub(crate) fn validated_public_dns_resolver() -> http_defaults::ValidatedPublicDnsResolver {
    http_defaults::ValidatedPublicDnsResolver::new(|host| resolve_host_addresses(host, 0))
}

fn validate_and_resolve_discovery_request_url(url: &reqwest::Url) -> DomainResult<Vec<SocketAddr>> {
    validate_discovery_url(url)?;
    validate_resolved_host_is_public(url)
}

fn validate_resolved_host_is_public(url: &reqwest::Url) -> DomainResult<Vec<SocketAddr>> {
    let Some(host) = url.host_str() else {
        return Ok(Vec::new());
    };
    if host.parse::<IpAddr>().is_ok() {
        return Ok(Vec::new());
    }
    let addresses = resolve_host_addresses(host, 0)?
        .into_iter()
        .map(|address| SocketAddr::new(address.ip(), 0))
        .collect::<Vec<_>>();

    for address in &addresses {
        if is_private_ip(address.ip()) {
            return Err(DomainError::Validation(
                PRIVATE_URL_VALIDATION_MESSAGE.to_string(),
            ));
        }
    }

    Ok(addresses)
}

#[cfg(not(test))]
fn resolve_host_addresses(host: &str, port: u16) -> DomainResult<Vec<SocketAddr>> {
    (host, port)
        .to_socket_addrs()
        .map(|addresses| addresses.collect())
        .map_err(|error| DomainError::Network(error.to_string()))
}

#[cfg(test)]
fn resolve_host_addresses(host: &str, port: u16) -> DomainResult<Vec<SocketAddr>> {
    match host {
        "localhost" | "localhost." => Ok(vec![SocketAddr::from(([127, 0, 0, 1], port))]),
        "blog.rust-lang.org" | "example.com" | "example.org" | "xn--r8jz45g.xn--zckzah" => {
            Ok(vec![SocketAddr::from(([93, 184, 216, 34], port))])
        }
        "private.test.invalid" => Ok(vec![SocketAddr::from(([127, 0, 0, 1], port))]),
        "public.test.invalid" => Ok(vec![SocketAddr::from(([93, 184, 216, 34], port))]),
        _ => Err(DomainError::Network(format!(
            "failed to resolve test host: {host}"
        ))),
    }
}

fn map_feed_discovery_request_error(error: reqwest::Error) -> DomainError {
    http_defaults::map_provider_request_error(error)
}

async fn response_text_with_limit(response: reqwest::Response) -> DomainResult<String> {
    let body = http_defaults::response_bytes_with_decoded_cap(
        response,
        http_defaults::DISCOVERY_RESPONSE_BODY_CAP_BYTES,
        discovery_body_too_large_error,
        DomainError::from_provider_http_error,
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

fn invalid_feed_document_error() -> DomainError {
    DomainError::Validation("Feed discovery response is not a valid feed document".to_string())
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

fn validate_feed_body_for_content_type(body: &str, content_type: &str) -> DomainResult<()> {
    if is_json_feed_content_type(content_type) {
        return validate_json_feed_body(body);
    }
    validate_xml_feed_body(body)
}

fn is_json_feed_content_type(ct: &str) -> bool {
    ct.split(';')
        .next()
        .unwrap_or(ct)
        .trim()
        .eq_ignore_ascii_case("application/feed+json")
}

fn validate_xml_feed_body(body: &str) -> DomainResult<()> {
    let trimmed = body.trim_start();
    let without_decl = trimmed
        .strip_prefix('\u{feff}')
        .unwrap_or(trimmed)
        .trim_start();
    let after_decl = without_decl
        .strip_prefix("<?xml")
        .and_then(|rest| rest.find("?>").map(|end| &rest[end + 2..]))
        .unwrap_or(without_decl)
        .trim_start();

    if after_decl.starts_with("<rss") || after_decl.starts_with("<feed") {
        Ok(())
    } else {
        Err(invalid_feed_document_error())
    }
}

fn validate_json_feed_body(body: &str) -> DomainResult<()> {
    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| invalid_feed_document_error())?;
    let Some(object) = value.as_object() else {
        return Err(invalid_feed_document_error());
    };
    let has_json_feed_version = object
        .get("version")
        .and_then(|version| version.as_str())
        .is_some_and(|version| version.starts_with("https://jsonfeed.org/version/"));
    let has_items_array = object.get("items").is_some_and(|items| items.is_array());

    if has_json_feed_version && has_items_array {
        Ok(())
    } else {
        Err(invalid_feed_document_error())
    }
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
    let without_decl = trimmed
        .strip_prefix('\u{feff}')
        .unwrap_or(trimmed)
        .trim_start();
    let after_decl = without_decl
        .strip_prefix("<?xml")
        .and_then(|rest| rest.find("?>").map(|end| &rest[end + 2..]))
        .unwrap_or(without_decl)
        .trim_start();
    after_decl.starts_with("<rss") || after_decl.starts_with("<feed")
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
mod tests;
