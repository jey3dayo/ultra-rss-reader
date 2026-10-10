use super::*;
use crate::infra::keyring_store::cloudflare_access::{
    CloudflareAccess, CLIENT_ID_HEADER, CLIENT_SECRET_HEADER,
};

#[test]
fn safe_greader_failure_diagnostic_formats_only_allowlisted_values() {
    let endpoint_cases = [
        (
            "/tenant/alice/account-123/api/greader.php/accounts/ClientLogin",
            "client-login",
        ),
        (
            "/tenant/alice/account-123/api/greader.php/reader/api/0/tag/list",
            "tag-list",
        ),
        (
            "/tenant/alice/account-123/api/greader.php/reader/api/0/subscription/list",
            "subscriptions",
        ),
        (
            "/tenant/alice/account-123/api/greader.php/reader/api/0/stream/contents/user%2Fsecret",
            "stream-contents",
        ),
        (
            "/tenant/alice/account-123/api/greader.php/reader/api/0/stream/items/ids",
            "stream-items-ids",
        ),
        (
            "/tenant/alice/account-123/api/greader.php/reader/api/0/edit-tag",
            "edit-tag",
        ),
        (
            "/tenant/alice/account-123/api/greader.php/reader/api/0/unread-count",
            "unread-count",
        ),
        (
            "/tenant/alice/account-123/api/greader.php/reader/api/0/unknown",
            "api-other",
        ),
    ];

    for (path, endpoint) in endpoint_cases {
        assert_eq!(
            http::safe_greader_failure_diagnostic(
                path,
                403,
                http::SafeGReaderFailureReason::HttpAuth,
            ),
            format!("endpoint={endpoint} status=403 reason=http-auth")
        );
    }

    assert_eq!(
        http::safe_greader_failure_diagnostic(
            "/api/greader.php/reader/api/0/tag/list",
            200,
            http::SafeGReaderFailureReason::HtmlContentType,
        ),
        "endpoint=tag-list status=200 reason=html-content-type"
    );

    let url = reqwest::Url::parse(
        "https://host-secret.invalid/alice/account-123?query-secret#fragment-secret",
    )
    .expect("test URL should parse");
    let diagnostic = http::safe_greader_failure_diagnostic(
        url.path(),
        401,
        http::SafeGReaderFailureReason::HttpAuth,
    );
    for sensitive_value in [
        "https://",
        "host-secret",
        "alice",
        "account-123",
        "query-secret",
        "fragment-secret",
        "client-id",
        "secret",
        "header",
        "body",
        "raw error",
    ] {
        assert!(!diagnostic.contains(sensitive_value));
    }
}

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
async fn protected_article_ids_accept_expected_json_with_html_content_type() {
    for content_type in [
        "text/html",
        "Text/HTML; charset=UTF-8",
        "application/xhtml+xml",
    ] {
        let mut server = mockito::Server::new_async().await;
        let ids = authenticated_mock(
            server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"),
        )
        .match_query(mockito::Matcher::Any)
        .with_header("content-type", content_type)
        .with_body(r#"{"itemRefs":[{"id":"123"}],"continuation":"next-page"}"#)
        .create_async()
        .await;
        let mut provider = access_provider(&server);
        provider.auth_token = Some("dummy-auth".into());

        let page = provider
            .pull_item_ids_page(STATE_READING_LIST, None)
            .await
            .expect("expected article IDs JSON should parse despite an HTML MIME type");

        assert_eq!(
            page.item_refs
                .unwrap_or_default()
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            ["123"]
        );
        assert_eq!(page.continuation.as_deref(), Some("next-page"));
        ids.assert_async().await;
    }
}

#[tokio::test]
async fn protected_article_ids_reject_unknown_html_json_before_state_propagation() {
    for body in [
        r#"{"error":"access denied cfast_dummy_secret"}"#,
        r#"{}"#,
        r#"{"items":[]}"#,
        r#"{"itemRefs":null}"#,
        r#"{"itemRefs":{}}"#,
        r#"{"itemRefs":[],"error":"access denied"}"#,
        r#"{"itemRefs":[],"errors":[]}"#,
        r#"{"itemRefs":[],"metadata":{}}"#,
        r#"{"continuation":"next-page"}"#,
        r#"[]"#,
    ] {
        let mut server = mockito::Server::new_async().await;
        let ids = authenticated_mock(
            server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"),
        )
        .match_query(mockito::Matcher::Any)
        .with_header("content-type", "text/html")
        .with_body(body)
        .create_async()
        .await;
        let mut provider = access_provider(&server);
        provider.auth_token = Some("dummy-auth".into());

        let error = provider
            .pull_all_item_ids(STATE_READ)
            .await
            .expect_err("unknown HTML JSON must not propagate as an empty item ID snapshot");

        assert!(matches!(error, DomainError::Auth(_)));
        assert_eq!(
            error.to_string(),
            "Auth error: The API returned an HTML page. Check the server URL and any access gateway settings."
        );
        assert!(!error.to_string().contains("cfast_dummy_secret"));
        ids.assert_async().await;
    }
}

#[tokio::test]
async fn protected_article_ids_accept_empty_html_json_snapshot() {
    let mut server = mockito::Server::new_async().await;
    let ids =
        authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"))
            .match_query(mockito::Matcher::Any)
            .with_header("content-type", "text/html")
            .with_body(r#"{"itemRefs":[]}"#)
            .create_async()
            .await;
    let mut provider = access_provider(&server);
    provider.auth_token = Some("dummy-auth".into());

    let result = provider
        .pull_all_item_ids(STATE_READ)
        .await
        .expect("an explicit empty itemRefs array should remain a valid snapshot");
    assert!(result.is_empty());
    ids.assert_async().await;
}

#[tokio::test]
async fn other_protected_json_endpoints_reject_html_mime_with_valid_dtos() {
    for (path, body) in [
        ("/reader/api/0/tag/list", r#"{"tags":[]}"#),
        ("/reader/api/0/subscription/list", r#"{"subscriptions":[]}"#),
        ("/reader/api/0/unread-count", r#"{"unreadcounts":[]}"#),
    ] {
        let mut server = mockito::Server::new_async().await;
        let response =
            authenticated_mock(server.mock("GET", format!("/api/greader.php{path}").as_str()))
                .match_query(mockito::Matcher::Any)
                .with_header("content-type", "text/html")
                .with_body(body)
                .create_async()
                .await;
        let mut provider = access_provider(&server);
        provider.auth_token = Some("dummy-auth".into());

        let result = match path {
            "/reader/api/0/tag/list" => provider.get_folders().await.map(|_| ()),
            "/reader/api/0/subscription/list" => provider.get_subscriptions().await.map(|_| ()),
            _ => provider.get_unread_count_map().await.map(|_| ()),
        };
        let error = result.expect_err("HTML MIME compatibility must be limited to item IDs");
        assert!(matches!(error, DomainError::Auth(_)));
        assert_eq!(
            error.to_string(),
            "Auth error: The API returned an HTML page. Check the server URL and any access gateway settings."
        );
        response.assert_async().await;
    }
}

#[tokio::test]
async fn protected_article_ids_classify_invalid_json_by_content_type() {
    for content_type in ["text/html", "application/xhtml+xml", "application/json"] {
        for body in [
            "not JSON cfast_dummy_secret",
            r#"{"itemRefs":[{"id":123}]}"#,
            r#"{"itemRefs":[],"continuation":123}"#,
        ] {
            let mut server = mockito::Server::new_async().await;
            let ids = authenticated_mock(
                server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"),
            )
            .match_query(mockito::Matcher::Any)
            .with_header("content-type", content_type)
            .with_body(body)
            .create_async()
            .await;
            let mut provider = access_provider(&server);
            provider.auth_token = Some("dummy-auth".into());

            let error = match provider.pull_item_ids_page(STATE_READING_LIST, None).await {
                Err(error) => error,
                Ok(_) => panic!("invalid article IDs JSON must fail expected DTO parsing"),
            };
            if content_type == "application/json" {
                assert!(matches!(error, DomainError::Parse(_)));
                assert_eq!(
                    error.to_string(),
                    "Parse error: Invalid GReader JSON response"
                );
            } else {
                assert!(matches!(error, DomainError::Auth(_)));
                assert_eq!(
                    error.to_string(),
                    "Auth error: The API returned an HTML page. Check the server URL and any access gateway settings."
                );
            }
            assert!(!error.to_string().contains("cfast_dummy_secret"));
            ids.assert_async().await;
        }
    }
}

#[tokio::test]
async fn protected_article_ids_keep_normal_json_metadata_compatibility() {
    let mut server = mockito::Server::new_async().await;
    let ids =
        authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"))
            .match_query(mockito::Matcher::Any)
            .with_header("content-type", "application/json")
            .with_body(r#"{"itemRefs":[{"id":"123"}],"metadata":{}}"#)
            .create_async()
            .await;
    let mut provider = access_provider(&server);
    provider.auth_token = Some("dummy-auth".into());

    let result = provider
        .pull_all_item_ids(STATE_READ)
        .await
        .expect("normal JSON should retain the existing DTO's metadata compatibility");
    assert_eq!(result, ["tag:google.com,2005:reader/item/000000000000007b"]);
    ids.assert_async().await;
}

#[tokio::test]
async fn protected_article_ids_reject_html_prefixes_and_auth_statuses() {
    for (status, content_type, body) in [
        (200, "text/html", "<html>cfast_dummy_secret</html>"),
        (
            200,
            "application/json",
            "\u{feff} \n<!DOCTYPE HTML><html>private page</html>",
        ),
        (401, "text/html", r#"{"itemRefs":[{"id":"123"}]}"#),
        (403, "text/html", r#"{"itemRefs":[{"id":"123"}]}"#),
    ] {
        let mut server = mockito::Server::new_async().await;
        let ids = authenticated_mock(
            server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"),
        )
        .match_query(mockito::Matcher::Any)
        .with_status(status)
        .with_header("content-type", content_type)
        .with_body(body)
        .create_async()
        .await;
        let mut provider = access_provider(&server);
        provider.auth_token = Some("dummy-auth".into());

        let error = match provider.pull_item_ids_page(STATE_READING_LIST, None).await {
            Err(error) => error,
            Ok(_) => panic!("HTML pages and HTTP auth statuses must reject article IDs"),
        };
        assert!(matches!(error, DomainError::Auth(_)));
        if status == 200 {
            assert!(error.to_string().contains("returned an HTML page"));
        } else {
            assert!(error.to_string().contains(&format!("HTTP {status}")));
        }
        assert!(!error.to_string().contains("cfast_dummy_secret"));
        ids.assert_async().await;
    }
}

#[tokio::test]
async fn protected_article_ids_keep_body_cap_with_html_content_type() {
    let mut server = mockito::Server::new_async().await;
    let ids =
        authenticated_mock(server.mock("GET", "/api/greader.php/reader/api/0/stream/items/ids"))
            .match_query(mockito::Matcher::Any)
            .with_header("content-type", "text/html")
            .with_body(format!(
                r#"{{"itemRefs":[],"padding":"{}"}}"#,
                "x".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize)
            ))
            .create_async()
            .await;
    let mut provider = access_provider(&server);
    provider.auth_token = Some("dummy-auth".into());

    let error = match provider.pull_item_ids_page(STATE_READING_LIST, None).await {
        Err(error) => error,
        Ok(_) => panic!("oversized article IDs JSON must fail within the shared cap"),
    };
    assert!(matches!(error, DomainError::Network(_)));
    assert_eq!(
        error.to_string(),
        format!(
            "Network error: GReader JSON response body exceeds {} bytes",
            http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
        )
    );
    ids.assert_async().await;
}

#[tokio::test]
async fn cloudflare_access_html_text_compatibility_is_limited_to_edit_tag_ok() {
    for (content_type, body) in [("text/html", "OK"), ("application/xhtml+xml", " \tOK\r\n")] {
        let mut server = mockito::Server::new_async().await;
        let login = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_header("content-type", content_type)
            .with_body("Auth=dummy-auth\n")
            .create_async()
            .await;
        let mutation =
            authenticated_mock(server.mock("POST", "/api/greader.php/reader/api/0/edit-tag"))
                .with_header("content-type", content_type)
                .with_body(body)
                .create_async()
                .await;
        let mut provider = access_provider(&server);
        let login_error = provider
            .authenticate(&Credentials {
                token: Some("dummy-user".into()),
                password: Some("dummy-password".into()),
            })
            .await
            .expect_err("HTML MIME must still reject a valid ClientLogin text body");
        assert!(matches!(login_error, DomainError::Auth(_)));
        assert!(provider.auth_token.is_none());

        provider.auth_token = Some("dummy-auth".into());
        let mutation_result = provider
            .push_mutations(&[Mutation::MarkRead {
                remote_entry_id: "123".into(),
            }])
            .await;
        assert!(
            mutation_result.is_ok(),
            "edit-tag OK should accept HTML MIME"
        );
        login.assert_async().await;
        mutation.assert_async().await;
    }
}

#[tokio::test]
async fn edit_tag_html_mime_rejects_non_ok_bodies_and_auth_statuses() {
    for (status, body) in [
        (200, b"".as_slice()),
        (200, b" \n".as_slice()),
        (200, b"ERROR".as_slice()),
        (200, b"OK ERROR".as_slice()),
        (200, b"ok".as_slice()),
        (200, b"<html>secret-sentinel</html>".as_slice()),
        (200, b"\xff".as_slice()),
        (401, b"OK".as_slice()),
        (403, b"OK".as_slice()),
    ] {
        let mut server = mockito::Server::new_async().await;
        let mutation =
            authenticated_mock(server.mock("POST", "/api/greader.php/reader/api/0/edit-tag"))
                .with_status(status)
                .with_header("content-type", "text/html")
                .with_body(body)
                .create_async()
                .await;
        let mut provider = access_provider(&server);
        provider.auth_token = Some("dummy-auth".into());
        let error = provider
            .push_mutations(&[Mutation::MarkRead {
                remote_entry_id: "entry-secret-sentinel".into(),
            }])
            .await
            .expect_err("edit-tag HTML MIME must accept only successful exact OK");
        assert!(
            matches!(error, DomainError::Auth(_)),
            "status={status} error={error}"
        );
        mutation.assert_async().await;
    }
}

#[tokio::test]
async fn edit_tag_html_ok_compatibility_keeps_decoded_body_cap() {
    let mut server = mockito::Server::new_async().await;
    let mutation =
        authenticated_mock(server.mock("POST", "/api/greader.php/reader/api/0/edit-tag"))
            .with_header("content-type", "text/html")
            .with_body(format!(
                "{}OK",
                " ".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize)
            ))
            .create_async()
            .await;
    let mut provider = access_provider(&server);
    provider.auth_token = Some("dummy-auth".into());
    let error = provider
        .push_mutations(&[Mutation::MarkRead {
            remote_entry_id: "123".into(),
        }])
        .await
        .expect_err("whitespace surrounding OK must not bypass the response cap");
    assert!(matches!(error, DomainError::Network(_)));
    assert!(error.to_string().contains("response body exceeds"));
    mutation.assert_async().await;
}

#[tokio::test]
async fn html_ok_compatibility_does_not_apply_to_other_text_paths() {
    for path in [
        "/accounts/ClientLogin",
        "/reader/api/0/subscription/edit",
        "/reader/api/0/token",
        "/reader/api/0/edit-tag-extra",
    ] {
        let mut server = mockito::Server::new_async().await;
        let response = server
            .mock("GET", path)
            .with_header("content-type", "text/html")
            .with_body("OK")
            .create_async()
            .await;
        let raw = reqwest::Client::new()
            .get(format!("{}{path}", server.url()))
            .send()
            .await
            .expect("local response fixture should start");
        let error = GReaderProvider::read_text_response(raw)
            .await
            .expect_err("HTML OK compatibility must remain scoped to edit-tag");
        assert!(matches!(error, DomainError::Auth(_)), "path={path}");
        response.assert_async().await;
    }
}

#[tokio::test]
async fn normal_text_response_bytes_are_preserved() {
    for body in ["", "ERROR", " \tOK\r\n", "Auth=dummy-auth\n"] {
        let mut server = mockito::Server::new_async().await;
        let response = server
            .mock("GET", "/reader/api/0/edit-tag")
            .with_header("content-type", "text/plain")
            .with_body(body)
            .create_async()
            .await;
        let raw = reqwest::Client::new()
            .get(format!("{}/reader/api/0/edit-tag", server.url()))
            .send()
            .await
            .expect("local response fixture should start");
        let result = GReaderProvider::read_text_response(raw)
            .await
            .expect("normal text response behavior should remain unchanged");
        assert_eq!(result, body);
        response.assert_async().await;
    }
}

#[tokio::test]
async fn body_cap_logs_distinguish_stream_endpoints_without_sensitive_values() {
    use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};
    use std::io::Write;

    if let Some(scenario) = child_scenario() {
        let mut server = mockito::Server::new_async().await;
        let (path, content_type, status) = match scenario.as_str() {
            "contents" => (
                "/tenant/username-secret-sentinel/reader/api/0/stream/contents/feed%2Fid-secret-sentinel",
                "application/json",
                200,
            ),
            "ids-gzip" => (
                "/tenant/username-secret-sentinel/reader/api/0/stream/items/ids",
                "text/html",
                206,
            ),
            _ => panic!("unexpected body-cap diagnostic scenario"),
        };
        let body = format!(
            r#"{{"body-secret-sentinel":"{}"}}"#,
            "x".repeat(http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize)
        );
        let response = server
            .mock("GET", path)
            .match_query(mockito::Matcher::Any)
            .with_status(status)
            .with_header("content-type", content_type);
        let response = if scenario == "ids-gzip" {
            let mut encoder =
                flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
            encoder
                .write_all(body.as_bytes())
                .expect("gzip diagnostic fixture should encode");
            let compressed = encoder
                .finish()
                .expect("gzip diagnostic fixture should finish");
            assert!(compressed.len() < http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES as usize);
            response
                .with_header("content-encoding", "gzip")
                .with_body(compressed)
        } else {
            response.with_body(body)
        }
        .create_async()
        .await;
        let raw = reqwest::Client::new()
            .get(format!("{}{path}?i=query-id-secret-sentinel", server.url()))
            .header("Authorization", "token-secret-sentinel")
            .header(CLIENT_ID_HEADER, "client-id-secret-sentinel")
            .header(CLIENT_SECRET_HEADER, "access-secret-sentinel")
            .send()
            .await
            .expect("local body-cap diagnostic fixture should start");
        let error = GReaderProvider::read_json_response::<serde_json::Value>(raw)
            .await
            .expect_err("oversized stream response must preserve the network cap error");
        assert!(matches!(error, DomainError::Network(_)));
        assert_eq!(
            error.to_string(),
            http::greader_json_body_too_large_error().to_string()
        );
        response.assert_async().await;
        return;
    }

    for (scenario, endpoint, status) in [
        ("contents", "stream-contents", 200),
        ("ids-gzip", "stream-items-ids", 206),
    ] {
        let lines = run_in_isolated_process(
            module_path!(),
            "body_cap_logs_distinguish_stream_endpoints_without_sensitive_values",
            scenario,
        );
        for sentinel in [
            "body-secret-sentinel",
            "username-secret-sentinel",
            "id-secret-sentinel",
            "query-id-secret-sentinel",
            "token-secret-sentinel",
            "client-id-secret-sentinel",
            "access-secret-sentinel",
            "http://",
            "Network error",
        ] {
            assert!(lines.iter().all(|line| !line.contains(sentinel)));
        }
        assert_eq!(
            lines,
            [format!(
                "endpoint={endpoint} status={status} reason=body-cap limit_bytes={}",
                http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
            )],
            "body-cap rejection should emit only the safe diagnostic"
        );
    }
}

#[tokio::test]
async fn html_rejection_logs_distinguish_mime_and_body_without_sensitive_values() {
    use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};
    if let Some(scenario) = child_scenario() {
        let mut server = mockito::Server::new_async().await;
        let (path, content_type, body) = match scenario.as_str() {
            "mime" => (
                "/reader/api/0/unread-count",
                "text/html",
                "body-secret-sentinel",
            ),
            "json-body" => (
                "/reader/api/0/unread-count",
                "application/json",
                "\u{feff} \n<!DOCTYPE HTML><html>body-secret-sentinel</html>",
            ),
            "edit-body" => (
                "/reader/api/0/edit-tag",
                "text/html",
                "<html>body-secret-sentinel</html>",
            ),
            _ => panic!("unexpected diagnostic scenario"),
        };
        let response = server
            .mock("GET", path)
            .with_header("content-type", content_type)
            .with_body(body)
            .create_async()
            .await;
        let raw = reqwest::Client::new()
            .get(format!("{}{path}", server.url()))
            .header("Authorization", "token-secret-sentinel")
            .header(CLIENT_SECRET_HEADER, "access-secret-sentinel")
            .send()
            .await
            .expect("local diagnostic fixture should start");
        let result = if path.ends_with("edit-tag") {
            GReaderProvider::read_text_response(raw).await.map(|_| ())
        } else {
            GReaderProvider::read_json_response::<stream_types::UnreadCountsResponse>(raw)
                .await
                .map(|_| ())
        };
        assert!(matches!(result, Err(DomainError::Auth(_))));
        response.assert_async().await;
        return;
    }
    for (scenario, endpoint, reason) in [
        ("mime", "unread-count", "html-content-type"),
        ("json-body", "unread-count", "html-body"),
        ("edit-body", "edit-tag", "html-body"),
    ] {
        let lines = run_in_isolated_process(
            module_path!(),
            "html_rejection_logs_distinguish_mime_and_body_without_sensitive_values",
            scenario,
        );
        assert_eq!(
            lines,
            [format!("endpoint={endpoint} status=200 reason={reason}")]
        );
        for sentinel in [
            "body-secret-sentinel",
            "token-secret-sentinel",
            "access-secret-sentinel",
            "http://",
            "Authorization",
        ] {
            assert!(lines.iter().all(|line| !line.contains(sentinel)));
        }
    }
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
        assert_eq!(
            message,
            format!(
                "Auth error: tag-list HTTP {status} {}",
                if status == 401 {
                    "Unauthorized"
                } else {
                    "Forbidden"
                }
            )
        );
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
    assert_eq!(
        error.to_string(),
        "Auth error: tag-list returned an HTML page"
    );
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
    let read_error = provider
        .get_subscriptions()
        .await
        .expect_err("HTML response prefix should remain an authentication error");
    assert!(matches!(read_error, DomainError::Auth(_)));
    assert_eq!(
        read_error.to_string(),
        "Auth error: The API returned an HTML page. Check the server URL and any access gateway settings."
    );
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
