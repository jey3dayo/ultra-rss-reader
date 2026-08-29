use super::*;
use crate::commands::dto::AppError;
use crate::domain::url_policy::PRIVATE_URL_VALIDATION_MESSAGE;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::borrow::Cow;
use std::io::Write;

struct ProviderHttpResponseFixture<'a> {
    status: usize,
    headers: &'a [(&'a str, &'a str)],
    body: Cow<'a, str>,
}

impl<'a> ProviderHttpResponseFixture<'a> {
    fn ok(body: &'static str) -> ProviderHttpResponseFixture<'static> {
        ProviderHttpResponseFixture {
            status: 200,
            headers: &[],
            body: Cow::Borrowed(body),
        }
    }

    fn json(body: &'static str) -> ProviderHttpResponseFixture<'static> {
        Self::ok(body).with_headers(&[("content-type", "application/json")])
    }

    fn malformed_json() -> ProviderHttpResponseFixture<'static> {
        Self::json(r#"{ "items": ["#)
    }

    fn item_refs_page(
        item_ids: &[&str],
        continuation: Option<&str>,
    ) -> ProviderHttpResponseFixture<'static> {
        let item_refs = item_ids
            .iter()
            .map(|id| format!(r#"{{ "id": "{id}" }}"#))
            .collect::<Vec<_>>()
            .join(", ");
        let continuation = continuation
            .map(|value| format!(r#", "continuation": "{value}""#))
            .unwrap_or_default();
        ProviderHttpResponseFixture {
            status: 200,
            headers: &[("content-type", "application/json")],
            body: Cow::Owned(format!(r#"{{ "itemRefs": [{item_refs}]{continuation} }}"#)),
        }
    }

    fn status(status: usize) -> ProviderHttpResponseFixture<'static> {
        ProviderHttpResponseFixture {
            status,
            headers: &[],
            body: Cow::Borrowed(""),
        }
    }

    fn with_headers(self, headers: &'a [(&'a str, &'a str)]) -> Self {
        ProviderHttpResponseFixture {
            status: self.status,
            headers,
            body: self.body,
        }
    }
}

trait ProviderMockResponseExt {
    fn with_greader_response(self, response: ProviderHttpResponseFixture<'_>) -> Self;
}

impl ProviderMockResponseExt for mockito::Mock {
    fn with_greader_response(self, response: ProviderHttpResponseFixture<'_>) -> Self {
        apply_provider_response(self, response)
    }
}

#[test]
fn greader_entry_and_item_id_page_caps_are_distinct() {
    assert_eq!(G_READER_MAX_ENTRY_PAGES, 1_000);
    assert_eq!(G_READER_MAX_PAGES, 100);
}

fn apply_provider_response(
    mock: mockito::Mock,
    response: ProviderHttpResponseFixture<'_>,
) -> mockito::Mock {
    response.headers.iter().fold(
        mock.with_status(response.status)
            .with_body(response.body.as_ref()),
        |mock, (name, value)| mock.with_header(*name, value),
    )
}

fn oversized_json_body() -> String {
    format!(
        r#"{{ "padding": "{}" }}"#,
        "x".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize)
    )
}

fn gzip_body(body: &str) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(body.as_bytes())
        .expect("gzip fixture should encode");
    encoder.finish().expect("gzip fixture should finish")
}

fn greader_json_body_limit_error_message() -> String {
    format!(
        "GReader JSON response body exceeds {} bytes",
        http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
    )
}

#[test]
fn for_freshrss_appends_greader_endpoint_to_base_url() {
    let provider = GReaderProvider::for_freshrss("https://freshrss.example.com");

    assert_eq!(
        provider.api_base,
        "https://freshrss.example.com/api/greader.php"
    );
    assert_eq!(
        provider.auth_base,
        "https://freshrss.example.com/api/greader.php"
    );
}

#[test]
fn for_freshrss_normalizes_trailing_slashes_before_appending_greader_endpoint() {
    let provider = GReaderProvider::for_freshrss("https://freshrss.example.com///");

    assert_eq!(
        provider.api_base,
        "https://freshrss.example.com/api/greader.php"
    );
    assert_eq!(
        provider.auth_base,
        "https://freshrss.example.com/api/greader.php"
    );
}

#[test]
fn for_freshrss_accepts_full_greader_endpoint_without_duplication() {
    let provider = GReaderProvider::for_freshrss("https://freshrss.example.com/api/greader.php");

    assert_eq!(
        provider.api_base,
        "https://freshrss.example.com/api/greader.php"
    );
    assert_eq!(
        provider.auth_base,
        "https://freshrss.example.com/api/greader.php"
    );
}

#[test]
fn for_freshrss_normalizes_trailing_slash_after_full_greader_endpoint() {
    let provider = GReaderProvider::for_freshrss("https://freshrss.example.com/api/greader.php/");

    assert_eq!(
        provider.api_base,
        "https://freshrss.example.com/api/greader.php"
    );
    assert_eq!(
        provider.auth_base,
        "https://freshrss.example.com/api/greader.php"
    );
}

#[test]
fn for_freshrss_trims_surrounding_whitespace() {
    let provider =
        GReaderProvider::for_freshrss("  https://freshrss.example.com/api/greader.php  ");

    assert_eq!(
        provider.api_base,
        "https://freshrss.example.com/api/greader.php"
    );
    assert_eq!(
        provider.auth_base,
        "https://freshrss.example.com/api/greader.php"
    );
}

#[test]
fn for_freshrss_preserves_loopback_http_base_url() {
    let provider = GReaderProvider::for_freshrss("http://localhost:8080/");

    assert_eq!(provider.api_base, "http://localhost:8080/api/greader.php");
    assert_eq!(provider.auth_base, "http://localhost:8080/api/greader.php");
}

#[test]
fn try_for_freshrss_accepts_ipv6_literal_endpoints() {
    for server_url in [
        "http://[::1]:8080",
        "http://[::ffff:127.0.0.1]:8080",
        "https://[fd00::1]:8443",
    ] {
        assert!(
            GReaderProvider::try_for_freshrss(server_url).is_ok(),
            "{server_url} should use the explicit endpoint path"
        );
    }
}

#[test]
fn for_freshrss_strips_url_credentials_before_building_auth_base() {
    let provider = GReaderProvider::for_freshrss("https://alice:secret@freshrss.example.com/");

    assert_eq!(
        provider.api_base,
        "https://freshrss.example.com/api/greader.php"
    );
    assert_eq!(
        provider.auth_base,
        "https://freshrss.example.com/api/greader.php"
    );
}

#[tokio::test]
async fn greader_client_build_failure_is_returned_to_provider_operation() {
    let mut provider = GReaderProvider::for_freshrss("https://freshrss.example.com");
    provider.http_client = Err(DomainError::Network(
        "provider client build failed".to_string(),
    ));
    provider.auth_token = Some("token".to_string());

    let error = provider
        .get_folders()
        .await
        .expect_err("client construction failure should reach the provider boundary");

    assert!(matches!(
        error,
        DomainError::Network(message) if message == "provider client build failed"
    ));
}

#[test]
fn greader_redirect_policy_rejects_https_downgrade_and_private_targets() {
    let previous =
        [reqwest::Url::parse("https://example.com/feed.xml").expect("fixture URL should parse")];
    let downgrade =
        reqwest::Url::parse("http://example.com/feed.xml").expect("fixture URL should parse");

    assert!(matches!(
        GReaderProvider::validate_redirect(&previous, &downgrade),
        Err(DomainError::Validation(message))
            if message == http_defaults::DOWNGRADE_REDIRECT_VALIDATION_MESSAGE
    ));
    for private_url in [
        "https://127.0.0.1/feed.xml",
        "https://nas.local/feed.xml",
        "https://freshrss/feed.xml",
    ] {
        let private = reqwest::Url::parse(private_url).expect("fixture URL should parse");
        assert!(matches!(
            GReaderProvider::validate_redirect(&previous, &private),
            Err(DomainError::Validation(message))
                if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }
}

#[test]
fn greader_redirect_policy_allows_same_selected_private_host_only() {
    let previous =
        [reqwest::Url::parse("http://nas.local/feed.xml").expect("fixture URL should parse")];
    let same_host_https =
        reqwest::Url::parse("https://nas.local/feed.xml").expect("fixture URL should parse");
    let different_private_host =
        reqwest::Url::parse("https://other.local/feed.xml").expect("fixture URL should parse");
    let public_to_private =
        [reqwest::Url::parse("https://example.com/feed.xml").expect("fixture URL should parse")];

    assert!(GReaderProvider::validate_redirect_for_initial_private_host(
        &previous,
        &same_host_https,
        "nas.local",
    )
    .is_ok());
    assert!(matches!(
        GReaderProvider::validate_redirect_for_initial_private_host(
            &previous,
            &different_private_host,
            "nas.local",
        ),
        Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
    assert!(matches!(
        GReaderProvider::validate_redirect_for_initial_private_host(
            &public_to_private,
            &same_host_https,
            "nas.local",
        ),
        Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn greader_redirect_policy_rejects_the_sixth_hop() {
    let previous = vec![
        reqwest::Url::parse("https://example.com/feed.xml")
            .expect("fixture URL should parse");
        http_defaults::PROVIDER_MAX_REDIRECT_HOPS + 1
    ];
    let next =
        reqwest::Url::parse("https://example.com/feed.xml").expect("fixture URL should parse");

    let result = http_defaults::validate_provider_redirect_attempt(
        &previous,
        &next,
        false,
        validate_discovery_url,
    );

    assert!(matches!(
        result,
        Err(DomainError::Network(message)) if message == "too many redirects"
    ));
}

#[test]
fn try_for_freshrss_rejects_public_hostname_resolving_to_private_address() {
    let error = GReaderProvider::try_for_freshrss("https://private.test.invalid")
        .expect_err("private DNS result must fail provider construction");

    assert!(matches!(
        error,
        DomainError::Validation(message) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[tokio::test]
async fn legacy_constructor_returns_private_dns_setup_failure_from_authenticate() {
    let mut provider = GReaderProvider::for_freshrss("https://private.test.invalid");
    let error = provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await;
    let error = match error {
        Ok(()) => panic!("private DNS setup failure should reach authenticate"),
        Err(error) => error,
    };

    assert!(matches!(
        error,
        DomainError::Validation(message) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[tokio::test]
async fn literal_private_base_provider_builds_and_sends() {
    let mut server = mockito::Server::new_async().await;
    let auth = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=literal-base-token\n")
        .create_async()
        .await;

    let provider_result = GReaderProvider::try_for_freshrss(&server.url());
    assert!(provider_result.is_ok(), "literal private base should build");
    let mut provider = match provider_result {
        Ok(provider) => provider,
        Err(error) => panic!("literal private base should build: {error}"),
    };

    let authenticate_result = provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await;
    assert!(
        authenticate_result.is_ok(),
        "literal private base should send: {:?}",
        authenticate_result.err()
    );
    assert_eq!(provider.auth_token.as_deref(), Some("literal-base-token"));
    auth.assert_async().await;
}

#[tokio::test]
async fn private_hostname_provider_resolves_initial_host_on_demand() {
    let mut server = mockito::Server::new_async().await;
    let auth = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=private-host-token\n")
        .create_async()
        .await;
    let port = reqwest::Url::parse(&server.url())
        .expect("mock server URL should parse")
        .port()
        .expect("mock server URL should include a port");

    let mut provider = GReaderProvider::try_for_freshrss(&format!("http://nas.local:{port}"))
        .expect("private hostname should not require synchronous DNS at construction");
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .expect("selected private hostname should resolve during the request");

    assert_eq!(provider.auth_token.as_deref(), Some("private-host-token"));
    auth.assert_async().await;
}

#[tokio::test]
async fn authenticate_maps_private_redirect_response_to_validation_error() {
    let mut server = mockito::Server::new_async().await;
    let redirect = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(302)
        .with_header(
            "location",
            "http://127.0.0.2:1/api/greader.php/accounts/ClientLogin",
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    let error = provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .expect_err("private redirect must fail before the redirected request");

    assert!(matches!(
        error,
        DomainError::Validation(message) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
    redirect.assert_async().await;
}

#[tokio::test]
async fn authenticate_rejects_private_dns_redirect_before_outbound_request() {
    let mut server = mockito::Server::new_async().await;
    let redirect = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(302)
        .with_header(
            "location",
            "http://private.test.invalid/api/greader.php/accounts/ClientLogin",
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    let error = provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .expect_err("private DNS redirect must fail before the redirected request");

    assert!(matches!(
        error,
        DomainError::Validation(message) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
    redirect.assert_async().await;
}

#[tokio::test]
async fn authenticate_follows_five_relative_http_redirects() {
    let mut server = mockito::Server::new_async().await;
    let initial = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(307)
        .with_header("location", "/hop/0")
        .create_async()
        .await;
    let mut redirects = Vec::new();
    for hop in 0..4 {
        let path = format!("/hop/{hop}");
        redirects.push(
            server
                .mock("POST", path.as_str())
                .with_status(307)
                .with_header("location", &format!("/hop/{}", hop + 1))
                .create_async()
                .await,
        );
    }
    let final_response = server
        .mock("POST", "/hop/4")
        .with_status(200)
        .with_body("Auth=redirected-token\n")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider.http_client = Ok(
        GReaderProvider::build_test_http_client_allowing_private_urls()
            .expect("test redirect client should build"),
    );
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .expect("five relative HTTP redirects should be accepted");

    assert_eq!(provider.auth_token.as_deref(), Some("redirected-token"));
    initial.assert_async().await;
    for redirect in redirects {
        redirect.assert_async().await;
    }
    final_response.assert_async().await;
}

#[tokio::test]
async fn authenticate_rejects_the_sixth_redirect_with_network_error() {
    let mut server = mockito::Server::new_async().await;
    let initial = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(307)
        .with_header("location", "/hop/0")
        .create_async()
        .await;
    let mut redirects = Vec::new();
    for hop in 0..5 {
        let path = format!("/hop/{hop}");
        redirects.push(
            server
                .mock("POST", path.as_str())
                .with_status(307)
                .with_header("location", &format!("/hop/{}", hop + 1))
                .create_async()
                .await,
        );
    }

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider.http_client = Ok(
        GReaderProvider::build_test_http_client_allowing_private_urls()
            .expect("test redirect client should build"),
    );
    let error = provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .expect_err("the sixth redirect must be rejected");

    assert!(matches!(
        error,
        DomainError::Network(message) if message == "too many redirects"
    ));
    initial.assert_async().await;
    for redirect in redirects {
        redirect.assert_async().await;
    }
}

#[test]
fn normalize_label_remote_id_decodes_missing_label() {
    assert_eq!(
        normalize_label_remote_id("user/-/label/Dev%20News", None),
        Some(("user/-/label/Dev News".to_string(), "Dev News".to_string()))
    );
}

#[test]
fn normalize_label_remote_id_prefers_label_over_encoded_id() {
    assert_eq!(
        normalize_label_remote_id("user/-/label/Encoded%20Id", Some("Display Name")),
        Some((
            "user/-/label/Display Name".to_string(),
            "Display Name".to_string(),
        ))
    );
}

#[test]
fn normalize_label_remote_id_rejects_invalid_or_path_like_labels() {
    assert_eq!(normalize_label_remote_id("user/-/label/Bad%ZZ", None), None);
    assert_eq!(
        normalize_label_remote_id("user/-/label/Bad%2FName", None),
        None
    );
    assert_eq!(
        normalize_label_remote_id("user/-/label/Encoded", Some("Bad/Name")),
        None
    );
    assert_eq!(normalize_label_remote_id("user/-/label/%20%20", None), None);
    assert_eq!(normalize_label_remote_id(STATE_READ, None), None);
}

#[test]
fn normalize_label_remote_id_trims_unicode_label_for_folder_contract() {
    assert_eq!(
        normalize_label_remote_id("user/-/label/%E9%96%8B%E7%99%BA", Some(" 開発 ")),
        Some(("user/-/label/開発".to_string(), "開発".to_string()))
    );
}

#[test]
fn item_cursor_timestamp_policy_ignores_invalid_clock_values() {
    let future_usec = (Utc::now() + chrono::Duration::hours(1)).timestamp_micros();

    assert_eq!(valid_item_cursor_timestamp_usec(-1), None);
    assert_eq!(valid_item_cursor_timestamp_usec(i64::MAX), None);
    assert_eq!(valid_item_cursor_timestamp_usec(future_usec), None);
    assert_eq!(
        valid_item_cursor_timestamp_usec(1_700_000_000_000_000),
        Some(1_700_000_000_000_000)
    );
}

#[tokio::test]
async fn get_unread_count_map_normalizes_counts_and_keeps_last_duplicate_entry() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::ok(
            r#"{
                "unreadcounts": [
                    { "id": "feed/https://example.com/rss", "count": 4 },
                    { "id": "feed/https://example.com/negative", "count": -2 },
                    { "id": "feed/https://example.com/overflow", "count": 2147483648 },
                    { "id": "feed/https://example.com/rss", "count": 7 }
                ]
            }"#,
        ))
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let unread_counts = provider.get_unread_count_map().await.unwrap();

    assert_eq!(unread_counts.get("feed/https://example.com/rss"), Some(&7));
    assert_eq!(
        unread_counts.get("feed/https://example.com/negative"),
        Some(&0)
    );
    assert_eq!(
        unread_counts.get("feed/https://example.com/overflow"),
        Some(&i32::MAX)
    );
}

#[tokio::test]
async fn greader_rate_limit_preserves_retry_after_seconds_as_structured_error() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
        .create_async()
        .await;

    let subscriptions = server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(mockito::Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(
            ProviderHttpResponseFixture::status(429).with_headers(&[("retry-after", "120")]),
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let error = provider
        .get_subscriptions()
        .await
        .expect_err("429 should surface as rate limit");

    assert!(matches!(
        error,
        DomainError::RateLimitWithRetryAfter {
            message,
            retry_after_seconds: 120
        } if message == "HTTP 429 Too Many Requests"
    ));
    subscriptions.assert_async().await;
}

#[tokio::test]
async fn authenticate_successful() {
    let mut server = mockito::Server::new_async().await;
    let mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header("Content-Type", "application/x-www-form-urlencoded")
        .with_status(200)
        .with_body("SID=unused\nLSID=unused\nAuth=test-token-123\n")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    let creds = Credentials {
        password: Some("mypassword".into()),
        token: Some("myuser".into()),
    };

    provider.authenticate(&creds).await.unwrap();
    assert_eq!(provider.auth_token.as_deref(), Some("test-token-123"));
    mock.assert_async().await;
}

#[tokio::test]
async fn authenticate_request_sends_no_store_headers() {
    let mut server = mockito::Server::new_async().await;
    let auth_mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header("Content-Type", "application/x-www-form-urlencoded")
        .match_header("Cache-Control", "no-store")
        .match_header("Pragma", "no-cache")
        .with_status(200)
        .with_body("Auth=test-token-123\n")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("secret-password".into()),
            token: Some("secret-user@example.com".into()),
        })
        .await
        .expect("auth request should include provider no-store headers");

    auth_mock.assert_async().await;
}

#[tokio::test]
async fn authenticate_maps_provider_http_status_categories() {
    let cases = [
        (401, "Auth error: HTTP 401 Unauthorized"),
        (403, "Auth error: HTTP 403 Forbidden"),
        (429, "Rate limit error: HTTP 429 Too Many Requests"),
        (502, "Network error: HTTP 502 Bad Gateway"),
    ];

    for (status, expected_message) in cases {
        let mut server = mockito::Server::new_async().await;
        let auth_mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_header("Content-Type", "application/x-www-form-urlencoded")
            .with_status(status)
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        let error = provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .expect_err("auth status errors should preserve domain failure category");

        assert_eq!(error.to_string(), expected_message);
        auth_mock.assert_async().await;
    }
}

#[tokio::test]
async fn authenticate_preserves_retry_after_seconds_for_rate_limit() {
    let mut server = mockito::Server::new_async().await;
    let auth_mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header("Content-Type", "application/x-www-form-urlencoded")
        .with_status(429)
        .with_header("Retry-After", "180")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    let error = provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .expect_err("rate limit should preserve retry-after seconds");

    assert_eq!(
        error.to_string(),
        "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=180"
    );
    auth_mock.assert_async().await;
}

#[tokio::test]
async fn get_subscriptions_preserves_retry_after_seconds_for_rate_limit() {
    let mut server = mockito::Server::new_async().await;
    let subs_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(mockito::Matcher::UrlEncoded(
            "output".to_string(),
            "json".to_string(),
        ))
        .with_status(429)
        .with_header("Retry-After", "240")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider.auth_token = Some("token".to_string());
    let error = provider
        .get_subscriptions()
        .await
        .expect_err("rate limit should preserve retry-after seconds");

    assert_eq!(
        error.to_string(),
        "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=240"
    );
    subs_mock.assert_async().await;
}

#[tokio::test]
async fn redaction_authenticate_auth_failure_does_not_surface_credentials() {
    let mut server = mockito::Server::new_async().await;
    let auth_mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header("Content-Type", "application/x-www-form-urlencoded")
        .with_status(401)
        .create_async()
        .await;
    let username = "secret-user@example.com";
    let password = "secret-password";

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    let error = provider
        .authenticate(&Credentials {
            password: Some(password.into()),
            token: Some(username.into()),
        })
        .await
        .expect_err("auth failure should return a domain error");
    let domain_message = error.to_string();

    assert_eq!(domain_message, "Auth error: HTTP 401 Unauthorized");
    assert!(!domain_message.contains(username));
    assert!(!domain_message.contains(password));

    match AppError::from(error) {
        AppError::UserVisible { message } => {
            assert_eq!(message, "Auth error: HTTP 401 Unauthorized");
            assert!(!message.contains(username));
            assert!(!message.contains(password));
        }
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            panic!("auth failures should remain user visible: {message}");
        }
    }
    auth_mock.assert_async().await;
}

#[test]
fn redaction_debug_output_redacts_greader_auth_token() {
    let mut provider =
        GReaderProvider::for_freshrss("https://secret-user:secret-password@freshrss.example.com");
    provider.auth_token = Some("secret-auth-token".into());

    let debug_output = format!("{provider:?}");

    assert!(debug_output.contains("[redacted]"));
    assert!(!debug_output.contains("secret-auth-token"));
    assert!(!debug_output.contains("secret-user"));
    assert!(!debug_output.contains("secret-password"));
    assert!(!debug_output.contains("freshrss.example.com"));
}

#[test]
fn redaction_auth_header_error_does_not_surface_greader_auth_token() {
    let mut provider = GReaderProvider::for_freshrss("https://freshrss.example.com");
    provider.auth_token = Some("secret-auth-token\ninvalid".into());

    let error = provider
        .auth_header()
        .expect_err("invalid header token should fail");
    let message = error.to_string();

    assert!(matches!(error, DomainError::Auth(_)));
    assert!(!message.contains("secret-auth-token"));
    assert!(!message.contains("invalid"));
}

#[tokio::test]
async fn get_subscriptions_parses_list() {
    let mut server = mockito::Server::new_async().await;
    let auth_mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let sub_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "subscriptions": [
                    {
                        "id": "feed/https://example.com/rss",
                        "title": "Example Feed",
                        "url": "https://example.com/rss",
                        "htmlUrl": "https://example.com",
                        "categories": [
                            {"id": "user/-/state/com.google/reading-list", "label": "reading-list"},
                            {"id": "user/-/label/Tech", "label": "Tech"}
                        ],
                        "iconUrl": "https://example.com/icon.png"
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let subs = provider.get_subscriptions().await.unwrap();
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].title, "Example Feed");
    assert_eq!(subs[0].remote_id, "feed/https://example.com/rss");
    assert_eq!(
        subs[0].folder_remote_id.as_deref(),
        Some("user/-/label/Tech")
    );
    assert_eq!(
        subs[0].icon_url.as_deref(),
        Some("https://example.com/icon.png")
    );

    auth_mock.assert_async().await;
    sub_mock.assert_async().await;
}

#[tokio::test]
async fn get_subscriptions_allows_missing_categories_and_html_url() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let sub_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "subscriptions": [
                    {
                        "id": "feed/https://example.com/rss",
                        "title": "Example Feed",
                        "url": "https://example.com/rss"
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let subs = provider.get_subscriptions().await.unwrap();

    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].remote_id, "feed/https://example.com/rss");
    assert_eq!(subs[0].site_url, "");
    assert_eq!(subs[0].folder_remote_id, None);
    sub_mock.assert_async().await;
}

#[tokio::test]
async fn get_subscriptions_applies_metadata_url_policy_fixtures() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
        .create_async()
        .await;

    let sub_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::ok(
            r#"{
                "subscriptions": [
                    {
                        "id": "feed/https://example.com/javascript",
                        "title": "JavaScript URL",
                        "url": "https://example.com/javascript",
                        "htmlUrl": "javascript:alert(1)",
                        "iconUrl": "data:image/png;base64,abc"
                    },
                    {
                        "id": "feed/https://example.com/ok",
                        "title": "OK Feed",
                        "url": "https://example.com/ok",
                        "htmlUrl": " https://example.com/home#section ",
                        "iconUrl": "https://example.com/icon.png"
                    },
                    {
                        "id": "feed/https://example.com/relative",
                        "title": "Relative URL",
                        "url": "https://example.com/relative",
                        "htmlUrl": "//example.com/home",
                        "iconUrl": "/icon.png"
                    },
                    {
                        "id": "feed/https://example.com/userinfo",
                        "title": "Credential URL",
                        "url": "https://example.com/userinfo",
                        "htmlUrl": "https://alice:secret@example.com/home",
                        "iconUrl": "https://alice:secret@example.com/icon.png"
                    },
                    {
                        "id": "feed/https://example.com/unicode",
                        "title": "Unicode Host",
                        "url": "https://example.com/unicode",
                        "htmlUrl": "https://例え.テスト/home",
                        "iconUrl": "https://例え.テスト/icon.png#private"
                    }
                ]
            }"#,
        ))
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let subs = provider.get_subscriptions().await.unwrap();

    assert_eq!(subs[0].site_url, "");
    assert_eq!(subs[0].icon_url, None);
    assert_eq!(subs[1].site_url, "https://example.com/home");
    assert_eq!(
        subs[1].icon_url.as_deref(),
        Some("https://example.com/icon.png")
    );
    assert_eq!(subs[2].site_url, "");
    assert_eq!(subs[2].icon_url, None);
    assert_eq!(subs[3].site_url, "");
    assert_eq!(subs[3].icon_url, None);
    assert_eq!(subs[4].site_url, "https://xn--r8jz45g.xn--zckzah/home");
    assert_eq!(
        subs[4].icon_url.as_deref(),
        Some("https://xn--r8jz45g.xn--zckzah/icon.png")
    );
    sub_mock.assert_async().await;
}

#[tokio::test]
async fn get_subscriptions_normalizes_label_remote_ids() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let sub_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "subscriptions": [
                    {
                        "id": "feed/https://example.com/dev",
                        "title": "Dev Feed",
                        "url": "https://example.com/dev",
                        "htmlUrl": "https://example.com/dev",
                        "categories": [
                            {"id": "user/-/label/Dev%20News"}
                        ]
                    },
                    {
                        "id": "feed/https://example.com/display",
                        "title": "Display Feed",
                        "url": "https://example.com/display",
                        "htmlUrl": "https://example.com/display",
                        "categories": [
                            {"id": "user/-/label/Encoded%20Id", "label": "Display Name"}
                        ]
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let subs = provider.get_subscriptions().await.unwrap();

    assert_eq!(
        subs.iter()
            .map(|sub| sub.folder_remote_id.as_deref())
            .collect::<Vec<_>>(),
        [
            Some("user/-/label/Dev News"),
            Some("user/-/label/Display Name")
        ]
    );
    sub_mock.assert_async().await;
}

#[tokio::test]
async fn get_subscriptions_maps_provider_http_status_categories() {
    let cases = [
        (401, "Auth error: HTTP 401 Unauthorized"),
        (429, "Rate limit error: HTTP 429 Too Many Requests"),
        (502, "Network error: HTTP 502 Bad Gateway"),
    ];

    for (status, expected_message) in cases {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let sub_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/subscription/list?output=json",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(status)
            .create_async()
            .await;

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let error = provider.get_subscriptions().await.unwrap_err();

        assert_eq!(error.to_string(), expected_message);
        sub_mock.assert_async().await;
    }
}

#[tokio::test]
async fn get_folders_filters_labels() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let tag_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list?output=json")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "tags": [
                    {"id": "user/-/state/com.google/starred"},
                    {"id": "user/-/state/com.google/reading-list"},
                    {"id": "user/-/label/Tech"},
                    {"id": "user/-/label/News"}
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let folders = provider.get_folders().await.unwrap();
    assert_eq!(folders.len(), 2);
    assert_eq!(folders[0].name, "Tech");
    assert_eq!(folders[0].remote_id, "user/-/label/Tech");
    assert_eq!(folders[1].name, "News");

    tag_mock.assert_async().await;
}

#[tokio::test]
async fn get_folders_rejects_invalid_user_label_snapshot_instead_of_dropping_it() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let tag_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list?output=json")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "tags": [
                    {"id": "user/-/state/com.google/starred"},
                    {"id": "user/-/label/Bad%ZZ"},
                    {"id": "user/-/label/Bad%2FName"},
                    {"id": "user/-/label/%20%20"}
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let error = provider
        .get_folders()
        .await
        .expect_err("invalid user label must fail the folder snapshot");

    assert!(matches!(error, DomainError::Parse(message) if message.contains("invalid label")));
    tag_mock.assert_async().await;
}

#[tokio::test]
async fn get_folders_normalizes_url_encoded_label_ids_and_label_fields() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list?output=json")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "tags": [
                    {"id": "user/-/label/Dev%20News"},
                    {"id": "user/-/label/Encoded%20Id", "label": "Display Name"}
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let folders = provider.get_folders().await.unwrap();

    assert_eq!(
        folders
            .iter()
            .map(|folder| folder.remote_id.as_str())
            .collect::<Vec<_>>(),
        ["user/-/label/Dev News", "user/-/label/Display Name"]
    );
    assert_eq!(
        folders
            .iter()
            .map(|folder| folder.name.as_str())
            .collect::<Vec<_>>(),
        ["Dev News", "Display Name"]
    );
}

#[tokio::test]
async fn pull_entries_parses_stream_with_continuation() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*output=json.*".to_string(),
            ),
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::json(
            r#"{
                "items": [
                    {
                        "id": "entry-1",
                        "title": "Test Article",
                        "alternate": [{"href": "https://example.com/article"}],
                        "summary": {"content": "Short summary"},
                        "content": {"content": "<p>Full content</p>"},
                        "author": "Alice",
                        "timestampUsec": "1700000100000000",
                        "published": 1700000000,
                        "updated": 1700000100,
                        "origin": {
                            "streamId": "feed/https://example.com/rss",
                            "title": "Example"
                        },
                        "categories": [
                            "user/-/state/com.google/reading-list",
                            "user/-/state/com.google/read"
                        ]
                    },
                    {
                        "id": "entry-2",
                        "title": "No Origin Article",
                        "categories": []
                    }
                ],
                "continuation": "page2token"
            }"#,
        ))
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let result = provider.pull_entries(PullScope::All, None).await.unwrap();

    // entry-2 has no origin, so it's filtered out
    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].title, "Test Article");
    assert_eq!(
        result.entries[0].url.as_deref(),
        Some("https://example.com/article")
    );
    assert_eq!(result.entries[0].content, "<p>Full content</p>");
    assert_eq!(result.entries[0].summary.as_deref(), Some("Short summary"));
    assert_eq!(result.entries[0].author.as_deref(), Some("Alice"));
    assert_eq!(result.entries[0].is_read, Some(true));
    assert_eq!(result.entries[0].is_starred, Some(false));

    // Check source_feed_id
    match &result.entries[0].source_feed_id {
        FeedIdentifier::Remote { remote_id } => {
            assert_eq!(remote_id, "feed/https://example.com/rss");
        }
        _ => panic!("Expected Remote feed identifier"),
    }

    // Continuation
    assert!(result.has_more);
    let cursor = result.next_cursor.unwrap();
    assert_eq!(cursor.continuation.as_deref(), Some("page2token"));
    assert_eq!(
        cursor.since.map(|ts| ts.timestamp_micros()),
        Some(1_700_000_100_000_000)
    );
    assert_eq!(result.skipped_entries, 1);

    stream_mock.assert_async().await;
}

#[tokio::test]
async fn pull_entries_defaults_missing_item_categories_to_unread_and_unstarred() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*output=json.*".to_string(),
            ),
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "items": [
                    {
                        "id": "entry-without-categories",
                        "title": "Missing categories",
                        "alternate": [{"href": "https://example.com/missing-categories"}],
                        "summary": {"content": "Summary"},
                        "published": 1700000000,
                        "updated": 1700000100,
                        "origin": {
                            "streamId": "feed/https://example.com/rss",
                            "title": "Example"
                        }
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let result = provider.pull_entries(PullScope::All, None).await.unwrap();

    assert_eq!(result.entries.len(), 1);
    assert_eq!(
        result.entries[0].id.as_deref(),
        Some("entry-without-categories")
    );
    assert_eq!(result.entries[0].is_read, Some(false));
    assert_eq!(result.entries[0].is_starred, Some(false));
    stream_mock.assert_async().await;
}

#[test]
fn map_item_to_entry_uses_exact_read_and_starred_state_ids() {
    let item = greader_item("entry-1")
        .title("Exact state ids only")
        .categories(vec![
            format!("{STATE_READ}/archive"),
            format!("label/{STATE_STARRED}"),
            STATE_READING_LIST.to_string(),
        ])
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    assert_eq!(entry.is_read, Some(false));
    assert_eq!(entry.is_starred, Some(false));
}

struct GReaderItemBuilder {
    item: GReaderItem,
}

fn greader_item(id: &str) -> GReaderItemBuilder {
    GReaderItemBuilder {
        item: GReaderItem {
            id: id.to_string(),
            title: Some("Round-trip item".to_string()),
            canonical: None,
            alternate: None,
            summary: None,
            content: None,
            author: None,
            published: None,
            updated: None,
            timestamp_usec: None,
            origin: Some(GReaderOrigin {
                stream_id: "feed/https://example.com/rss".to_string(),
            }),
            categories: Vec::new(),
        },
    }
}

impl GReaderItemBuilder {
    fn title(mut self, title: &str) -> Self {
        self.item.title = Some(title.to_string());
        self
    }

    fn canonical(mut self, links: Vec<GReaderLink>) -> Self {
        self.item.canonical = Some(links);
        self
    }

    fn alternate(mut self, links: Vec<GReaderLink>) -> Self {
        self.item.alternate = Some(links);
        self
    }

    fn updated(mut self, updated: i64) -> Self {
        self.item.updated = Some(updated);
        self
    }

    fn categories(mut self, categories: Vec<String>) -> Self {
        self.item.categories = categories;
        self
    }

    fn build(self) -> GReaderItem {
        self.item
    }
}

#[test]
fn remote_item_id_round_trips_from_decimal_stream_ids() {
    let contents_id = "tag:google.com,2005:reader/item/00000000499602d2";
    let entry =
        GReaderProvider::map_item_to_entry(greader_item(contents_id).build(), None).unwrap();

    assert_eq!(entry.id.as_deref(), Some(contents_id));
    assert_eq!(normalize_item_id("1234567890"), contents_id);
}

#[test]
fn remote_item_id_round_trips_from_canonical_tag_ids() {
    let tag_id = "tag:google.com,2005:reader/item/00000000499602d2";

    assert_eq!(
        GReaderProvider::map_item_to_entry(greader_item(tag_id).build(), None)
            .unwrap()
            .id
            .as_deref(),
        Some(tag_id)
    );
    assert_eq!(normalize_item_id(tag_id), tag_id);
}

#[test]
fn short_hex_remote_item_ids_do_not_match_decimal_normalization() {
    // This records current behavior, not a desired contract. FreshRSS returns the canonical
    // 16-digit zero-padded form, so existing fixtures and working production read sync show no
    // exposure as of 2026-08-29. If another provider returns short hex, contents stays raw while
    // items/ids pads it to 16 digits, so apply_remote_state can roll every article back to unread.
    // The end-to-end contents/items/ids integration is covered by
    // commands/sync_providers/tests/remote_state_repair.rs through mockito.
    let short_hex_tag = "tag:google.com,2005:reader/item/499602d2";

    assert_eq!(
        GReaderProvider::map_item_to_entry(greader_item(short_hex_tag).build(), None)
            .unwrap()
            .id
            .as_deref(),
        Some(short_hex_tag)
    );
    assert_ne!(
        normalize_item_id(short_hex_tag),
        normalize_item_id("1234567890")
    );
}

#[test]
fn map_item_to_entry_uses_updated_as_published_fallback() {
    let item = greader_item("entry-1")
        .title("Updated fallback")
        .updated(1_700_000_100)
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    let expected = DateTime::from_timestamp(1_700_000_100, 0);
    assert_eq!(entry.published_at, expected);
    assert_eq!(entry.updated_at, expected);
}

#[test]
fn map_item_to_entry_uses_alternate_before_canonical_url_fallback() {
    let item = greader_item("entry-1")
        .title("Canonical fallback")
        .canonical(vec![
            GReaderLink {
                href: String::new(),
            },
            GReaderLink {
                href: "https://example.com/canonical".to_string(),
            },
        ])
        .alternate(vec![
            GReaderLink {
                href: String::new(),
            },
            GReaderLink {
                href: "https://example.com/alternate".to_string(),
            },
        ])
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    assert_eq!(entry.url.as_deref(), Some("https://example.com/alternate"));
}

#[test]
fn map_item_to_entry_uses_canonical_url_when_alternate_is_missing() {
    let item = greader_item("entry-1")
        .title("Canonical fallback")
        .canonical(vec![
            GReaderLink {
                href: String::new(),
            },
            GReaderLink {
                href: "https://example.com/canonical".to_string(),
            },
        ])
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    assert_eq!(entry.url.as_deref(), Some("https://example.com/canonical"));
}

#[test]
fn map_item_to_entry_normalizes_canonical_url_with_article_link_policy() {
    let item = greader_item("entry-1")
        .title("Canonical fallback")
        .canonical(vec![GReaderLink {
            href: " HTTPS://Example.COM:443/Article?utm_source=reader#tracking ".to_string(),
        }])
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    assert_eq!(
        entry.url.as_deref(),
        Some("https://example.com/Article?utm_source=reader")
    );
}

#[test]
fn map_item_to_entry_uses_canonical_url_when_alternate_href_is_blank() {
    let item = greader_item("entry-1")
        .title("Canonical fallback")
        .canonical(vec![GReaderLink {
            href: "https://example.com/canonical".to_string(),
        }])
        .alternate(vec![GReaderLink {
            href: " \n\t ".to_string(),
        }])
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    assert_eq!(entry.url.as_deref(), Some("https://example.com/canonical"));
}

#[test]
fn map_item_to_entry_strips_url_credentials_and_fragment() {
    let item = greader_item("entry-1")
        .title("Private URL")
        .alternate(vec![GReaderLink {
            href: "https://alice:secret@example.com/article#token".to_string(),
        }])
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    assert_eq!(entry.url.as_deref(), Some("https://example.com/article"));
}

#[test]
fn map_item_to_entry_skips_invalid_article_urls() {
    let item = greader_item("entry-1")
        .title("Invalid URL")
        .canonical(vec![GReaderLink {
            href: "https://example.com/canonical".to_string(),
        }])
        .alternate(vec![
            GReaderLink {
                href: "javascript:alert(1)".to_string(),
            },
            GReaderLink {
                href: "https://example.com/alternate\u{8}".to_string(),
            },
        ])
        .build();

    let entry = GReaderProvider::map_item_to_entry(item, None).unwrap();

    assert_eq!(entry.url.as_deref(), Some("https://example.com/canonical"));
}

#[tokio::test]
async fn pull_entries_for_feed_scope_uses_requested_stream_when_origin_is_missing() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*output=json.*".to_string(),
            ),
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "items": [
                    {
                        "id": "entry-1",
                        "title": "Feed-scoped Article",
                        "alternate": [{"href": "https://example.com/article"}],
                        "summary": {"content": "Short summary"},
                        "content": {"content": "<p>Full content</p>"},
                        "author": "Alice",
                        "timestampUsec": "1700000100000000",
                        "published": 1700000000,
                        "updated": 1700000100,
                        "categories": [
                            "user/-/state/com.google/reading-list"
                        ]
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let result = provider
        .pull_entries(
            PullScope::Feed(FeedIdentifier::Remote {
                remote_id: "feed/2".to_string(),
            }),
            None,
        )
        .await
        .unwrap();

    assert_eq!(result.entries.len(), 1);
    match &result.entries[0].source_feed_id {
        FeedIdentifier::Remote { remote_id } => {
            assert_eq!(remote_id, "feed/2");
        }
        _ => panic!("Expected Remote feed identifier"),
    }
    assert_eq!(result.skipped_entries, 0);

    stream_mock.assert_async().await;
}

#[tokio::test]
async fn pull_entries_includes_ot_when_since_cursor_is_present() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
            ),
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "200".into()),
            mockito::Matcher::UrlEncoded("c".into(), "page1".into()),
            mockito::Matcher::UrlEncoded("ot".into(), "1700000100000000".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "items": [] }"#)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let cursor = SyncCursor {
        continuation: Some("page1".to_string()),
        since: Some(DateTime::from_timestamp_micros(1_700_000_100_000_000).unwrap()),
        etag: None,
        last_modified: None,
    };
    let result = provider
        .pull_entries(PullScope::All, Some(cursor))
        .await
        .unwrap();

    assert!(!result.has_more);
    assert!(result.entries.is_empty());
    stream_mock.assert_async().await;
}

#[tokio::test]
async fn pull_entries_uses_oldest_timestamp_for_ot_cursor_fallback() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
            ),
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "items": [
                    {
                        "id": "newer",
                        "title": "Newer",
                        "timestampUsec": "1700000200000000",
                        "origin": { "streamId": "feed/https://example.com/rss" }
                    },
                    {
                        "id": "older",
                        "title": "Older",
                        "timestampUsec": "1700000100000000",
                        "origin": { "streamId": "feed/https://example.com/rss" }
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let result = provider.pull_entries(PullScope::All, None).await.unwrap();

    assert_eq!(
        result
            .next_cursor
            .and_then(|cursor| cursor.since)
            .map(|timestamp| timestamp.timestamp_micros()),
        Some(1_700_000_100_000_000)
    );
    stream_mock.assert_async().await;
}

#[tokio::test]
async fn pull_entries_keeps_equal_timestamp_reachable_when_ot_fallback_page_is_full() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let items = (0..STREAM_CONTENTS_LIMIT)
        .map(|index| {
            format!(
                r#"{{
                    "id": "entry-{index}",
                    "title": "Entry {index}",
                    "timestampUsec": "1700000100000000",
                    "origin": {{ "streamId": "feed/https://example.com/rss" }}
                }}"#
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    let body = format!(r#"{{ "items": [{items}] }}"#);

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
            ),
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(body)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let result = provider.pull_entries(PullScope::All, None).await.unwrap();

    assert_eq!(result.entries.len(), STREAM_CONTENTS_LIMIT as usize);
    assert_eq!(
        result
            .next_cursor
            .and_then(|cursor| cursor.since)
            .map(|timestamp| timestamp.timestamp_micros()),
        Some(1_700_000_100_000_001)
    );
    stream_mock.assert_async().await;
}

#[tokio::test]
async fn pull_entries_stops_when_continuation_repeats() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
            ),
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "200".into()),
            mockito::Matcher::UrlEncoded("c".into(), "same-page".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::json(
            r#"{ "items": [], "continuation": "same-page" }"#,
        ))
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let result = provider
        .pull_entries(
            PullScope::All,
            Some(SyncCursor {
                continuation: Some("same-page".to_string()),
                since: None,
                etag: None,
                last_modified: None,
            }),
        )
        .await
        .unwrap();

