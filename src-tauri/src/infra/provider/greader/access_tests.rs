use super::*;
use crate::infra::keyring_store::cloudflare_access::{
    CloudflareAccess, CLIENT_ID_HEADER, CLIENT_SECRET_HEADER,
};

fn access_provider(server: &mockito::Server) -> GReaderProvider {
    let origin = server.url().replacen("http://", "https://", 1);
    let access = CloudflareAccess::new("dummy-id", "cfast_dummy_secret", &origin).unwrap();
    let mut provider =
        GReaderProvider::try_for_freshrss_with_access(&origin, Some(access)).unwrap();
    provider.mock_http_transport = true;
    provider
}

fn authenticated_mock(mock: mockito::Mock) -> mockito::Mock {
    mock.match_header(CLIENT_ID_HEADER, "dummy-id")
        .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
        .match_header("authorization", "GoogleLogin auth=dummy-auth")
        .match_header("cache-control", "no-store")
}

async fn authenticate_access_provider(provider: &mut GReaderProvider) {
    provider
        .authenticate(&Credentials {
            token: Some("dummy-user".into()),
            password: Some("dummy-password".into()),
        })
        .await
        .expect("fake ClientLogin response should authenticate");
}

#[tokio::test]
async fn api_access_probe_authenticates_and_reads_tag_list_with_access_headers() {
    let mut server = mockito::Server::new_async().await;
    let login = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header(CLIENT_ID_HEADER, "dummy-id")
        .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
        .match_body("Email=dummy-user&Passwd=dummy-password")
        .with_body("Auth=dummy-auth\n")
        .create_async()
        .await;
    let tag_list = authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/tag/list"))
        .match_query("output=json")
        .with_header("content-type", "application/json")
        .with_body(r#"{"tags":[]}"#)
        .create_async()
        .await;
    let mut provider = access_provider(&server);

    authenticate_access_provider(&mut provider).await;
    provider
        .verify_api_access()
        .await
        .expect("valid protected tag-list response should pass the probe");

    login.assert_async().await;
    tag_list.assert_async().await;
}

#[tokio::test]
async fn api_access_probe_reports_only_endpoint_class_and_status_for_auth_failures() {
    for status in [401, 403] {
        let mut server = mockito::Server::new_async().await;
        let login = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_header(CLIENT_ID_HEADER, "dummy-id")
            .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
            .with_body("Auth=dummy-auth\n")
            .create_async()
            .await;
        let tag_list = authenticated_mock(
            server.mock("GET", "/api/greader.php/reader/api/0/tag/list"),
        )
        .match_query("output=json")
        .with_status(status)
        .with_body(
            "alice dummy-auth cfast_dummy_secret https://rss.example.com sensitive response body",
        )
        .create_async()
        .await;
        let mut provider = access_provider(&server);

        authenticate_access_provider(&mut provider).await;
        let error = provider
            .verify_api_access()
            .await
            .expect_err("protected read authorization failure should fail the probe");
        assert!(matches!(error, DomainError::Auth(_)));
        let message = error.to_string();
        assert!(message.contains("tag-list"));
        assert!(message.contains(&format!("HTTP {status}")));
        for sensitive_value in [
            "alice",
            "dummy-auth",
            "cfast_dummy_secret",
            "https://rss.example.com",
            "sensitive response body",
            "Cloudflare",
            "FreshRSS",
        ] {
            assert!(!message.contains(sensitive_value));
        }

        login.assert_async().await;
        tag_list.assert_async().await;
    }
}

#[tokio::test]
async fn api_access_probe_rejects_html_without_echoing_body() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header(CLIENT_ID_HEADER, "dummy-id")
        .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
        .with_body("Auth=dummy-auth\n")
        .create_async()
        .await;
    let tag_list = authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/tag/list"))
        .match_query("output=json")
        .with_header("content-type", "text/html")
        .with_body("<html>alice dummy-auth cfast_dummy_secret private page</html>")
        .create_async()
        .await;
    let mut provider = access_provider(&server);

    authenticate_access_provider(&mut provider).await;
    let error = provider
        .verify_api_access()
        .await
        .expect_err("HTML response must fail verification");
    assert!(matches!(error, DomainError::Auth(_)));
    assert!(error.to_string().contains("tag-list"));
    assert!(!error.to_string().contains("alice"));
    assert!(!error.to_string().contains("dummy-auth"));
    tag_list.assert_async().await;
}

