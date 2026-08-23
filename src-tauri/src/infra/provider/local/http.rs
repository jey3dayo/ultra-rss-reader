use reqwest::header::{ETAG, LAST_MODIFIED};
use std::net::SocketAddr;
use std::sync::Arc;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::url_policy::{
    CREDENTIAL_URL_VALIDATION_MESSAGE, PRIVATE_URL_VALIDATION_MESSAGE,
    UNSUPPORTED_URL_VALIDATION_MESSAGE,
};
#[cfg(test)]
use crate::infra::feed_discovery::validate_discovery_request_url;
use crate::infra::feed_discovery::{validate_discovery_url, validated_public_dns_resolver};
use crate::repository::sync_state::{
    normalize_http_etag_validator, normalize_http_last_modified_validator,
};

use super::super::http_defaults::{self, http_client_builder};
use super::LocalProvider;

pub(super) const FEED_RESPONSE_BODY_INCOMPLETE_MESSAGE: &str =
    "Feed response body ended before the declared response length";
pub(super) const JSON_FEED_SUPPORT_DECISION: &str =
    "JSON Feed is supported only at explicit application/feed+json parser boundaries";
const XML_DOCTYPE_DECLARATION: &[u8] = b"<!DOCTYPE";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum FeedResponseContentType {
    XmlOrFeed,
    JsonFeed,
    HtmlFallback,
    MissingFallback,
}

impl LocalProvider {
    pub(super) fn build_http_client(
        allow_private_feed_urls: bool,
    ) -> DomainResult<reqwest::Client> {
        http_defaults::build_http_client(
            http_client_builder().redirect(Self::redirect_policy(allow_private_feed_urls)),
        )
    }

    pub(super) fn redirect_policy(allow_private_feed_urls: bool) -> reqwest::redirect::Policy {
        http_defaults::provider_redirect_policy(allow_private_feed_urls, validate_discovery_url)
    }

    fn http_client(&self) -> DomainResult<&reqwest::Client> {
        self.http_client.as_ref().map_err(|error| error.clone())
    }

    pub(super) fn feed_http_client(
        &self,
        url: &reqwest::Url,
        resolved_addrs: &[SocketAddr],
    ) -> DomainResult<reqwest::Client> {
        self.build_feed_http_client(
            url,
            resolved_addrs,
            validated_public_dns_resolver(),
            |resolver, host, addresses| resolver.seed(host, addresses.to_vec()),
        )
    }

    #[cfg(test)]
    pub(super) fn feed_http_client_with_test_resolver(
        &self,
        url: &reqwest::Url,
        resolved_addrs: &[SocketAddr],
        resolver: http_defaults::ValidatedPublicDnsResolver,
    ) -> DomainResult<reqwest::Client> {
        self.build_feed_http_client(
            url,
            resolved_addrs,
            resolver,
            |resolver, host, addresses| resolver.seed_for_test(host, addresses.to_vec()),
        )
    }

    fn build_feed_http_client(
        &self,
        url: &reqwest::Url,
        resolved_addrs: &[SocketAddr],
        resolver: http_defaults::ValidatedPublicDnsResolver,
        seed_resolver: impl FnOnce(
            &http_defaults::ValidatedPublicDnsResolver,
            &str,
            &[SocketAddr],
        ) -> DomainResult<()>,
    ) -> DomainResult<reqwest::Client> {
        let shared_client = self.http_client()?;
        if self.allow_private_feed_urls {
            return Ok(shared_client.clone());
        }
        let Some(host) = url.host_str() else {
            return Ok(shared_client.clone());
        };
        if !resolved_addrs.is_empty() {
            seed_resolver(&resolver, host, resolved_addrs)?;
        }
        let mut builder = http_client_builder()
            .dns_resolver(Arc::new(resolver))
            .redirect(http_defaults::provider_redirect_policy(
                false,
                validate_discovery_url,
            ));
        if !resolved_addrs.is_empty() {
            builder = builder.resolve_to_addrs(host, resolved_addrs);
        }
        http_defaults::build_http_client(builder)
    }

    fn header_value_to_string(
        headers: &reqwest::header::HeaderMap,
        name: reqwest::header::HeaderName,
    ) -> Option<String> {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(ToString::to_string)
    }

    pub(super) fn response_etag_validator(headers: &reqwest::header::HeaderMap) -> Option<String> {
        normalize_http_etag_validator(Self::header_value_to_string(headers, ETAG))
    }