    assert!(!result.has_more);
    assert_eq!(
        result.next_cursor.and_then(|cursor| cursor.continuation),
        None
    );
    stream_mock.assert_async().await;
}

#[tokio::test]
async fn pull_entries_surfaces_malformed_json_fixture_error() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_greader_response(ProviderHttpResponseFixture::ok("Auth=tok\n"))
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
            ),
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "200".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::malformed_json())
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    provider
        .pull_entries(PullScope::All, None)
        .await
        .expect_err("malformed provider JSON should surface a parse error");
    stream_mock.assert_async().await;
}

#[tokio::test]
async fn get_unread_count_map_rejects_oversized_json_before_parse_without_secret_diagnostics() {
    let mut server = mockito::Server::new_async().await;
    let token = "secret-auth-token";
    let unread_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=secret-auth-token")
        .with_status(200)
        .with_body(oversized_json_body())
        .with_header("content-type", "application/json")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider.auth_token = Some(token.to_string());

    let error = provider
        .get_unread_count_map()
        .await
        .expect_err("oversized unread-count JSON should be rejected before parsing");
    let message = error.to_string();

    assert_eq!(
        message,
        format!("Network error: {}", greader_json_body_limit_error_message())
    );
    assert!(!message.contains(token));
    assert!(!message.contains(&server.url()));
    unread_mock.assert_async().await;
}

