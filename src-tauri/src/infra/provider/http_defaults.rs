use std::time::Duration;

use crate::domain::error::{DomainError, DomainResult};

pub const PROVIDER_HTTP_TIMEOUT: Duration = Duration::from_secs(15);
pub const PROVIDER_USER_AGENT: &str = "UltraRSSReader/0.1";
pub const PROVIDER_RESPONSE_BODY_CAP_BYTES: u64 = 5 * 1024 * 1024;
pub const DISCOVERY_RESPONSE_BODY_CAP_BYTES: u64 = 2 * 1024 * 1024;

pub fn http_client_builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
        .timeout(PROVIDER_HTTP_TIMEOUT)
        .user_agent(PROVIDER_USER_AGENT)
}

pub async fn response_bytes_with_decoded_cap(
    mut response: reqwest::Response,
    cap_bytes: u64,
    too_large_error: impl Fn() -> DomainError,
    read_error: impl Fn(reqwest::Error) -> DomainError,
) -> DomainResult<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|length| length > cap_bytes)
    {
        return Err(too_large_error());
    }

    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(&read_error)? {
        body.extend_from_slice(&chunk);
        if body.len() as u64 > cap_bytes {
            return Err(too_large_error());
        }
    }

    Ok(body)