    pub(super) fn response_last_modified_validator(
        headers: &reqwest::header::HeaderMap,
    ) -> Option<String> {
        normalize_http_last_modified_validator(Self::header_value_to_string(headers, LAST_MODIFIED))
    }

    pub(super) async fn response_bytes_with_limit(
        response: reqwest::Response,
    ) -> DomainResult<(Vec<u8>, FeedResponseContentType)> {
        let content_type = feed_response_content_type(response.headers())?;

        let bytes = http_defaults::response_bytes_with_decoded_cap(
            response,
            http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES,
            feed_body_too_large_error,
            feed_response_body_read_error,
        )
        .await?;
        validate_feed_response_body_against_content_type(&bytes, content_type)?;

        Ok((bytes, content_type))
    }

    pub(super) fn reject_xml_doctype_declaration(feed_body: &[u8]) -> DomainResult<()> {
        let has_doctype = feed_body
            .windows(XML_DOCTYPE_DECLARATION.len())
            .any(|window| window.eq_ignore_ascii_case(XML_DOCTYPE_DECLARATION));

        if has_doctype {
            return Err(DomainError::Parse(
                "DOCTYPE declarations are not supported at feed parser boundaries".to_string(),
            ));
        }

        Ok(())
    }
}

fn feed_body_too_large_error() -> DomainError {
    DomainError::Network(format!(
        "Feed response body exceeds {} bytes",
        http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
    ))
}

fn unsupported_feed_content_type_error(content_type: &str) -> DomainError {
    DomainError::Network(format!(
        "Unsupported feed response content type: {content_type}"
    ))
}

fn feed_response_body_read_error(error: reqwest::Error) -> DomainError {
    let _ = error;
    DomainError::Network(FEED_RESPONSE_BODY_INCOMPLETE_MESSAGE.to_string())
}

#[cfg(test)]
pub(super) fn validate_external_feed_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_discovery_request_url(url).map(|_| ())
}

#[cfg(test)]
pub(super) fn validate_external_feed_redirect(
    previous_urls: &[reqwest::Url],
    next_url: &reqwest::Url,
) -> DomainResult<()> {
    http_defaults::validate_provider_redirect(previous_urls, next_url, validate_discovery_url)
}

pub(super) fn feed_response_content_type(
    headers: &reqwest::header::HeaderMap,
) -> DomainResult<FeedResponseContentType> {
    let content_type = headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    let Some(content_type) = content_type else {
        return Ok(FeedResponseContentType::MissingFallback);
    };
    let media_type = content_type
        .split(';')
        .next()
        .unwrap_or(content_type)
        .trim()
        .to_ascii_lowercase();

    match media_type.as_str() {
        "application/feed+json" => Ok(FeedResponseContentType::JsonFeed),
        "application/rss+xml" | "application/atom+xml" | "application/xml" | "text/xml" => {
            Ok(FeedResponseContentType::XmlOrFeed)
        }
        "text/html" => Ok(FeedResponseContentType::HtmlFallback),
        _ => Err(unsupported_feed_content_type_error(content_type)),
    }
}

pub(super) fn validate_feed_response_body_against_content_type(
    body: &[u8],
    content_type: FeedResponseContentType,
) -> DomainResult<()> {
    if content_type == FeedResponseContentType::JsonFeed || !looks_like_json_feed(body) {
        return Ok(());
    }

    Err(DomainError::Parse(JSON_FEED_SUPPORT_DECISION.to_string()))
}

fn looks_like_json_feed(body: &[u8]) -> bool {
    let body = String::from_utf8_lossy(body);
    let trimmed = body.trim_start_matches('\u{feff}').trim_start();
    trimmed.starts_with('{') && trimmed.contains("\"version\"") && trimmed.contains("jsonfeed.org")
}

pub(super) fn map_local_provider_request_error(error: reqwest::Error) -> DomainError {
    let message = error.to_string();
    if message.contains(PRIVATE_URL_VALIDATION_MESSAGE) {
        return DomainError::Validation(PRIVATE_URL_VALIDATION_MESSAGE.to_string());
    }
    if message.contains(UNSUPPORTED_URL_VALIDATION_MESSAGE) {
        return DomainError::Validation(UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string());
    }
    if message.contains(CREDENTIAL_URL_VALIDATION_MESSAGE) {
        return DomainError::Validation(CREDENTIAL_URL_VALIDATION_MESSAGE.to_string());
    }
    http_defaults::map_provider_request_error(error)
}
