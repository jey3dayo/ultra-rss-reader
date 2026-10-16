use crate::infra::keyring_store::cloudflare_access::{https_origin, CloudflareAccess};
use reqwest::header::HeaderValue;
use serde::de::DeserializeOwned;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{FeedIdentifier, Mutation, ProviderKind};
use crate::domain::url_policy::{is_private_host, validate_user_provided_server_url};
use crate::infra::feed_discovery::{
    resolve_user_server_public_addrs, validate_discovery_url, validated_public_dns_resolver,
};

use super::super::http_defaults::{self, http_client_builder};
use super::super::traits::{Credentials as ProviderCredentials, FeedProvider};
use super::stream_types::QuickAddResponse;
use super::{urlencoded, GReaderProvider, LABEL_PREFIX, STATE_READ, STATE_STARRED};

mod api_calls;
mod responses;

#[derive(Clone, Copy)]
enum SafeGReaderEndpoint {
    ClientLogin,
    TagList,
    SubscriptionList,
    SubscriptionQuickadd,
    SubscriptionEdit,
    StreamContents,
    StreamItemsIds,
    EditTag,
    UnreadCount,
    ApiOther,
}

impl SafeGReaderEndpoint {
    fn from_path(path: &str) -> Self {
        if path.ends_with("/accounts/ClientLogin") {
            Self::ClientLogin
        } else if path.ends_with("/reader/api/0/tag/list") {
            Self::TagList
        } else if path.ends_with("/reader/api/0/subscription/list") {
            Self::SubscriptionList
        } else if path.ends_with("/reader/api/0/subscription/quickadd") {
            Self::SubscriptionQuickadd
        } else if path.ends_with("/reader/api/0/subscription/edit") {
            Self::SubscriptionEdit
        } else if path.contains("/reader/api/0/stream/contents/") {
            Self::StreamContents
        } else if path.ends_with("/reader/api/0/stream/items/ids") {
            Self::StreamItemsIds
        } else if path.ends_with("/reader/api/0/edit-tag") {
            Self::EditTag
        } else if path.ends_with("/reader/api/0/unread-count") {
            Self::UnreadCount
        } else {
            Self::ApiOther
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::ClientLogin => "client-login",
            Self::TagList => "tag-list",
            Self::SubscriptionList => "subscription-list",
            Self::SubscriptionQuickadd => "subscription-quickadd",
            Self::SubscriptionEdit => "subscription-edit",
            Self::StreamContents => "stream-contents",
            Self::StreamItemsIds => "stream-items-ids",
            Self::EditTag => "edit-tag",
            Self::UnreadCount => "unread-count",
            Self::ApiOther => "api-other",
        }
    }
}

#[derive(Clone, Copy)]
pub(super) enum SafeGReaderFailureReason {
    HttpAuth,
    HtmlContentType,
    HtmlBody,
    InvalidMutationShape,
    BodyCap,
}

impl SafeGReaderFailureReason {
    fn as_str(self) -> &'static str {
        match self {
            Self::HttpAuth => "http-auth",
            Self::HtmlContentType => "html-content-type",
            Self::HtmlBody => "html-body",
            Self::InvalidMutationShape => "invalid-mutation-shape",
            Self::BodyCap => "body-cap",
        }
    }
}

#[derive(Clone, Copy)]
struct SafeGReaderFailureContext {
    endpoint: SafeGReaderEndpoint,
    status: u16,
}

impl SafeGReaderFailureContext {
    fn from_response(response: &reqwest::Response) -> Self {
        Self::from_path_and_status(response.url().path(), response.status().as_u16())
    }

    fn from_path_and_status(path: &str, status: u16) -> Self {
        Self {
            endpoint: SafeGReaderEndpoint::from_path(path),
            status,
        }
    }

    fn format(self, reason: SafeGReaderFailureReason) -> String {
        format!(
            "endpoint={} status={} reason={}",
            self.endpoint.as_str(),
            self.status,
            reason.as_str()
        )
    }
}

