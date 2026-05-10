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
        .no_proxy()
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
}

#[cfg(test)]
mod tests {
    use super::http_client_builder;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    static PROXY_ENV_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
        std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

    #[tokio::test]
    async fn provider_http_client_ignores_proxy_environment_variables() {
        let _guard = PROXY_ENV_LOCK
            .lock()
            .expect("proxy env lock should not be poisoned");
        let previous_http_proxy = std::env::var("HTTP_PROXY").ok();
        let previous_https_proxy = std::env::var("HTTPS_PROXY").ok();
        let previous_all_proxy = std::env::var("ALL_PROXY").ok();
        let previous_no_proxy = std::env::var("NO_PROXY").ok();
        std::env::set_var("HTTP_PROXY", "http://127.0.0.1:9");
        std::env::set_var("HTTPS_PROXY", "http://127.0.0.1:9");
        std::env::set_var("ALL_PROXY", "http://127.0.0.1:9");
        std::env::remove_var("NO_PROXY");

        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("client should connect directly");
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            stream
                .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
                .expect("test server should write response");
        });

        let response = http_client_builder()
            .build()
            .expect("provider client should build")
            .get(format!("http://{address}/probe"))
            .send()
            .await
            .expect("provider client should bypass proxy env at HTTP boundary");

        assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        server.join().expect("test server should finish");

        restore_env_var("HTTP_PROXY", previous_http_proxy);
        restore_env_var("HTTPS_PROXY", previous_https_proxy);
        restore_env_var("ALL_PROXY", previous_all_proxy);
        restore_env_var("NO_PROXY", previous_no_proxy);
    }

    fn restore_env_var(key: &str, value: Option<String>) {
        match value {
            Some(value) => std::env::set_var(key, value),
            None => std::env::remove_var(key),
        }
    }
}