#[tokio::test]
async fn pull_entries_rejects_oversized_stream_contents_json_before_parse() {
    let mut server = mockito::Server::new_async().await;
    let stream_mock = server
        .mock(
            "GET",
            mockito::Matcher::Regex(
                r"/api/greader.php/reader/api/0/stream/contents/.*".to_string(),
            ),
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "200".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(oversized_json_body())
        .with_header("content-type", "application/json")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider.auth_token = Some("tok".to_string());

    let error = provider
        .pull_entries(PullScope::All, None)
        .await
        .expect_err("oversized stream contents JSON should be rejected before parsing");

    assert!(matches!(
        error,
        DomainError::Network(message) if message == greader_json_body_limit_error_message()
    ));
    stream_mock.assert_async().await;
}

#[tokio::test]
async fn pull_item_ids_page_rejects_oversized_json_before_parse() {
    let mut server = mockito::Server::new_async().await;
    let ids_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(oversized_json_body())
        .with_header("content-type", "application/json")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider.auth_token = Some("tok".to_string());

    let result = provider.pull_item_ids_page(STATE_READ, None).await;
    let Err(error) = result else {
        panic!("oversized item IDs JSON should be rejected before parsing");
    };

    assert!(matches!(
        error,
        DomainError::Network(message) if message == greader_json_body_limit_error_message()
    ));
    ids_mock.assert_async().await;
}

#[tokio::test]
async fn get_unread_count_map_rejects_gzip_decoded_oversized_json_before_parse() {
    let oversized_body = oversized_json_body();
    let compressed_body = gzip_body(&oversized_body);
    assert!(
        compressed_body.len() < http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize,
        "fixture must be compressed below the cap to prove decoded size is enforced"
    );

    let mut server = mockito::Server::new_async().await;
    let unread_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(compressed_body)
        .with_header("content-type", "application/json")
        .with_header("content-encoding", "gzip")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider.auth_token = Some("tok".to_string());

    let error = provider
        .get_unread_count_map()
        .await
        .expect_err("gzip-decoded oversized GReader JSON should be rejected before parsing");

    assert!(matches!(
        error,
        DomainError::Network(message) if message == greader_json_body_limit_error_message()
    ));
    unread_mock.assert_async().await;
}

#[tokio::test]
async fn pull_state_requests_read_and_starred_stream_ids_with_valid_queries() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let read_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    let starred_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let state = provider.pull_state().await.unwrap();

    assert!(state.read_ids.is_empty());
    assert!(state.starred_ids.is_empty());
    read_mock.assert_async().await;
    starred_mock.assert_async().await;
}

