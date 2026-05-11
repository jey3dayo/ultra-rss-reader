use std::time::Duration;

use crate::domain::error::{DomainError, DomainResult};
use reqwest::header::{HeaderMap, HeaderValue, CACHE_CONTROL, PRAGMA};

pub const PROVIDER_HTTP_TIMEOUT: Duration = Duration::from_secs(15);
pub const PROVIDER_USER_AGENT: &str = "UltraRSSReader/0.1";
pub const PROVIDER_RESPONSE_BODY_CAP_BYTES: u64 = 5 * 1024 * 1024;
pub const DISCOVERY_RESPONSE_BODY_CAP_BYTES: u64 = 2 * 1024 * 1024;
pub const PROVIDER_CACHE_CONTROL: &str = "no-store";
pub const PROVIDER_PRAGMA: &str = "no-cache";

pub fn http_client_builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
        .timeout(PROVIDER_HTTP_TIMEOUT)
        .user_agent(PROVIDER_USER_AGENT)
        .default_headers(provider_no_store_headers())
        .no_proxy()
}

fn provider_no_store_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        CACHE_CONTROL,
        HeaderValue::from_static(PROVIDER_CACHE_CONTROL),
    );
    headers.insert(PRAGMA, HeaderValue::from_static(PROVIDER_PRAGMA));
    headers
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
    use super::{
        http_client_builder, PROVIDER_CACHE_CONTROL, PROVIDER_PRAGMA, PROVIDER_USER_AGENT,
    };
    use reqwest::header::{CACHE_CONTROL, PRAGMA, REFERER, USER_AGENT};
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

    #[tokio::test]
    async fn provider_http_client_sends_no_store_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("client should connect");
            let mut request = [0_u8; 2048];
            let bytes_read = stream.read(&mut request).unwrap_or(0);
            let request = String::from_utf8_lossy(&request[..bytes_read]);
            assert!(request.contains("cache-control: no-store"));
            assert!(request.contains("pragma: no-cache"));
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
            .expect("provider client should send no-store headers");

        assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        server.join().expect("test server should finish");
    }

    #[tokio::test]
    async fn provider_http_client_fixes_privacy_preserving_metadata_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("client should connect");
            let mut request = [0_u8; 2048];
            let bytes_read = stream.read(&mut request).unwrap_or(0);
            let request = String::from_utf8_lossy(&request[..bytes_read]);
            let request_lower = request.to_ascii_lowercase();
            assert!(request_lower.contains(&format!(
                "{}: {}",
                USER_AGENT.as_str(),
                PROVIDER_USER_AGENT.to_ascii_lowercase()
            )));
            assert!(request_lower.contains(&format!(
                "{}: {}",
                CACHE_CONTROL.as_str(),
                PROVIDER_CACHE_CONTROL
            )));
            assert!(request_lower.contains(&format!("{}: {}", PRAGMA.as_str(), PROVIDER_PRAGMA)));
            assert!(!request_lower.contains(&format!("{}:", REFERER.as_str())));
            stream
                .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
                .expect("test server should write response");
        });

        let response = http_client_builder()
            .build()
            .expect("provider client should build")
            .get(format!("http://{address}/favicon.ico"))
            .send()
            .await
            .expect("provider metadata client should send fixed privacy headers");

        assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        server.join().expect("test server should finish");
    }

    #[tokio::test]
    async fn provider_http_client_does_not_persist_response_cookies() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server should expose local address");
        let server = std::thread::spawn(move || {
            let (mut first_stream, _) = listener.accept().expect("first request should connect");
            let mut first_request = [0_u8; 2048];
            let _ = first_stream.read(&mut first_request);
            first_stream
                .write_all(
                    b"HTTP/1.1 204 No Content\r\nSet-Cookie: provider_session=secret; Path=/\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
                )
                .expect("test server should write first response");

            let (mut second_stream, _) = listener.accept().expect("second request should connect");
            let mut second_request = [0_u8; 2048];
            let bytes_read = second_stream.read(&mut second_request).unwrap_or(0);
            let request = String::from_utf8_lossy(&second_request[..bytes_read]);
            assert!(!request.to_ascii_lowercase().contains("cookie:"));
            assert!(!request.contains("provider_session=secret"));
            second_stream
                .write_all(
                    b"HTTP/1.1 204 No Content\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
                )
                .expect("test server should write second response");
        });

        let client = http_client_builder()
            .build()
            .expect("provider client should build");
        for path in ["first", "second"] {
            let response = client
                .get(format!("http://{address}/{path}"))
                .send()
                .await
                .expect("provider client should not require cookie storage");
            assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
        }
        server.join().expect("test server should finish");
    }

    fn restore_env_var(key: &str, value: Option<String>) {
        match value {
            Some(value) => std::env::set_var(key, value),
            None => std::env::remove_var(key),
        }
    }
}
