use std::net::IpAddr;

use crate::domain::error::{DomainError, DomainResult};

pub const PRIVATE_URL_VALIDATION_MESSAGE: &str =
    "Requests to private/loopback addresses are not allowed";
pub const CREDENTIAL_URL_VALIDATION_MESSAGE: &str =
    "URLs with embedded credentials are not allowed";
pub const UNSUPPORTED_URL_VALIDATION_MESSAGE: &str = "Only http:// and https:// URLs are supported";
pub const MISSING_HOST_URL_VALIDATION_MESSAGE: &str = "URLs must include a host";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HostPolicy {
    /// The user explicitly opens or sends the URL.
    UserNavigation,
    /// The app contacts or discloses the URL without a click.
    AutomaticRequest,
}

/// Validates a URL the app contacts or discloses on its own.
pub fn validate_public_http_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_http_url_for_policy(url, HostPolicy::AutomaticRequest)
}

/// Validates a URL the user explicitly opens or sends to another app.
pub fn validate_user_navigation_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_http_url_for_policy(url, HostPolicy::UserNavigation)
}

fn validate_http_url_for_policy(url: &reqwest::Url, policy: HostPolicy) -> DomainResult<()> {
    validate_http_url_without_credentials(url)?;

    if url
        .host_str()
        .is_some_and(|host| is_blocked_host(host, policy))
    {
        return Err(DomainError::Validation(
            PRIVATE_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }

    Ok(())
}

pub fn validate_http_url_without_credentials(url: &reqwest::Url) -> DomainResult<()> {
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(DomainError::Validation(
            UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }

    if has_url_credentials(url) {
        return Err(DomainError::Validation(
            CREDENTIAL_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }

    Ok(())
}

/// Validates a server URL explicitly selected by the user.
///
/// Private and local-network hosts are intentionally allowed here because a
/// self-hosted FreshRSS server is a supported user-selected endpoint. Callers
/// that process untrusted or content-derived URLs must use
/// [`validate_public_http_url`] instead.
pub fn validate_user_provided_server_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_http_url_without_credentials(url)?;
    if url.host_str().is_none() {
        return Err(DomainError::Validation(
            MISSING_HOST_URL_VALIDATION_MESSAGE.to_string(),
        ));
    }
    Ok(())
}

pub fn has_url_credentials(url: &reqwest::Url) -> bool {
    !url.username().is_empty() || url.password().is_some()
}

pub fn is_private_host(host: &str) -> bool {
    is_blocked_host(host, HostPolicy::AutomaticRequest)
}

pub fn is_private_ip(ip: IpAddr) -> bool {
    is_blocked_ip(ip, HostPolicy::AutomaticRequest)
}

pub fn is_blocked_host(host: &str, policy: HostPolicy) -> bool {
    let host_lower = host.to_lowercase();
    let host_without_trailing_dot = host_lower.trim_end_matches('.');

    let ip_str = host_without_trailing_dot
        .trim_start_matches('[')
        .trim_end_matches(']');
    let ip_str = ip_str.split_once('%').map_or(ip_str, |(addr, _zone)| addr);
    if let Ok(ip) = ip_str.parse::<IpAddr>() {
        return is_blocked_ip(ip, policy);
    }

    if host_without_trailing_dot == "localhost" || host_without_trailing_dot.ends_with(".localhost")
    {
        return true;
    }

    policy == HostPolicy::AutomaticRequest
        && (host_without_trailing_dot.ends_with(".local")
            || !host_without_trailing_dot.contains('.'))
}

pub fn is_blocked_ip(ip: IpAddr, policy: HostPolicy) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_unspecified()
                || v4.is_link_local()
                || v4.octets()[0] == 0
                || (policy == HostPolicy::AutomaticRequest && is_shared_address_space(v4))
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_blocked_ip(IpAddr::V4(v4), policy);
            }

            v6.is_loopback()
                || v6.is_unspecified()
                || (v6.segments()[0] & 0xfe00) == 0xfc00
                || (v6.segments()[0] & 0xffc0) == 0xfe80
        }
    }
}