#[tokio::test]
async fn pull_state_follows_continuation_until_all_ids_are_loaded() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let read_page_1 = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::item_refs_page(
            &["1"],
            Some("read-next"),
        ))
        .create_async()
        .await;

    let read_page_2 = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            mockito::Matcher::UrlEncoded("c".into(), "read-next".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::item_refs_page(&["2"], None))
        .create_async()
        .await;

    let starred_page_1 = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::item_refs_page(
            &["3"],
            Some("star-next"),
        ))
        .create_async()
        .await;

    let starred_page_2 = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
            mockito::Matcher::UrlEncoded("c".into(), "star-next".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_greader_response(ProviderHttpResponseFixture::item_refs_page(&["4"], None))
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let state = provider.pull_state().await.unwrap();

    assert_eq!(
        state.read_ids,
        vec![
            "tag:google.com,2005:reader/item/0000000000000001".to_string(),
            "tag:google.com,2005:reader/item/0000000000000002".to_string(),
        ]
    );
    assert_eq!(
        state.starred_ids,
        vec![
            "tag:google.com,2005:reader/item/0000000000000003".to_string(),
            "tag:google.com,2005:reader/item/0000000000000004".to_string(),
        ]
    );
    read_page_1.assert_async().await;
    read_page_2.assert_async().await;
    starred_page_1.assert_async().await;
    starred_page_2.assert_async().await;
}