#[cfg(test)]
pub(super) fn safe_greader_failure_diagnostic(
    path: &str,
    status: u16,
    reason: SafeGReaderFailureReason,
) -> String {
    SafeGReaderFailureContext::from_path_and_status(path, status).format(reason)
}

fn log_greader_api_failure(context: SafeGReaderFailureContext, reason: SafeGReaderFailureReason) {
    log::warn!("{}", context.format(reason));
}

fn has_html_content_type(response: &reqwest::Response) -> bool {
    response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            let content_type = value.split(';').next().unwrap_or_default().trim();
            content_type.eq_ignore_ascii_case("text/html")
                || content_type.eq_ignore_ascii_case("application/xhtml+xml")
        })
}

fn has_item_ids_response_shape(body: &[u8]) -> bool {
    let Ok(serde_json::Value::Object(root)) = serde_json::from_slice(body) else {
        return false;
    };
    root.get("itemRefs")
        .is_some_and(serde_json::Value::is_array)
        && root
            .keys()
            .all(|key| matches!(key.as_str(), "itemRefs" | "continuation"))
}

fn html_mime_mutation_success(path: &str, text: &str) -> bool {
    let quickadd = path.ends_with("/reader/api/0/subscription/quickadd");
    if text.trim() == "OK" {
        return quickadd
            || path.ends_with("/reader/api/0/edit-tag")
            || path.ends_with("/reader/api/0/subscription/edit");
    }
    if !quickadd {
        return false;
    }
    let Ok(serde_json::Value::Object(root)) = serde_json::from_str(text) else {
        return false;
    };
    if root.contains_key("error") || root.contains_key("errors") {
        return false;
    }
    let Ok(response) = serde_json::from_value::<QuickAddResponse>(serde_json::Value::Object(root))
    else {
        return false;
    };
    response.stream_id.is_some_and(|id| {
        id.strip_prefix("feed/")
            .is_some_and(|suffix| !suffix.trim().is_empty())
    })
}

pub(super) fn freshrss_api_base(server_url: &str) -> String {
    let normalized_url = match reqwest::Url::parse(server_url.trim()) {
        Ok(mut url) if url.scheme() == "http" || url.scheme() == "https" => {
            let _ = url.set_username("");
            let _ = url.set_password(None);
            url.to_string()
        }
        _ => server_url.trim().to_string(),
    };
    let base = normalized_url.trim_end_matches('/');
    if base.ends_with("/api/greader.php") {
        base.to_string()
    } else {
        format!("{base}/api/greader.php")
    }
}

pub(super) fn greader_json_body_too_large_error() -> DomainError {
    DomainError::Network(format!(
        "GReader JSON response body exceeds {} bytes",
        http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
    ))
}

pub(super) fn resolve_greader_base_addrs(url: &reqwest::Url) -> DomainResult<Vec<SocketAddr>> {
    validate_user_provided_server_url(url)?;

    if let Some(address) = explicit_greader_base_addr(url) {
        // A literal/private FreshRSS base is an explicit user-selected endpoint:
        // it cannot be DNS-rebound, so account URL verification (url_policy / #65)
        // owns the UX decision about whether private servers are acceptable.
        return Ok(vec![address]);
    }

    if url.host_str().is_some_and(is_private_host) {
        // Private hostnames are explicitly user-selected endpoints. Defer
        // their OS DNS lookup to the custom async resolver so constructing a
        // provider never blocks the Tokio executor on local-name resolution.
        return Ok(Vec::new());
    }

    resolve_user_server_public_addrs(url)
}

pub(super) fn explicit_greader_base_addr(url: &reqwest::Url) -> Option<SocketAddr> {
    let host = url.host_str()?;
    let port = url.port_or_known_default().unwrap_or(80);

    let ip_host = host.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = ip_host.parse::<IpAddr>() {
        return Some(SocketAddr::new(ip, port));
    }

    if host.trim_end_matches('.').eq_ignore_ascii_case("localhost") {
        return Some(SocketAddr::new(Ipv4Addr::LOCALHOST.into(), port));
    }

    None
}