#[tokio::test]
async fn api_access_probe_keeps_json_response_body_limit() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header(CLIENT_ID_HEADER, "dummy-id")
        .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
        .with_body("Auth=dummy-auth\n")
        .create_async()
        .await;
    let tag_list = authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/tag/list"))
        .match_query("output=json")
        .with_header("content-type", "application/json")
        .with_body(format!(
            r#"{{"tags":[],"padding":"{}"}}"#,
            "x".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize)
        ))
        .create_async()
        .await;
    let mut provider = access_provider(&server);

    authenticate_access_provider(&mut provider).await;
    let error = provider
        .verify_api_access()
        .await
        .expect_err("oversized protected response must fail within the shared cap");

    assert!(matches!(error, DomainError::Network(_)));
    assert_eq!(
        error.to_string(),
        format!(
            "Network error: GReader JSON response body exceeds {} bytes",
            http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
        )
    );
    tag_list.assert_async().await;
}

#[tokio::test]
async fn cloudflare_access_headers_cover_login_reads_mutations_and_subscriptions() {
    let mut server = mockito::Server::new_async().await;
    let login = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header(CLIENT_ID_HEADER, "dummy-id")
        .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
        .match_body("Email=dummy-user&Passwd=dummy-password")
        .with_body("Auth=dummy-auth\n")
        .create_async()
        .await;
    let subscriptions = authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/subscription/list"))
        .match_query(mockito::Matcher::Any)
        .with_body(r#"{"subscriptions":[{"id":"feed/1","title":"Feed","url":"https://feed.example/rss","htmlUrl":"https://feed.example","categories":[]}]}"#)
        .expect(2).create_async().await;
    let folders = authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/tag/list"))
        .match_query(mockito::Matcher::Any)
        .with_body(r#"{"tags":[]}"#)
        .create_async()
        .await;
    let stream = authenticated_mock(server.mock(
        "GET",
        "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
    ))
    .match_query(mockito::Matcher::Any)
    .with_body(r#"{"items":[]}"#)
    .create_async()
    .await;
    let edit_tag =
        authenticated_mock(server.mock("POST", "/api/greader.php/reader/api/0/edit-tag"))
            .with_body("OK")
            .expect(3)
            .create_async()
            .await;
    let edit_sub =
        authenticated_mock(server.mock("POST", "/api/greader.php/reader/api/0/subscription/edit"))
            .with_body("OK")
            .expect(2)
            .create_async()
            .await;
    let quickadd = authenticated_mock(server.mock(
        "POST",
        "/api/greader.php/reader/api/0/subscription/quickadd",
    ))
    .with_body("OK")
    .create_async()
    .await;
    let counts =
        authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/unread-count"))
            .match_query(mockito::Matcher::Any)
            .with_body(r#"{"unreadcounts":[]}"#)
            .create_async()
            .await;
    let ids =
        authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"))
            .match_query(mockito::Matcher::Any)
            .with_body(r#"{"itemRefs":[]}"#)
            .expect(2)
            .create_async()
            .await;
    let mut provider = access_provider(&server);
    assert!(provider
        .authenticate(&Credentials {
            token: Some("dummy-user".into()),
            password: Some("dummy-password".into())
        })
        .await
        .is_ok());
    assert_eq!(provider.get_subscriptions().await.unwrap().len(), 1);
    assert!(provider.get_folders().await.unwrap().is_empty());
    assert!(provider.fetch_unread_count_map().await.unwrap().is_empty());
    assert!(provider.pull_state().await.is_ok());
    assert!(provider
        .pull_entries(PullScope::All, None)
        .await
        .unwrap()
        .entries
        .is_empty());
    assert!(provider
        .push_mutations(&[
            Mutation::MarkRead {
                remote_entry_id: "1".into()
            },
            Mutation::MarkUnread {
                remote_entry_id: "1".into()
            },
            Mutation::SetStarred {
                remote_entry_id: "1".into(),
                starred: true
            },
        ])
        .await
        .is_ok());
    assert!(provider
        .delete_subscription(&FeedIdentifier::Remote {
            remote_id: "feed/1".into()
        })
        .await
        .is_ok());
    assert!(provider
        .edit_subscription("feed/1", Some("title"), Some("folder"), None)
        .await
        .is_ok());
    assert_eq!(
        provider
            .create_subscription("https://feed.example/rss", None)
            .await
            .unwrap()
            .remote_id,
        "feed/1"
    );
    for mock in [
        login,
        subscriptions,
        folders,
        stream,
        edit_tag,
        edit_sub,
        quickadd,
        counts,
        ids,
    ] {
        mock.assert_async().await;
    }
}

#[test]
fn cloudflare_access_request_builder_rejects_other_origins_and_downgrades() {
    let access =
        CloudflareAccess::new("dummy-id", "cfast_dummy_secret", "https://localhost:8443").unwrap();
    let mut provider =
        GReaderProvider::try_for_freshrss_with_access("https://localhost:8443", Some(access))
            .unwrap();
    for url in [
        "http://localhost:8443/reader",
        "https://localhost:9443/reader",
        "https://other.example/reader",
    ] {
        assert!(provider.request(reqwest::Method::GET, url).is_err());
        assert!(http::validate_access_redirect(
            Some("https://localhost:8443"),
            &reqwest::Url::parse(url).unwrap()
        )
        .is_err());
    }
    assert!(http::validate_access_redirect(
        Some("https://localhost:8443"),
        &reqwest::Url::parse("https://localhost:8443/path").unwrap()
    )
    .is_ok());
    provider.auth_token = Some("dummy-auth".into());
    let request = provider
        .request(reqwest::Method::GET, "https://localhost:8443/read")
        .unwrap()
        .header("authorization", provider.auth_header().unwrap())
        .build()
        .unwrap();
    assert!(request.headers()[CLIENT_SECRET_HEADER].is_sensitive());
    assert!(request.headers()["authorization"].is_sensitive());
    assert!(!format!("{provider:?} {request:?}").contains("cfast_dummy_secret"));
    let generic = http_defaults::http_client_builder()
        .build()
        .unwrap()
        .get("https://localhost/read")
        .build()
        .unwrap();
    assert!(!generic.headers().contains_key(CLIENT_ID_HEADER));
    assert!(!generic.headers().contains_key(CLIENT_SECRET_HEADER));
}

#[tokio::test]
async fn cloudflare_access_redirect_policy_blocks_before_custom_headers_reach_destination() {
    let mut first = mockito::Server::new_async().await;
    let mut second = mockito::Server::new_async().await;
    let redirect = first
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(307)
        .with_header("location", &format!("{}/capture", second.url()))
        .expect(2)
        .create_async()
        .await;
    let destination = second
        .mock("POST", "/capture")
        .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
        .with_body("Auth=dummy-auth\n")
        .expect(1)
        .create_async()
        .await;
    let mut provider = access_provider(&first);
    let credentials = Credentials {
        token: Some("dummy-user".into()),
        password: Some("dummy-password".into()),
    };
    let error = provider.authenticate(&credentials).await.unwrap_err();
    assert!(matches!(error, DomainError::Validation(_)));
    assert!(
        !destination.matched_async().await,
        "protected client must never reach redirected destination"
    );
    // Bounded fault injection: reqwest's ordinary redirect policy retains
    // these custom headers, even though the Secret header is sensitive.
    provider.http_client = Ok(http_defaults::http_client_builder().build().unwrap());
    assert!(provider.authenticate(&credentials).await.is_ok());
    destination.assert_async().await;
    redirect.assert_async().await;
}

#[tokio::test]
async fn cloudflare_access_missing_header_fault_is_detected() {
    let mut server = mockito::Server::new_async().await;
    let expected = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .match_header(CLIENT_ID_HEADER, "dummy-id")
        .match_header(CLIENT_SECRET_HEADER, "cfast_dummy_secret")
        .with_body("Auth=dummy-auth\n")
        .create_async()
        .await;
    let mut provider = access_provider(&server);
    provider.cloudflare_access = None;
    assert!(provider
        .authenticate(&Credentials {
            token: Some("dummy-user".into()),
            password: Some("dummy-password".into())
        })
        .await
        .is_err());
    assert!(
        !expected.matched_async().await,
        "missing Access headers must fail the transport contract"
    );
}

#[tokio::test]
async fn cloudflare_access_html_and_plain_401_403_are_bounded_generic_errors() {
    for (status, content_type, body) in [
        (
            200,
            "text/html",
            "<html>cfast_dummy_secret Auth=dummy-auth</html>",
        ),
        (
            200,
            "text/plain",
            "<!doctype html><html>cfast_dummy_secret</html>",
        ),
        (401, "text/plain", "FreshRSS or Access? cfast_dummy_secret"),
        (
            403,
            "text/html",
            "<html>Access denied cfast_dummy_secret</html>",
        ),
    ] {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(status)
            .with_header("content-type", content_type)
            .with_body(body)
            .create_async()
            .await;
        let mut provider = access_provider(&server);
        let error = provider
            .authenticate(&Credentials {
                token: Some("dummy-user".into()),
                password: Some("dummy-password".into()),
            })
            .await
            .unwrap_err();
        assert!(matches!(error, DomainError::Auth(_)));
        assert!(!error.to_string().contains("cfast_dummy_secret"));
        assert!(!error.to_string().contains("Invalid credentials"));
        assert!(error.to_string().contains("gateway"));
        mock.assert_async().await;
    }
}

#[tokio::test]
async fn cloudflare_access_html_is_rejected_for_reads_and_mutations_without_content_type() {
    let mut server = mockito::Server::new_async().await;
    let read = server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(mockito::Matcher::Any)
        .with_body("<html>Access Login</html>")
        .create_async()
        .await;
    let mutation = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .with_body("<html>Access Login</html>")
        .create_async()
        .await;
    let mut provider = access_provider(&server);
    provider.auth_token = Some("dummy-auth".into());
    assert!(matches!(
        provider.get_subscriptions().await,
        Err(DomainError::Auth(_))
    ));
    assert!(matches!(
        provider
            .push_mutations(&[Mutation::MarkRead {
                remote_entry_id: "1".into()
            }])
            .await,
        Err(DomainError::Auth(_))
    ));
    read.assert_async().await;
    mutation.assert_async().await;
}

#[tokio::test]
async fn cloudflare_access_html_error_status_preserves_retry_category() {
    let mut server = mockito::Server::new_async().await;
    let mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(429)
        .with_header("content-type", "text/html")
        .with_header("retry-after", "30")
        .with_body("<html>Rate limited cfast_dummy_secret</html>")
        .create_async()
        .await;
    let mut provider = access_provider(&server);
    let error = provider
        .authenticate(&Credentials {
            token: Some("dummy-user".into()),
            password: Some("dummy-password".into()),
        })
        .await
        .unwrap_err();
    assert!(matches!(
        error,
        DomainError::RateLimitWithRetryAfter {
            retry_after_seconds: 30,
            ..
        }
    ));
    assert!(!error.to_string().contains("cfast_dummy_secret"));
    mock.assert_async().await;
}