#[tokio::test]
async fn pull_state_dedupes_stream_ids_before_memory_cap_counting() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let read_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [{ "id": "1" }, { "id": "1" }, { "id": "2" }] }"#)
        .create_async()
        .await;

    let starred_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let state = provider.pull_state().await.unwrap();

    assert_eq!(
        state.read_ids,
        vec![
            "tag:google.com,2005:reader/item/0000000000000001".to_string(),
            "tag:google.com,2005:reader/item/0000000000000002".to_string(),
        ]
    );
    read_mock.assert_async().await;
    starred_mock.assert_async().await;
}

#[tokio::test]
async fn pull_state_stops_when_ids_continuation_repeats() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let read_page_1 = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [{ "id": "1" }], "continuation": "repeat" }"#)
        .create_async()
        .await;

    let read_page_2 = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
            mockito::Matcher::UrlEncoded("c".into(), "repeat".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [{ "id": "2" }], "continuation": "repeat" }"#)
        .create_async()
        .await;

    let starred_page = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_STARRED.into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let state = provider.pull_state().await.unwrap();

    assert_eq!(
        state.read_ids,
        vec![
            "tag:google.com,2005:reader/item/0000000000000001".to_string(),
            "tag:google.com,2005:reader/item/0000000000000002".to_string(),
        ]
    );
    assert!(state.starred_ids.is_empty());
    read_page_1.assert_async().await;
    read_page_2.assert_async().await;
    starred_page.assert_async().await;
}