impl GReaderProvider {
    /// Create a provider configured for FreshRSS.
    pub fn for_freshrss(server_url: &str) -> Self {
        let base = freshrss_api_base(server_url);
        let http_client = Self::build_http_client(&base);
        Self {
            kind: ProviderKind::FreshRss,
            api_base: base.clone(),
            auth_base: base,
            http_client,
            auth_token: None,
            #[cfg(test)]
            mock_http_transport: false,
            cloudflare_access: None,
        }
    }

    pub fn try_for_freshrss(server_url: &str) -> DomainResult<Self> {
        let base = freshrss_api_base(server_url);
        Ok(Self {
            kind: ProviderKind::FreshRss,
            api_base: base.clone(),
            auth_base: base.clone(),
            http_client: Ok(Self::build_http_client(&base)?),
            auth_token: None,
            #[cfg(test)]
            mock_http_transport: false,
            cloudflare_access: None,
        })
    }

    pub(crate) fn try_for_freshrss_with_access(
        server_url: &str,
        access: Option<CloudflareAccess>,
    ) -> DomainResult<Self> {
        if let Some(access) = &access {
            access.ensure_origin(server_url)?;
        }
        let base = freshrss_api_base(server_url);
        let client = Self::build_http_client_with_access(&base, access.as_ref())?;
        Ok(Self {
            kind: ProviderKind::FreshRss,
            api_base: base.clone(),
            auth_base: base,
            http_client: Ok(client),
            auth_token: None,
            #[cfg(test)]
            mock_http_transport: false,
            cloudflare_access: access,
        })
    }

    pub(super) fn build_http_client(base: &str) -> DomainResult<reqwest::Client> {
        Self::build_http_client_with_access(base, None)
    }

    fn build_http_client_with_access(
        base: &str,
        access: Option<&CloudflareAccess>,
    ) -> DomainResult<reqwest::Client> {
        let base_url = reqwest::Url::parse(base).map_err(|_| {
            DomainError::Validation(
                crate::domain::url_policy::UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
            )
        })?;
        let explicit_base_addr = explicit_greader_base_addr(&base_url);
        let resolved_addresses = resolve_greader_base_addrs(&base_url)?;
        let base_host = base_url.host_str();
        let base_host_is_private = base_host.is_some_and(is_private_host);
        let initial_private_host = base_host
            .filter(|_| base_host_is_private)
            .map(ToOwned::to_owned);
        let resolver = validated_public_dns_resolver();
        if let Some(host) = base_host.filter(|_| explicit_base_addr.is_none()) {
            if base_host_is_private {
                if resolved_addresses.is_empty() {
                    resolver.seed_user_selected_host(host)?;
                } else {
                    resolver.seed_user_selected(host, resolved_addresses.clone())?;
                }
            } else {
                resolver.seed_user_server(host, resolved_addresses.clone())?;
            }
        }

        let access_origin = access.map(|access| access.origin().to_string());
        let redirect_policy = if access_origin.is_none() {
            http_defaults::provider_redirect_policy_for_initial_private_host(
                initial_private_host,
                validate_discovery_url,
            )
        } else {
            reqwest::redirect::Policy::custom(move |attempt| {
                let validation = validate_access_redirect(access_origin.as_deref(), attempt.url())
                    .and_then(|()| {
                        http_defaults::validate_provider_redirect_attempt_for_initial_private_host(
                            attempt.previous(),
                            attempt.url(),
                            initial_private_host.as_deref(),
                            validate_discovery_url,
                        )
                    });
                match validation {
                    Ok(()) => attempt.follow(),
                    Err(error) => attempt.error(http_defaults::ProviderRedirectError::new(error)),
                }
            })
        };
        let mut builder = http_client_builder()
            .dns_resolver(Arc::new(resolver))
            .redirect(redirect_policy);
        if let Some(host) = base_host {
            if !resolved_addresses.is_empty() {
                builder = builder.resolve_to_addrs(host, &resolved_addresses);
            }
        }

        http_defaults::build_http_client(builder)
    }

