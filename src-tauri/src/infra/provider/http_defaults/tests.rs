use super::{
    build_http_client, http_client_builder, validate_provider_redirect,
    validate_provider_redirect_attempt, ValidatedPublicDnsResolver,
    DOWNGRADE_REDIRECT_VALIDATION_MESSAGE, PROVIDER_CACHE_CONTROL, PROVIDER_PRAGMA,
    PROVIDER_USER_AGENT,
};
use crate::domain::error::DomainError;
use reqwest::dns::Resolve;
use reqwest::header::{CACHE_CONTROL, PRAGMA, REFERER, USER_AGENT};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener};
use std::str::FromStr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

static PROXY_ENV_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
    std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

#[test]
fn provider_http_client_build_failure_is_returned_as_domain_error() {
    let result = build_http_client(reqwest::Client::builder().user_agent("\n"));

    assert!(matches!(
        result,
        Err(DomainError::Network(message)) if !message.is_empty()
    ));
}

#[tokio::test]
async fn validated_dns_resolver_rejects_private_addresses_before_connecting() {
    let resolver = ValidatedPublicDnsResolver::new(|host| {
        if host == "rebinding.test.invalid" {
            return Ok(vec![SocketAddr::from(([127, 0, 0, 1], 80))]);
        }
        Ok(vec![SocketAddr::from(([93, 184, 216, 34], 0))])
    });
    let name = reqwest::dns::Name::from_str("rebinding.test.invalid")
        .expect("resolver fixture host should parse");

    let error = match resolver.resolve(name).await {
        Ok(_) => panic!("private resolver result must not reach the connector"),
        Err(error) => error,
    };

    assert_eq!(
        error
            .downcast_ref::<DomainError>()
            .expect("resolver should preserve the typed domain error")
            .to_string(),
        "Validation error: Requests to private/loopback addresses are not allowed"
    );
}

#[tokio::test]
async fn validated_dns_resolver_reuses_seeded_result_for_initial_host() {
    let resolver = ValidatedPublicDnsResolver::new(|_| {
        Err(DomainError::Network(
            "unexpected second DNS resolution".to_string(),
        ))
    });
    resolver
        .seed(
            "public.example.test.",
            vec![SocketAddr::from(([93, 184, 216, 34], 8080))],
        )
        .expect("public fixture address should be accepted");
    let name = reqwest::dns::Name::from_str("public.example.test")
        .expect("resolver fixture host should parse");

    let addresses = resolver
        .resolve(name)
        .await
        .expect("seeded address should be reused")
        .collect::<Vec<_>>();

    assert_eq!(addresses, vec![SocketAddr::from(([93, 184, 216, 34], 0))]);
}

#[tokio::test]
async fn validated_dns_resolver_reuses_user_selected_private_initial_host() {
    let resolver = ValidatedPublicDnsResolver::new(|_| {
        Err(DomainError::Network(
            "unexpected second DNS resolution".to_string(),
        ))
    });
    resolver
        .seed_user_selected(
            "nas.local",
            vec![SocketAddr::from(([192, 168, 1, 20], 8080))],
        )
        .expect("explicit private endpoint should be seedable");
    let name =
        reqwest::dns::Name::from_str("nas.local").expect("resolver fixture host should parse");

    let addresses = resolver
        .resolve(name)
        .await
        .expect("seeded private address should be reused")
        .collect::<Vec<_>>();

    assert_eq!(addresses, vec![SocketAddr::from(([192, 168, 1, 20], 0))]);
}

#[tokio::test]
async fn validated_dns_resolver_closes_public_to_private_rebinding_window() {
    let calls = Arc::new(AtomicUsize::new(0));
    let resolver_calls = Arc::clone(&calls);
    let resolver = ValidatedPublicDnsResolver::new(move |_| {
        if resolver_calls.fetch_add(1, Ordering::SeqCst) == 0 {
            return Ok(vec![SocketAddr::from(([93, 184, 216, 34], 0))]);
        }
        Ok(vec![SocketAddr::from(([127, 0, 0, 1], 0))])
    });

    let first_name = reqwest::dns::Name::from_str("rebind.example.test")
        .expect("resolver fixture host should parse");
    let first_addresses = resolver
        .resolve(first_name)
        .await
        .expect("the first public DNS result should be accepted")
        .collect::<Vec<_>>();
    let second_name = reqwest::dns::Name::from_str("rebind.example.test")
        .expect("resolver fixture host should parse");
    let second_addresses = resolver
        .resolve(second_name)
        .await
        .expect("the cached result should be used for the connection")
        .collect::<Vec<_>>();

    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(first_addresses, second_addresses);
    assert!(second_addresses
        .iter()
        .all(|address| !crate::domain::url_policy::is_private_ip(address.ip())));
}

#[test]
fn shared_redirect_validation_rejects_https_to_http_downgrade() {
    let previous =
        [reqwest::Url::parse("https://example.com/feed.xml").expect("fixture URL should parse")];
    let next =
        reqwest::Url::parse("http://example.com/feed.xml").expect("fixture URL should parse");

    let result = validate_provider_redirect(&previous, &next, |_| Ok(()));

    assert!(matches!(
        result,
        Err(DomainError::Validation(message))
            if message == DOWNGRADE_REDIRECT_VALIDATION_MESSAGE
    ));
}

#[test]
fn shared_redirect_policy_rejects_the_sixth_redirect_hop() {
    let previous = vec![
        reqwest::Url::parse("https://example.com/feed.xml")
            .expect("fixture URL should parse");
        6
    ];
    let next =
        reqwest::Url::parse("https://example.com/feed.xml").expect("fixture URL should parse");

    let result = validate_provider_redirect_attempt(&previous, &next, false, |_| Ok(()));

    assert!(matches!(
        result,
        Err(DomainError::Network(message)) if message == "too many redirects"
    ));
}

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
            .write_all(b"HTTP/1.1 204 No Content\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
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