#[tokio::test]
async fn pull_all_item_ids_errors_when_max_pages_leave_continuation() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let mut page_mocks = Vec::new();
    for page in 0..G_READER_MAX_PAGES {
        let mut query_matchers = vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "10000".into()),
            mockito::Matcher::UrlEncoded("s".into(), STATE_READ.into()),
        ];
        if page > 0 {
            query_matchers.push(mockito::Matcher::UrlEncoded(
                "c".into(),
                format!("page-{page}"),
            ));
        }

        page_mocks.push(
            server
                .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
                .match_query(mockito::Matcher::AllOf(query_matchers))
                .match_header("Authorization", "GoogleLogin auth=tok")
                .with_status(200)
                .with_body(format!(
                    r#"{{ "itemRefs": [{{ "id": "{page}" }}], "continuation": "page-{}" }}"#,
                    page + 1
                ))
                .create_async()
                .await,
        );
    }

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let error = provider
        .pull_all_item_ids(STATE_READ)
        .await
        .expect_err("remaining continuation after max pages should fail");

    assert!(matches!(error, DomainError::Network(_)));
    assert_eq!(
        error.to_string(),
        "Network error: Incomplete GReader item id sync: reached 100 pages with continuation remaining (reason=page_limit, continuation_bytes=8)"
    );
    for page_mock in page_mocks {
        page_mock.assert_async().await;
    }
}

