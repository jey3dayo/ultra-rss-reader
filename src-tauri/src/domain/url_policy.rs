use std::net::IpAddr;

use crate::domain::error::{DomainError, DomainResult};

pub const PRIVATE_URL_VALIDATION_MESSAGE: &str =
    "Requests to private/loopback addresses are not allowed";
pub const CREDENTIAL_URL_VALIDATION_MESSAGE: &str =
    "URLs with embedded credentials are not allowed";
pub const UNSUPPORTED_URL_VALIDATION_MESSAGE: &str = "Only http:// and https:// URLs are supported";

pub fn validate_public_http_url(url: &reqwest::Url) -> DomainResult<()> {
    validate_http_url_without_credentials(url)?;

    if url.host_str().is_some_and(is_private_host) {
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

pub fn has_url_credentials(url: &reqwest::Url) -> bool {
    !url.username().is_empty() || url.password().is_some()
}

pub fn is_private_host(host: &str) -> bool {
    let host_lower = host.to_lowercase();
    let host_without_trailing_dot = host_lower.trim_end_matches('.');

    if host_without_trailing_dot == "localhost" {
        return true;
    }

    let ip_str = host_without_trailing_dot
        .trim_start_matches('[')
        .trim_end_matches(']');
    let ip_str = ip_str.split_once('%').map_or(ip_str, |(addr, _zone)| addr);
    ip_str.parse::<IpAddr>().is_ok_and(is_private_ip)
}

pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback() || v4.is_private() || v4.is_unspecified() || v4.is_link_local()
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_private_ip(IpAddr::V4(v4));
            }

            v6.is_loopback()
                || v6.is_unspecified()
                || (v6.segments()[0] & 0xfe00) == 0xfc00
                || (v6.segments()[0] & 0xffc0) == 0xfe80
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_host_policy_covers_idna_ipv6_zone_and_trailing_dot() {
        for raw_url in [
            "http://localhost./feed.xml",
            "http://[::1]/feed.xml",
            "http://[::ffff:7f00:1]/feed.xml",
            "http://0.0.0.0/feed.xml",
            "http://169.254.1.1/feed.xml",
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
}
