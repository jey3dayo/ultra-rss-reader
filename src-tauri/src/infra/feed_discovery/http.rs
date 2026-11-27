use std::net::IpAddr;
use std::sync::Arc;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::url_policy::{is_private_host, validate_user_provided_feed_url};
use crate::infra::provider::http_defaults;

use super::{
    validate_and_resolve_discovery_request_url, validate_discovery_url,
    validated_public_dns_resolver,
};

pub(crate) const DISCOVERY_USER_AGENT_POLICY: &str = http_defaults::PROVIDER_USER_AGENT;

pub(crate) fn discovery_redirect_policy() -> reqwest::redirect::Policy {
    http_defaults::provider_redirect_policy(false, validate_discovery_url)
}

pub(crate) fn discovery_http_client_builder() -> reqwest::ClientBuilder {
    http_defaults::http_client_builder()
        .user_agent(DISCOVERY_USER_AGENT_POLICY)
        .dns_resolver(Arc::new(validated_public_dns_resolver()))
        .redirect(discovery_redirect_policy())
}

pub(crate) fn discovery_http_client_builder_for_url(
    url: &reqwest::Url,
) -> DomainResult<reqwest::ClientBuilder> {
    if url.host_str().is_some_and(is_private_host) {
        return discovery_http_client_builder_for_user_selected_url(url);
    }

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

/// Builds the discovery client for a feed URL whose host is private or
/// local-network: the user explicitly entered the URL, so the host is exempt
/// from the public-address filter (the same treatment as a user-provided
/// server endpoint). Redirects may only stay on that initial host; hops to
/// any other host go through the normal public validation.
fn discovery_http_client_builder_for_user_selected_url(
    url: &reqwest::Url,
) -> DomainResult<reqwest::ClientBuilder> {
    validate_user_provided_feed_url(url)?;
    let host = url.host_str().unwrap_or_default();
    let resolver = validated_public_dns_resolver();
    if host.parse::<IpAddr>().is_err() {
        resolver.seed_user_selected_host(host)?;
    }

    Ok(http_defaults::http_client_builder()
        .user_agent(DISCOVERY_USER_AGENT_POLICY)
        .dns_resolver(Arc::new(resolver))
        .redirect(
            http_defaults::provider_redirect_policy_for_initial_private_host(
                Some(host.to_owned()),
                validate_discovery_url,
            ),
        ))
}

pub(crate) fn map_feed_discovery_request_error(error: reqwest::Error) -> DomainError {
    http_defaults::map_provider_request_error(error)
}

pub(crate) async fn response_text_with_limit(response: reqwest::Response) -> DomainResult<String> {
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

pub(crate) fn decode_discovery_response_body(body: &[u8]) -> String {
    String::from_utf8_lossy(body).into_owned()
}

fn invalid_feed_document_error() -> DomainError {
    DomainError::Validation("Feed discovery response is not a valid feed document".to_string())
}

pub(crate) fn is_feed_content_type(ct: &str) -> bool {
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

pub(crate) fn validate_feed_body_for_content_type(
    body: &str,
    content_type: &str,
) -> DomainResult<()> {
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
    if is_feed_body_fallback(body) {
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

pub(crate) fn validate_discovery_response_content_type(content_type: &str) -> DomainResult<()> {
    if content_type.trim().is_empty() || is_html_content_type(content_type) {
        return Ok(());
    }

    Err(unsupported_discovery_content_type_error(content_type))
}

pub(crate) fn is_feed_body_fallback(body: &str) -> bool {
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
    after_decl.starts_with("<rss")
        || after_decl.starts_with("<feed")
        || is_rss_1_0_document(after_decl)
}

const RSS_1_0_NAMESPACE: &str = "http://purl.org/rss/1.0/";

fn is_rss_1_0_document(after_decl: &str) -> bool {
    after_decl
        .strip_prefix("<rdf:RDF")
        .is_some_and(|rest| rest.starts_with(|c: char| c == '>' || c.is_whitespace()))
        && after_decl.contains(RSS_1_0_NAMESPACE)
}