// === Live integration tests ===
// Run with: dotenvx run -- cargo test --manifest-path src-tauri/Cargo.toml freshrss_live -- --ignored
// Or: mise test:live

struct LiveFreshRssCredentials {
    url: String,
    user: String,
    pass: String,
}

fn live_freshrss_credentials() -> Option<LiveFreshRssCredentials> {
    let url = std::env::var("FRESHRSS_URL").ok()?;
    let user = std::env::var("FRESHRSS_USER").ok()?;
    let pass = std::env::var("FRESHRSS_PASS").ok()?;
    Some(LiveFreshRssCredentials { url, user, pass })
}

fn skip_live_freshrss_test_when_env_is_missing(test_name: &str) {
    eprintln!(
        "skipping {test_name}: set FRESHRSS_URL, FRESHRSS_USER, and FRESHRSS_PASS to run manually"
    );
}

#[tokio::test]
#[ignore]
async fn freshrss_live_auth() {
    let Some(credentials) = live_freshrss_credentials() else {
        skip_live_freshrss_test_when_env_is_missing("freshrss_live_auth");
        return;
    };

    let mut provider = GReaderProvider::for_freshrss(&credentials.url);
    let creds = Credentials {
        token: Some(credentials.user),
        password: Some(credentials.pass),
    };
    provider.authenticate(&creds).await.unwrap();
    assert!(provider.auth_token.is_some());
    println!("Auth token: [redacted]");
}

#[tokio::test]
#[ignore]
async fn freshrss_live_subscriptions() {
    let Some((provider, _)) = live_provider("freshrss_live_subscriptions").await else {
        return;
    };
    let subs = provider.get_subscriptions().await.unwrap();
    println!("Subscriptions: {}", subs.len());
    for sub in &subs {
        println!("  - {} ({})", sub.title, sub.remote_id);
    }
    assert!(!subs.is_empty(), "Should have at least one subscription");
}

#[tokio::test]
#[ignore]
async fn freshrss_live_folders() {
    let Some((provider, _)) = live_provider("freshrss_live_folders").await else {
        return;
    };
    let folders = provider.get_folders().await.unwrap();
    println!("Folders: {}", folders.len());
    for f in &folders {
        println!("  - {} ({})", f.name, f.remote_id);
    }
}

#[tokio::test]
#[ignore]
async fn freshrss_live_pull_entries() {
    let Some((provider, _)) = live_provider("freshrss_live_pull_entries").await else {
        return;
    };
    let result = provider.pull_entries(PullScope::All, None).await.unwrap();
    println!("Entries: {}", result.entries.len());
    println!("Has more: {}", result.has_more);
    for entry in result.entries.iter().take(5) {
        println!(
            "  - {} (read={:?}, starred={:?})",
            entry.title, entry.is_read, entry.is_starred
        );
    }
    assert!(!result.entries.is_empty(), "Should have at least one entry");
}

#[tokio::test]
#[ignore]
async fn freshrss_live_pull_state() {
    let Some((provider, _)) = live_provider("freshrss_live_pull_state").await else {
        return;
    };
    let state = provider.pull_state().await.unwrap();
    println!("Read IDs: {}", state.read_ids.len());
    println!("Starred IDs: {}", state.starred_ids.len());
}

#[tokio::test]
#[ignore]
async fn freshrss_live_edit_subscription() {
    let Some((provider, _)) = live_provider("freshrss_live_edit_subscription").await else {
        return;
    };

    let subs = provider.get_subscriptions().await.unwrap();
    let Some(original) = subs.first() else {
        println!("No subscriptions found on live server; skipping edit_subscription verification");
        return;
    };

    let remote_id = original.remote_id.clone();
    let original_title = original.title.clone();
    let original_folder_remote_id = original.folder_remote_id.clone();

    let folders = provider.get_folders().await.unwrap();
    let original_folder_name = original_folder_remote_id.as_ref().and_then(|folder_id| {
        folders
            .iter()
            .find(|f| &f.remote_id == folder_id)
            .map(|f| f.name.clone())
    });

    // Pick an existing folder distinct from the subscription's current folder
    // (if any) to exercise a real add/remove round trip.
    let target_folder_name = folders
        .iter()
        .map(|f| f.name.clone())
        .find(|name| Some(name.clone()) != original_folder_name);

    let new_title = format!("{original_title} [live-test]");

    // --- Rename verification ---
    let rename_result: Result<(), String> = async {
        provider
            .edit_subscription(&remote_id, Some(&new_title), None, None)
            .await
            .map_err(|e| format!("edit_subscription rename call failed: {e}"))?;

        let subs_after = provider
            .get_subscriptions()
            .await
            .map_err(|e| format!("get_subscriptions after rename failed: {e}"))?;
        let renamed = subs_after
            .iter()
            .find(|s| s.remote_id == remote_id)
            .ok_or_else(|| "subscription disappeared after rename".to_string())?;
        if renamed.title != new_title {
            return Err(format!(
                "expected title '{new_title}' after rename, server reports '{}'",
                renamed.title
            ));
        }
        println!("Rename verified: '{original_title}' -> '{}'", renamed.title);
        Ok(())
    }
    .await;

    // Restore the original title regardless of the rename outcome above, so a
    // failed assertion never leaves the user's real server renamed.
    let restore_title_result = provider
        .edit_subscription(&remote_id, Some(&original_title), None, None)
        .await
        .map_err(|e| format!("restore title call failed: {e}"));

    let restore_verify_result: Result<(), String> = async {
        let subs_after = provider
            .get_subscriptions()
            .await
            .map_err(|e| format!("get_subscriptions after restore failed: {e}"))?;
        let restored = subs_after
            .iter()
            .find(|s| s.remote_id == remote_id)
            .ok_or_else(|| "subscription disappeared after restore".to_string())?;
        if restored.title != original_title {
            return Err(format!(
                "restore failed: expected title '{original_title}', server reports '{}'",
                restored.title
            ));
        }
        println!("Restore verified: title back to '{original_title}'");
        Ok(())
    }
    .await;

    // --- Folder add/remove round trip (only when an alternate folder exists) ---
    let folder_result: Result<(), String> = if let Some(target_folder_name) =
        target_folder_name.clone()
    {
        async {
                provider
                    .edit_subscription(&remote_id, None, Some(&target_folder_name), None)
                    .await
                    .map_err(|e| format!("add folder label call failed: {e}"))?;

                let subs_after = provider
                    .get_subscriptions()
                    .await
                    .map_err(|e| format!("get_subscriptions after folder add failed: {e}"))?;
                let moved = subs_after
                    .iter()
                    .find(|s| s.remote_id == remote_id)
                    .ok_or_else(|| "subscription disappeared after folder add".to_string())?;

                let folders_after = provider
                    .get_folders()
                    .await
                    .map_err(|e| format!("get_folders after folder add failed: {e}"))?;
                let moved_folder_name = moved
                    .folder_remote_id
                    .as_ref()
                    .and_then(|fid| folders_after.iter().find(|f| &f.remote_id == fid))
                    .map(|f| f.name.clone());

                if moved_folder_name.as_deref() != Some(target_folder_name.as_str()) {
                    return Err(format!(
                        "expected folder '{target_folder_name}' after add, server reports {moved_folder_name:?}"
                    ));
                }
                println!("Folder add verified: subscription now in '{target_folder_name}'");
                Ok(())
            }
            .await
    } else {
        println!(
            "No alternate folder available on live server; skipping folder add/remove verification"
        );
        Ok(())
    };

    // Restore the folder state regardless of the folder add outcome above.
    let restore_folder_result: Result<(), String> = if let Some(target_folder_name) =
        target_folder_name
    {
        async {
            provider
                .edit_subscription(
                    &remote_id,
                    None,
                    original_folder_name.as_deref(),
                    Some(&target_folder_name),
                )
                .await
                .map_err(|e| format!("restore folder call failed: {e}"))?;

            let subs_after = provider
                .get_subscriptions()
                .await
                .map_err(|e| format!("get_subscriptions after folder restore failed: {e}"))?;
            let restored = subs_after
                .iter()
                .find(|s| s.remote_id == remote_id)
                .ok_or_else(|| "subscription disappeared after folder restore".to_string())?;

            let folders_after = provider
                .get_folders()
                .await
                .map_err(|e| format!("get_folders after folder restore failed: {e}"))?;
            let restored_folder_name = restored
                .folder_remote_id
                .as_ref()
                .and_then(|fid| folders_after.iter().find(|f| &f.remote_id == fid))
                .map(|f| f.name.clone());

            if restored_folder_name != original_folder_name {
                return Err(format!(
                    "folder restore failed: expected {original_folder_name:?}, server reports {restored_folder_name:?}"
                ));
            }
            println!("Folder restore verified: back to {original_folder_name:?}");
            Ok(())
        }
        .await
    } else {
        Ok(())
    };

    // Aggregate failures only after every restore attempt above has run, so we
    // never skip restoring the live server's state just because an earlier
    // assertion failed.
    let mut failures = Vec::new();
    if let Err(e) = rename_result {
        failures.push(format!("rename: {e}"));
    }
    if let Err(e) = restore_title_result {
        failures.push(format!("restore title call: {e}"));
    }
    if let Err(e) = restore_verify_result {
        failures.push(format!("restore title verify: {e}"));
    }
    if let Err(e) = folder_result {
        failures.push(format!("folder add: {e}"));
    }
    if let Err(e) = restore_folder_result {
        failures.push(format!("folder restore: {e}"));
    }

    assert!(
        failures.is_empty(),
        "freshrss_live_edit_subscription failures: {failures:?}"
    );
}

