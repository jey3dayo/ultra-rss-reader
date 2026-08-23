#[cfg(not(test))]
use std::net::ToSocketAddrs;
use std::net::{IpAddr, SocketAddr};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::url_policy::{
    is_private_ip, validate_public_http_url, PRIVATE_URL_VALIDATION_MESSAGE,
    UNSUPPORTED_URL_VALIDATION_MESSAGE,
};
use crate::infra::provider::http_defaults;

mod html;
mod http;

#[cfg(test)]
const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str =
    http_defaults::DOWNGRADE_REDIRECT_VALIDATION_MESSAGE;

#[cfg(test)]
pub(super) use html::{extract_attribute, extract_feed_links, resolve_url};
#[cfg(test)]
pub(super) use http::{
    decode_discovery_response_body, discovery_http_client_builder, is_feed_body_fallback,
    is_feed_content_type, validate_discovery_response_content_type,
    validate_feed_body_for_content_type, DISCOVERY_USER_AGENT_POLICY,
};

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

    let client = http::discovery_http_client_builder_for_url(&initial_url)?;
    let client = http_defaults::build_http_client(client)?;

    let response = client
        .get(initial_url)
        .send()
        .await
        .map_err(http::map_feed_discovery_request_error)?;
    let final_url = response.url().to_string();

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();

    let body = http::response_text_with_limit(response).await?;

    // If the URL itself is a feed, return it directly after validating the body
    // shape. This avoids treating arbitrary XML or JSON documents as feeds.
    if http::is_feed_content_type(&content_type) {
        http::validate_feed_body_for_content_type(&body, &content_type)?;
        return Ok(vec![DiscoveredFeed {
            url: final_url,
            title: String::new(),
        }]);
    }
    http::validate_discovery_response_content_type(&content_type)?;

    // Try to detect if the body is a feed even without correct content-type.
    if http::is_feed_body_fallback(&body) {
        http::validate_feed_body_for_content_type(&body, "application/rss+xml")?;
        return Ok(vec![DiscoveredFeed {
            url: final_url,
            title: String::new(),
        }]);
    }

    let feeds = html::extract_feed_links(&body, &final_url);
    Ok(feeds)
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

#[cfg(test)]
mod tests;