    #[cfg(test)]
    pub(super) fn build_test_http_client_allowing_private_urls() -> DomainResult<reqwest::Client> {
        http_defaults::build_http_client(http_client_builder().redirect(
            http_defaults::provider_redirect_policy(true, validate_discovery_url),
        ))
    }

    #[cfg(test)]
    pub(super) fn validate_redirect(
        previous_urls: &[reqwest::Url],
        next_url: &reqwest::Url,
    ) -> DomainResult<()> {
        http_defaults::validate_provider_redirect(previous_urls, next_url, validate_discovery_url)
    }

    #[cfg(test)]
    pub(super) fn validate_redirect_for_initial_private_host(
        previous_urls: &[reqwest::Url],
        next_url: &reqwest::Url,
        initial_private_host: &str,
    ) -> DomainResult<()> {
        http_defaults::validate_provider_redirect_attempt_for_initial_private_host(
            previous_urls,
            next_url,
            Some(initial_private_host),
            validate_discovery_url,
        )
    }

    pub(super) fn http_client(&self) -> DomainResult<&reqwest::Client> {
        self.http_client.as_ref().map_err(|error| error.clone())
    }

    pub(super) fn request(
        &self,
        method: reqwest::Method,
        url: &str,
    ) -> DomainResult<reqwest::RequestBuilder> {
        if let Some(access) = &self.cloudflare_access {
            access.ensure_origin(url)?;
        }
        #[cfg(test)]
        let mock_url = if self.mock_http_transport {
            // Mockito has no TLS listener. Validate the original HTTPS request
            // above, then route only test traffic to its local HTTP listener.
            let mut mock_url = reqwest::Url::parse(url)
                .map_err(|_| DomainError::Validation("Invalid test URL".into()))?;
            mock_url
                .set_scheme("http")
                .map_err(|_| DomainError::Validation("Invalid test scheme".into()))?;
            Some(mock_url)
        } else {
            None
        };
        #[cfg(test)]
        let url = mock_url.as_ref().map(reqwest::Url::as_str).unwrap_or(url);
        let mut request = self.http_client()?.request(method, url);
        if let Some(access) = &self.cloudflare_access {
            request = request.headers(access.headers()?);
        }
        Ok(request)
    }

    pub(super) fn map_request_error(&self, error: reqwest::Error) -> DomainError {
        let error = if self.cloudflare_access.is_some() {
            error.without_url()
        } else {
            error
        };
        http_defaults::map_provider_request_error(error)
    }

    pub(super) fn api_url(&self, path: &str) -> String {
        format!("{}{}", self.api_base, path)
    }

    pub(super) fn auth_url(&self, path: &str) -> String {
        format!("{}{}", self.auth_base, path)
    }

    pub(super) fn auth_header(&self) -> DomainResult<HeaderValue> {
        let token = self
            .auth_token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Not authenticated".into()))?;
        let mut header = HeaderValue::from_str(&format!("GoogleLogin auth={token}"))
            .map_err(|_| DomainError::Auth("Invalid FreshRSS authorization response".into()))?;
        header.set_sensitive(true);
        Ok(header)
    }
}

fn access_html_error() -> DomainError {
    DomainError::Auth(
        "The API returned an HTML page. Check the server URL and any access gateway settings."
            .into(),
    )
}

pub(super) fn validate_access_redirect(
    origin: Option<&str>,
    next_url: &reqwest::Url,
) -> DomainResult<()> {
    if let Some(origin) = origin {
        if https_origin(next_url.as_str()).ok().as_deref() != Some(origin) {
            return Err(DomainError::Validation(
                "Cloudflare Access blocked a redirect outside the registered HTTPS origin. Check the server URL and access gateway settings.".into(),
            ));
        }
    }
    Ok(())
}