/// Helper: create an authenticated live provider
async fn live_provider(test_name: &str) -> Option<(GReaderProvider, ())> {
    let Some(credentials) = live_freshrss_credentials() else {
        skip_live_freshrss_test_when_env_is_missing(test_name);
        return None;
    };

    let mut provider = GReaderProvider::for_freshrss(&credentials.url);
    provider
        .authenticate(&Credentials {
            token: Some(credentials.user),
            password: Some(credentials.pass),
        })
        .await
        .unwrap();
    Some((provider, ()))
}

#[tokio::test]
async fn push_mutations_sends_edit_tags() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let mark_read_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body("OK")
        .expect(3)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let mutations = vec![
        Mutation::MarkRead {
            remote_entry_id: "entry-1".into(),
        },
        Mutation::MarkUnread {
            remote_entry_id: "entry-2".into(),
        },
        Mutation::SetStarred {
            remote_entry_id: "entry-3".into(),
            starred: true,
        },
    ];

    provider.push_mutations(&mutations).await.unwrap();
    mark_read_mock.assert_async().await;
}

#[tokio::test]
async fn push_mutations_stops_after_first_failed_edit_tag() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let mark_read_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-1&a=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(200)
        .with_body("OK")
        .create_async()
        .await;
    let mark_unread_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-2&r=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(500)
        .with_body("failed")
        .create_async()
        .await;
    let star_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-3&a=user%2F-%2Fstate%2Fcom.google%2Fstarred")
        .expect(0)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let mutations = vec![
        Mutation::MarkRead {
            remote_entry_id: "entry-1".into(),
        },
        Mutation::MarkUnread {
            remote_entry_id: "entry-2".into(),
        },
        Mutation::SetStarred {
            remote_entry_id: "entry-3".into(),
            starred: true,
        },
    ];

    let error = provider
        .push_mutations(&mutations)
        .await
        .expect_err("first failed edit-tag should stop the remaining replay batch");

    assert!(matches!(error, DomainError::Network(_)));
    mark_read_mock.assert_async().await;
    mark_unread_mock.assert_async().await;
    star_mock.assert_async().await;
}

#[tokio::test]
async fn create_subscription_uses_exact_feed_url_match_after_quickadd() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let quickadd_mock = server
        .mock(
            "POST",
            "/api/greader.php/reader/api/0/subscription/quickadd",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body("OK")
        .create_async()
        .await;

    let sub_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "subscriptions": [
                    {
                        "id": "feed/https://example.com/rss-extra",
                        "title": "Collision",
                        "url": "https://example.com/rss-extra",
                        "htmlUrl": "https://example.com/collision"
                    },
                    {
                        "id": "feed/opaque-remote-id",
                        "title": "Exact",
                        "url": "https://example.com/rss",
                        "htmlUrl": "https://example.com"
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let subscription = provider
        .create_subscription("https://example.com/rss", None)
        .await
        .unwrap();

    assert_eq!(subscription.remote_id, "feed/opaque-remote-id");
    quickadd_mock.assert_async().await;
    sub_mock.assert_async().await;
}

#[tokio::test]
async fn create_subscription_uses_quickadd_stream_id_when_subscription_lookup_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let quickadd_mock = server
        .mock(
            "POST",
            "/api/greader.php/reader/api/0/subscription/quickadd",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "streamId": "feed/https://example.com/rss",
                "query": "Example Feed"
            }"#,
        )
        .create_async()
        .await;

    let sub_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(500)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let subscription = provider
        .create_subscription("https://example.com/rss", None)
        .await
        .unwrap();

    assert_eq!(subscription.remote_id, "feed/https://example.com/rss");
    assert_eq!(subscription.url, "https://example.com/rss");
    assert_eq!(subscription.title, "Example Feed");
    quickadd_mock.assert_async().await;
    sub_mock.assert_async().await;
}

#[tokio::test]
async fn create_subscription_matches_quickadd_stream_and_html_url_after_redirect() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let quickadd_mock = server
        .mock(
            "POST",
            "/api/greader.php/reader/api/0/subscription/quickadd",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "numResults": 1,
                "query": "https://example.com/start",
                "streamId": "feed/https://feeds.example.com/final.xml"
            }"#,
        )
        .create_async()
        .await;

    let sub_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                "subscriptions": [
                    {
                        "id": "feed/https://other.example.com/rss",
                        "title": "Other",
                        "url": "https://other.example.com/rss",
                        "htmlUrl": "https://example.com/other"
                    },
                    {
                        "id": "feed/opaque-final-id",
                        "title": "Final",
                        "url": "https://feeds.example.com/final.xml",
                        "htmlUrl": "https://example.com/final"
                    }
                ]
            }"#,
        )
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let subscription = provider
        .create_subscription("https://example.com/start", None)
        .await
        .unwrap();

    assert_eq!(subscription.remote_id, "feed/opaque-final-id");
    quickadd_mock.assert_async().await;
    sub_mock.assert_async().await;
}

#[test]
fn normalize_item_id_converts_decimal_to_long_form() {
    assert_eq!(
        normalize_item_id("1774810819788671"),
        "tag:google.com,2005:reader/item/00064e2e5874ff7f"
    );
}

#[test]
fn normalize_item_id_passes_through_long_form() {
    let long = "tag:google.com,2005:reader/item/00064e2e5874ff7f";
    assert_eq!(normalize_item_id(long), long);
}

#[test]
fn normalize_item_id_passes_through_non_numeric() {
    assert_eq!(normalize_item_id("some-other-id"), "some-other-id");
}

#[test]
fn normalize_item_id_handles_zero() {
    assert_eq!(
        normalize_item_id("0"),
        "tag:google.com,2005:reader/item/0000000000000000"
    );
}

#[tokio::test]
async fn edit_subscription_sends_rename_only_request() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let edit_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body(mockito::Matcher::AllOf(vec![
            mockito::Matcher::Regex("(^|&)ac=edit(&|$)".to_string()),
            mockito::Matcher::Regex(
                "(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string(),
            ),
            mockito::Matcher::Regex("(^|&)t=New%20Title(&|$)".to_string()),
        ]))
        .with_status(200)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    provider
        .edit_subscription("feed/http://example.com/rss", Some("New Title"), None, None)
        .await
        .unwrap();

    edit_mock.assert_async().await;
}

#[tokio::test]
async fn edit_subscription_sends_folder_move_with_add_and_remove_labels() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let edit_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body(mockito::Matcher::AllOf(vec![
            mockito::Matcher::Regex("(^|&)ac=edit(&|$)".to_string()),
            mockito::Matcher::Regex(
                "(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string(),
            ),
            mockito::Matcher::Regex("(^|&)a=user%2F-%2Flabel%2FNew(&|$)".to_string()),
            mockito::Matcher::Regex("(^|&)r=user%2F-%2Flabel%2FOld(&|$)".to_string()),
        ]))
        .with_status(200)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    provider
        .edit_subscription(
            "feed/http://example.com/rss",
            None,
            Some("New"),
            Some("Old"),
        )
        .await
        .unwrap();

    edit_mock.assert_async().await;
}

#[tokio::test]
async fn edit_subscription_maps_non_success_status_to_domain_error() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(500)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("p".into()),
            token: Some("u".into()),
        })
        .await
        .unwrap();

    let error = provider
        .edit_subscription("feed/http://example.com/rss", Some("New Title"), None, None)
        .await
        .expect_err("non-2xx subscription/edit response should map to a domain error");

    assert!(!matches!(error, DomainError::Validation(_)));
}