fn is_shared_address_space(v4: std::net::Ipv4Addr) -> bool {
    let [first, second, ..] = v4.octets();
    first == 100 && (second & 0xc0) == 0x40
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_host_policy_covers_idna_ipv6_zone_and_trailing_dot() {
        for raw_url in [
            "http://LOCALHOST/feed.xml",
            "http://localhost./feed.xml",
            "http://[::1]/feed.xml",
            "http://[::ffff:7f00:1]/feed.xml",
            "http://0.0.0.0/feed.xml",
            "http://169.254.1.1/feed.xml",
            "http://nas.local/feed.xml",
            "http://freshrss/feed.xml",
        ] {
            let url = reqwest::Url::parse(raw_url).unwrap();
            assert!(matches!(
                validate_public_http_url(&url),
                Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }

        for raw_url in [
            "https://例え.テスト/feed.xml",
            "https://xn--r8jz45g.xn--zckzah/feed.xml",
            "https://example.com./feed.xml",
        ] {
            let url = reqwest::Url::parse(raw_url).unwrap();
            assert!(validate_public_http_url(&url).is_ok(), "{raw_url}");
        }

        assert!(is_private_host("fe80::1%en0"));
        assert!(is_private_host("[fe80::1%en0]"));
        assert!(is_private_host("LOCALHOST."));
        assert!(is_private_host("NAS.LOCAL."));
        assert!(is_private_host("freshrss"));
        assert!(!is_private_host("xn--r8jz45g.xn--zckzah"));
    }

    #[test]
    fn user_provided_server_url_policy_allows_explicit_private_endpoints() {
        for raw_url in [
            "http://localhost:8080/feed.xml",
            "http://127.0.0.1/feed.xml",
            "https://nas.local/feed.xml",
            "https://freshrss:8080/feed.xml",
            "https://[fd00::1]/feed.xml",
        ] {
            let url = reqwest::Url::parse(raw_url).unwrap();
            assert!(validate_user_provided_server_url(&url).is_ok(), "{raw_url}");
        }
    }

    #[test]
    fn persistence_url_policy_rejects_userinfo_credentials() {
        for raw_url in [
            "https://alice@example.com/feed.xml",
            "https://alice:secret@example.com/feed.xml",
        ] {
            let url = reqwest::Url::parse(raw_url).unwrap();
            assert!(matches!(
                validate_http_url_without_credentials(&url),
                Err(DomainError::Validation(message)) if message == CREDENTIAL_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[derive(serde::Deserialize)]
    struct PolicyCases {
        cases: Vec<PolicyCase>,
    }

    #[derive(serde::Deserialize)]
    struct PolicyCase {
        url: String,
        #[serde(rename = "userNavigation")]
        user_navigation: Verdict,
        #[serde(rename = "automaticRequest")]
        automatic_request: Verdict,
    }

    #[derive(serde::Deserialize, Debug, PartialEq, Eq)]
    #[serde(rename_all = "lowercase")]
    enum Verdict {
        Allow,
        Reject,
    }

    #[test]
    fn host_privacy_policy_matches_shared_fixture() {
        let fixture: PolicyCases = serde_json::from_str(include_str!(
            "../../../tests/fixtures/host-privacy/policy-cases.json"
        ))
        .expect("host privacy fixture should parse");
        assert!(!fixture.cases.is_empty());

        let verdict = |result: DomainResult<()>| {
            if result.is_ok() {
                Verdict::Allow
            } else {
                Verdict::Reject
            }
        };
        let mut failures = Vec::new();
        for case in &fixture.cases {
            let url = reqwest::Url::parse(&case.url)
                .unwrap_or_else(|error| panic!("fixture URL {} should parse: {error}", case.url));
            let user = verdict(validate_user_navigation_url(&url));
            let automatic = verdict(validate_public_http_url(&url));
            if user != case.user_navigation {
                failures.push(format!(
                    "{} userNavigation: expected {:?}, got {user:?}",
                    case.url, case.user_navigation
                ));
            }
            if automatic != case.automatic_request {
                failures.push(format!(
                    "{} automaticRequest: expected {:?}, got {automatic:?}",
                    case.url, case.automatic_request
                ));
            }
        }
        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }

    #[test]
    fn user_provided_server_url_policy_allows_shared_address_space() {
        let url = reqwest::Url::parse("http://100.64.0.1:8080/api/greader.php").unwrap();
        assert!(validate_user_provided_server_url(&url).is_ok());
    }
}
