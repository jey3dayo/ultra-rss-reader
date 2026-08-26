use crate::domain::url_policy::PRIVATE_URL_VALIDATION_MESSAGE;

use super::check_browser_embed_support;
use super::check_browser_embed_support_for_url;
use super::{
    acquire_browser_open_queue_guard_from, article_command_pagination,
    background_browser_open_failure_message, background_browser_open_status_failure_message,
    bulk_mark_account_read, bulk_mark_account_starred_read, bulk_mark_old_unread_read,
    bulk_unstar_account_articles, collect_old_unread_rows, has_blocking_frame_ancestors,
    has_blocking_x_frame_options, mark_article_read_with_conn, mark_articles_read_with_conn,
    mark_feed_read_with_conn, mark_folder_read_with_conn, maybe_queue_mutation,
    native_browser_open_failure_message, old_unread_before_from_now,
    open_browser_in_background_with_command, parse_article_list_mode,
    provider_supports_pending_article_mutations, recalculate_bulk_feed_unread_counts,
    record_article_view_with_conn, repair_outdated_articles_for_render,
    should_use_background_browser_open, supports_remote_mutations, toggle_article_star_with_conn,
    validate_browser_embed_redirect, validate_feed_article_filters, validate_older_than_days,
    BrowserOpenQueueKey, BulkArticleMutationRow, OldUnreadScope, ARTICLE_SEARCH_QUERY_MAX_CHARS,
    BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT, DEFAULT_ARTICLE_LIST_LIMIT,
    DEFAULT_RECENT_ARTICLE_LIST_LIMIT, DOWNGRADE_REDIRECT_VALIDATION_MESSAGE,
    MAX_ARTICLE_COMMAND_LIST_LIMIT, MAX_ARTICLE_COMMAND_LIST_OFFSET,
};
use super::{cleanup_feed_integrity_orphans_inner, get_feed_integrity_report_inner};
use crate::commands::dto::AppError;
use crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR;
use crate::domain::constants::ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE;
use crate::domain::error::DomainError;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::sanitizer;
use crate::platform::{platform_info_for_kind, PlatformKind};
use crate::repository::article::{ArticleListMode, ArticleReadRepository, Pagination};
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{PendingMutationRepository, PendingMutationType};
use mockito::Server;
use reqwest::header::{
    HeaderMap, HeaderName, HeaderValue, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS,
};
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

fn test_http_url(url: String) -> reqwest::Url {
    reqwest::Url::parse(&url).expect("test server URL should parse")
}

async fn stalled_http_url(path: &str) -> String {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("stalled server should bind");
    let addr = listener
        .local_addr()
        .expect("stalled server should expose local address");
    tokio::spawn(async move {
        if let Ok((socket, _)) = listener.accept().await {
            let mut request_buffer = [0_u8; 1024];
            let _ = socket.readable().await;
            let _ = socket.try_read(&mut request_buffer);
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    });

    format!("http://{addr}{path}")
}

#[test]
fn backend_article_search_query_normalization_collapses_whitespace_and_caps_length() {
    let query = format!("　Ｒｕｓｔ\t\t検索\nemoji😀  が {}", "長".repeat(150));
    let normalized = super::normalize_backend_article_search_query(&query);

    assert_eq!(normalized.chars().count(), ARTICLE_SEARCH_QUERY_MAX_CHARS);
    assert!(normalized.starts_with("Rust 検索 emoji😀 が 長"));
    assert!(!normalized.contains('　'));
    assert!(!normalized.contains('\n'));
    assert!(!normalized.contains('\t'));
    assert!(!normalized.contains("が"));
}

async fn head_rejected_then_stalled_get_url(path: &str) -> String {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("fallback server should bind");
    let addr = listener
        .local_addr()
        .expect("fallback server should expose local address");
    tokio::spawn(async move {
        if let Ok((mut head_socket, _)) = listener.accept().await {
            let mut request_buffer = [0_u8; 1024];
            let _ = head_socket.readable().await;
            let _ = head_socket.try_read(&mut request_buffer);
            let _ = head_socket
                .write_all(b"HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
                .await;
        }

        if let Ok((get_socket, _)) = listener.accept().await {
            let mut request_buffer = [0_u8; 1024];
            let _ = get_socket.readable().await;
            let _ = get_socket.try_read(&mut request_buffer);
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    });

    format!("http://{addr}{path}")
}

#[test]
fn x_frame_options_blocks_embedding() {
    let mut headers = HeaderMap::new();
    headers.insert(X_FRAME_OPTIONS, HeaderValue::from_static("SAMEORIGIN"));

    assert!(has_blocking_x_frame_options(&headers));
}

#[test]
fn frame_ancestors_wildcard_does_not_block_embedding() {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'self'; frame-ancestors *"),
    );

    assert!(!has_blocking_frame_ancestors(&headers));
}

#[test]
fn frame_ancestors_self_blocks_embedding() {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'self'; frame-ancestors 'self' https://example.com"),
    );

    assert!(has_blocking_frame_ancestors(&headers));
}

#[test]
fn frame_ancestors_parser_handles_case_quotes_and_header_policy_fixtures() {
    struct FrameAncestorsFixture {
        name: &'static str,
        enforced_policies: &'static [&'static str],
        report_only_policies: &'static [&'static str],
        blocks_embedding: bool,
    }

    let report_only_header = HeaderName::from_static("content-security-policy-report-only");
    let fixtures = [
        FrameAncestorsFixture {
            name: "mixed-case directive blocks like lowercase frame-ancestors",
            enforced_policies: &["default-src 'self'; FRAME-ANCESTORS 'self'"],
            report_only_policies: &[],
            blocks_embedding: true,
        },
        FrameAncestorsFixture {
            name: "double-quoted wildcard keeps embedding available",
            enforced_policies: &["default-src 'self'; frame-ancestors \"*\""],
            report_only_policies: &[],
            blocks_embedding: false,
        },
        FrameAncestorsFixture {
            name: "single-quoted wildcard keeps embedding available",
            enforced_policies: &["default-src 'self'; frame-ancestors '*'"],
            report_only_policies: &[],
            blocks_embedding: false,
        },
        FrameAncestorsFixture {
            name: "blocking policy wins across multiple enforced CSP headers",
            enforced_policies: &["default-src 'self'", "frame-ancestors https://example.com"],
            report_only_policies: &[],
            blocks_embedding: true,
        },
        FrameAncestorsFixture {
            name: "report-only frame-ancestors does not block embedding",
            enforced_policies: &["default-src 'self'"],
            report_only_policies: &["frame-ancestors 'none'"],
            blocks_embedding: false,
        },
    ];

    for fixture in fixtures {
        let mut headers = HeaderMap::new();
        for policy in fixture.enforced_policies {
            headers.append(CONTENT_SECURITY_POLICY, HeaderValue::from_static(policy));
        }
        for policy in fixture.report_only_policies {
            headers.append(report_only_header.clone(), HeaderValue::from_static(policy));
        }

        assert_eq!(
            has_blocking_frame_ancestors(&headers),
            fixture.blocks_embedding,
            "{}",
            fixture.name
        );
    }
}

#[tokio::test]
async fn embed_support_uses_get_response_headers() {
    let mut server = Server::new_async().await;
    let _mock = server
        .mock("GET", "/article")
        .with_status(200)
        .with_header("x-frame-options", "SAMEORIGIN")
        .create_async()
        .await;

    let supported = check_browser_embed_support_for_url(
        test_http_url(format!("{}/article", server.url())),
        BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        &[],
    )
    .await
    .expect("embed check should succeed");

    assert!(!supported);
}

#[tokio::test]
async fn embed_support_falls_back_to_get_when_head_is_rejected() {
    let mut server = Server::new_async().await;
    let head_mock = server
        .mock("HEAD", "/article")
        .with_status(405)
        .with_header("x-frame-options", "SAMEORIGIN")
        .create_async()
        .await;
    let get_mock = server
        .mock("GET", "/article")
        .with_status(200)
        .create_async()
        .await;

    let supported = check_browser_embed_support_for_url(
        test_http_url(format!("{}/article", server.url())),
        BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        &[],
    )
    .await
    .expect("embed check should fall back to GET");

    assert!(supported);
    head_mock.assert_async().await;
    get_mock.assert_async().await;
}

#[tokio::test]
async fn embed_support_rejects_non_success_get_responses_after_head_fallback() {
    for status in [403, 404, 500] {
        let mut server = Server::new_async().await;
        let head_mock = server
            .mock("HEAD", "/article")
            .with_status(405)
            .create_async()
            .await;
        let get_mock = server
            .mock("GET", "/article")
            .with_status(status)
            .create_async()
            .await;

        let supported = check_browser_embed_support_for_url(
            test_http_url(format!("{}/article", server.url())),
            BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
            &[],
        )
        .await
        .expect("embed check should resolve non-success GET responses");

        assert!(!supported, "GET {status} should not be embeddable");
        head_mock.assert_async().await;
        get_mock.assert_async().await;
    }
}

#[tokio::test]
async fn embed_support_keeps_success_get_response_policy_after_head_fallback() {
    let mut server = Server::new_async().await;
    let head_mock = server
        .mock("HEAD", "/article")
        .with_status(405)
        .with_header("x-frame-options", "SAMEORIGIN")
        .create_async()
        .await;
    let get_mock = server
        .mock("GET", "/article")
        .with_status(204)
        .create_async()
        .await;

    let supported = check_browser_embed_support_for_url(
        test_http_url(format!("{}/article", server.url())),
        BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        &[],
    )
    .await
    .expect("embed check should accept success GET responses");

    assert!(supported);
    head_mock.assert_async().await;
    get_mock.assert_async().await;
}

#[tokio::test]
async fn embed_support_surfaces_head_request_timeout() {
    let error = check_browser_embed_support_for_url(
        test_http_url(stalled_http_url("/article").await),
        Duration::from_millis(20),
        &[],
    )
    .await
    .expect_err("stalled HEAD response should time out");

    assert!(matches!(
        error,
        AppError::Retryable { ref message }
            | AppError::RetryableWithMetadata { ref message, .. }
            if message == "Network error: Request timed out. Check the server URL or your network connection."
    ));
}

#[tokio::test]
async fn embed_support_surfaces_get_fallback_timeout() {
    let error = check_browser_embed_support_for_url(
        test_http_url(head_rejected_then_stalled_get_url("/article").await),
        Duration::from_millis(20),
        &[],
    )
    .await
    .expect_err("stalled GET fallback response should time out");

    assert!(matches!(
        error,
        AppError::Retryable { ref message }
            | AppError::RetryableWithMetadata { ref message, .. }
            if message == "Network error: Request timed out. Check the server URL or your network connection."
    ));
}

#[tokio::test]
async fn embed_support_rejects_non_http_urls_before_requesting() {
    for url in [
        "mailto:hello@example.com",
        "file:///tmp/article.html",
        "javascript:alert(1)",
        "localhost:1420",
    ] {
        let error = check_browser_embed_support(url.to_string())
            .await
            .expect_err("non-http URLs should use the browser URL validation contract");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message == "Only http:// and https:// URLs are supported"
        ));
    }
}

#[tokio::test]
async fn embed_support_rejects_private_hosts_before_requesting() {
    for url in [
        "http://LOCALHOST./article",
        "http://127.0.0.1/article",
        "http://[fe80::1]/article",
        "http://[::ffff:7f00:1]/article",
    ] {
        let error = check_browser_embed_support(url.to_string())
            .await
            .expect_err("private browser embed URL should be rejected before request");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }
}

#[tokio::test]
async fn check_browser_embed_support_rejects_host_that_resolves_to_private_ip() {
    let error = check_browser_embed_support("http://private.test.invalid/x".to_string())
        .await
        .expect_err("host resolving to a private IP should be rejected before request");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message }
            if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn embed_support_redirect_policy_rejects_private_redirect_targets() {
    let previous = reqwest::Url::parse("https://example.com/article")
        .expect("public previous URL should parse");

    for next in [
        "https://LOCALHOST./article",
        "https://127.0.0.1/article",
        "https://169.254.169.254/article",
        "https://[fe80::1]/article",
        "https://[::ffff:7f00:1]/article",
    ] {
        let next_url = reqwest::Url::parse(next).expect("redirect target should parse");
        let error = validate_browser_embed_redirect(std::slice::from_ref(&previous), &next_url)
            .expect_err("private browser embed redirect should be rejected");

        assert!(matches!(
            error,
            DomainError::Validation(ref message)
                if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }
}

#[test]
fn validate_browser_embed_redirect_rejects_host_that_resolves_to_private_ip() {
    let previous = reqwest::Url::parse("https://example.com/article")
        .expect("public previous URL should parse");
    let next = reqwest::Url::parse("https://private.test.invalid/x")
        .expect("redirect target should parse");

    let error = validate_browser_embed_redirect(std::slice::from_ref(&previous), &next)
        .expect_err("redirect to a host resolving to a private IP should be rejected");

    assert!(matches!(
        error,
        DomainError::Validation(ref message)
            if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn validate_browser_embed_redirect_allows_host_that_resolves_to_public_ip() {
    let previous = reqwest::Url::parse("https://example.com/article")
        .expect("public previous URL should parse");
    let next = reqwest::Url::parse("https://public.test.invalid/article")
        .expect("public redirect target should parse");

    assert!(validate_browser_embed_redirect(std::slice::from_ref(&previous), &next).is_ok());
}

#[tokio::test]
async fn embed_support_http_client_rejects_private_redirect_targets() {
    let mut server = Server::new_async().await;
    let redirect = server
        .mock("HEAD", "/article")
        .with_status(302)
        .with_header("location", "http://127.0.0.1/private")
        .create_async()
        .await;

    let error = check_browser_embed_support_for_url(
        test_http_url(format!("{}/article", server.url())),
        BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        &[],
    )
    .await
    .expect_err("private browser embed redirect should fail");

    assert!(matches!(
        error,
        AppError::Retryable { .. } | AppError::RetryableWithMetadata { .. }
    ));
    redirect.assert_async().await;
}

#[tokio::test]
async fn check_browser_embed_support_for_url_pins_resolved_addresses_when_provided() {
    let mut server = Server::new_async().await;
    let head_mock = server
        .mock("HEAD", "/article")
        .with_status(200)
        .create_async()
        .await;
    let mock_addr: std::net::SocketAddr = server
        .host_with_port()
        .parse()
        .expect("mockito host should parse to a socket address");
    let port = mock_addr.port();

    // Use a domain host so resolve_to_addrs actually overrides resolution:
    // example.com never resolves to loopback, so reaching the mock server
    // proves the pinned addresses drove the connection.
    let supported = check_browser_embed_support_for_url(
        test_http_url(format!("http://example.com:{port}/article")),
        BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        std::slice::from_ref(&mock_addr),
    )
    .await
    .expect("pinned embed check should reach the mock server");

    assert!(supported);
    head_mock.assert_async().await;
}

#[test]
fn embed_support_redirect_policy_rejects_https_to_http_downgrade() {
    let previous = reqwest::Url::parse("https://example.com/article")
        .expect("public previous URL should parse");
    let next =
        reqwest::Url::parse("http://example.com/article").expect("downgrade target should parse");

    let error = validate_browser_embed_redirect(&[previous], &next)
        .expect_err("HTTPS to HTTP browser embed redirect should be rejected");

    assert!(matches!(
        error,
        DomainError::Validation(ref message)
            if message == DOWNGRADE_REDIRECT_VALIDATION_MESSAGE
    ));
}

#[test]
fn embed_support_redirect_policy_allows_http_to_https_upgrade() {
    let previous = reqwest::Url::parse("http://example.com/article")
        .expect("public previous URL should parse");
    let next =
        reqwest::Url::parse("https://example.com/article").expect("upgrade target should parse");

    assert!(validate_browser_embed_redirect(&[previous], &next).is_ok());
}

#[test]
fn embed_support_redirect_policy_limits_looping_redirect_chains() {
    let next = reqwest::Url::parse("https://example.com/article")
        .expect("public redirect target should parse");
    let previous = (0..6)
        .map(|index| {
            reqwest::Url::parse(&format!("https://example.com/article/{index}"))
                .expect("public previous URL should parse")
        })
        .collect::<Vec<_>>();

    assert!(validate_browser_embed_redirect(&previous, &next).is_ok());
    assert!(previous.len() > 5, "redirect policy rejects this hop count");
}

#[test]
fn open_in_browser_rejects_non_http_urls_before_native_opener() {
    for url in [
        "mailto:hello@example.com",
        "file:///tmp/article.html",
        "javascript:alert(1)",
        "localhost:1420",
        "https://user:pass@example.com/article",
    ] {
        let error = super::open_in_browser(url.to_string(), Some(true))
            .expect_err("browser open should validate URL scheme before native opener");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message == "Only http:// and https:// URLs are supported"
        ));
    }
}

#[test]
fn open_in_browser_rejects_private_hosts_before_native_opener() {
    for url in [
        "http://LOCALHOST./article",
        "http://127.0.0.1/article",
        "http://[fe80::1]/article",
        "http://[::ffff:7f00:1]/article",
    ] {
        let error = super::open_in_browser(url.to_string(), Some(true))
            .expect_err("private browser open URL should be rejected before native opener");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }
}

#[test]
fn browser_open_queue_deduplicates_same_url_until_guard_drops() {
    let queue = Box::leak(Box::new(Mutex::new(std::collections::HashSet::new())));
    let key = BrowserOpenQueueKey {
        url: "https://example.com/article".to_string(),
    };

    let first = acquire_browser_open_queue_guard_from(queue, key.clone())
        .expect("queue lock should be available")
        .expect("first open should acquire queue slot");
    let duplicate = acquire_browser_open_queue_guard_from(queue, key.clone())
        .expect("queue lock should be available");

    assert!(duplicate.is_none());

    let menu_shortcut_race = acquire_browser_open_queue_guard_from(
        queue,
        BrowserOpenQueueKey {
            url: key.url.clone(),
        },
    )
    .expect("queue lock should be available");

    assert!(menu_shortcut_race.is_none());
    drop(first);

    let after_release =
        acquire_browser_open_queue_guard_from(queue, key).expect("queue lock should be available");

    assert!(after_release.is_some());
}

#[test]
fn background_open_is_used_only_when_requested_and_supported() {
    let info = platform_info_for_kind(PlatformKind::Macos);

    assert!(should_use_background_browser_open(true, &info));
    assert!(!should_use_background_browser_open(false, &info));
}

#[test]
fn unsupported_platform_falls_back_to_normal_open() {
    let info = platform_info_for_kind(PlatformKind::Windows);

    assert!(!should_use_background_browser_open(true, &info));
}

#[test]
fn background_open_contract_follows_platform_info_capability() {
    let cases = [
        (PlatformKind::Macos, true),
        (PlatformKind::Windows, false),
        (PlatformKind::Linux, false),
        (PlatformKind::Unknown, false),
    ];

    for (kind, supports_background_open) in cases {
        let info = platform_info_for_kind(kind);

        assert_eq!(
            info.capabilities.supports_background_browser_open, supports_background_open,
            "{kind:?}"
        );
        assert_eq!(
            should_use_background_browser_open(true, &info),
            supports_background_open,
            "{kind:?}"
        );
        assert!(
            !should_use_background_browser_open(false, &info),
            "{kind:?}"
        );
    }
}

#[test]
fn background_open_reports_child_process_spawn_failure_as_user_visible() {
    let message = background_browser_open_failure_message("No such file or directory");

    assert_eq!(
        message,
        "Failed to open browser; native opener diagnostics: background open failed: No such file or directory"
    );
}

#[test]
fn default_open_platform_failure_is_diagnostics_classified_after_url_schema() {
    let message = native_browser_open_failure_message("permission denied");

    assert_eq!(
        message,
        "Failed to open browser; native opener diagnostics: default open failed: permission denied"
    );
}

#[test]
fn native_open_diagnostics_redact_url_credentials_query_and_fragment() {
    let message = native_browser_open_failure_message(
        "default app rejected https://user:pass@example.com/private?token=raw#frag.",
    );

    assert!(message.contains("https://example.com/..."));
    assert!(!message.contains("user"));
    assert!(!message.contains("pass"));
    assert!(!message.contains("/private"));
    assert!(!message.contains("token=raw"));
    assert!(!message.contains("#frag"));
}

#[test]
fn background_open_reports_child_process_exit_failure_as_user_visible() {
    let mut command = std::process::Command::new("sh");
    command
        .arg("-c")
        .arg("printf 'LaunchServices denied' >&2; exit 7");

    match open_browser_in_background_with_command(&mut command) {
        Err(AppError::UserVisible { message }) => {
            assert!(message.contains("Failed to open browser"));
            assert!(message.contains("native opener diagnostics"));
            assert!(message.contains("LaunchServices denied"));
        }
        other => panic!("expected user-visible background open failure, got {other:?}"),
    }
}

#[test]
fn background_open_exit_failure_includes_status_without_stderr() {
    let mut command = std::process::Command::new("sh");
    command.arg("-c").arg("exit 9");

    match open_browser_in_background_with_command(&mut command) {
        Err(AppError::UserVisible { message }) => {
            assert!(message.contains("Failed to open browser"));
            assert!(message.contains("native opener diagnostics"));
            assert!(message.contains("open exited with status"));
        }
        other => panic!("expected user-visible background open failure, got {other:?}"),
    }
}

#[test]
fn background_open_exit_failure_message_trims_stderr() {
    let mut command = std::process::Command::new("sh");
    command
        .arg("-c")
        .arg("printf '\\nLaunchServices denied\\n' >&2; exit 7");
    let output = command.output().expect("test shell should run");

    let message = background_browser_open_status_failure_message(output.status, &output.stderr);

    assert!(message.ends_with("LaunchServices denied"));
    assert!(!message.ends_with('\n'));
}

#[test]
fn remote_mutations_require_provider_managed_greader_feed_ids() {
    assert!(provider_supports_pending_article_mutations("FreshRss"));
    assert!(!provider_supports_pending_article_mutations("Local"));
    assert!(!provider_supports_pending_article_mutations(
        "FutureProvider"
    ));

    assert!(supports_remote_mutations("FreshRss", Some("feed/1")));

    assert!(!supports_remote_mutations(
        "FreshRss",
        Some("https://example.com/feed.xml")
    ));
    assert!(!supports_remote_mutations("FreshRss", None));
    assert!(!supports_remote_mutations("Local", Some("feed/1")));
    assert!(!supports_remote_mutations("FutureProvider", Some("feed/1")));
}

#[test]
fn folder_article_list_mode_rejects_unknown_values() {
    assert_eq!(
        parse_article_list_mode(None).expect("missing mode should default to all"),
        ArticleListMode::All
    );

    let error = parse_article_list_mode(Some("archived"))
        .expect_err("unknown folder article mode should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Invalid article list mode: archived"
    ));
}

#[test]
fn feed_article_filters_reject_mutually_exclusive_flags() {
    let error = validate_feed_article_filters(Some(true), Some(true))
        .expect_err("unread and starred filters should not be combined");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Article list filters are mutually exclusive"
    ));
    validate_feed_article_filters(Some(true), Some(false))
        .expect("unread-only filter should be accepted");
    validate_feed_article_filters(Some(false), Some(true))
        .expect("starred-only filter should be accepted");
    validate_feed_article_filters(None, None).expect("missing filters should be accepted");
}

#[test]
fn article_command_pagination_uses_list_default_limit() {
    let pagination = article_command_pagination(Some(7), None, DEFAULT_ARTICLE_LIST_LIMIT)
        .expect("default list pagination should be accepted");

    assert_eq!(pagination.offset, 7);
    assert_eq!(pagination.limit, 50);
}

#[test]
fn article_command_pagination_uses_recent_default_limit() {
    let pagination = article_command_pagination(None, None, DEFAULT_RECENT_ARTICLE_LIST_LIMIT)
        .expect("default recent pagination should be accepted");

    assert_eq!(pagination.offset, 0);
    assert_eq!(pagination.limit, 20);
}

#[test]
fn article_command_pagination_accepts_boundary_limit() {
    let pagination = article_command_pagination(
        Some(3),
        Some(MAX_ARTICLE_COMMAND_LIST_LIMIT),
        DEFAULT_ARTICLE_LIST_LIMIT,
    )
    .expect("max article command list limit should be accepted");

    assert_eq!(pagination.offset, 3);
    assert_eq!(pagination.limit, 200);
}

#[test]
fn article_command_pagination_accepts_boundary_offset() {
    let pagination = article_command_pagination(
        Some(MAX_ARTICLE_COMMAND_LIST_OFFSET),
        Some(1),
        DEFAULT_ARTICLE_LIST_LIMIT,
    )
    .expect("max article command list offset should be accepted");

    assert_eq!(pagination.offset, MAX_ARTICLE_COMMAND_LIST_OFFSET);
    assert_eq!(pagination.limit, 1);
}

#[test]
fn article_command_pagination_rejects_offset_over_boundary() {
    let result = article_command_pagination(
        Some(MAX_ARTICLE_COMMAND_LIST_OFFSET + 1),
        Some(1),
        DEFAULT_ARTICLE_LIST_LIMIT,
    );
    let Err(error) = result else {
        panic!("article command list offset over max should be rejected");
    };

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Article list offset must be 10000 or less"
    ));
}

#[test]
fn article_command_pagination_rejects_limit_over_boundary() {
    let result = article_command_pagination(
        None,
        Some(MAX_ARTICLE_COMMAND_LIST_LIMIT + 1),
        DEFAULT_ARTICLE_LIST_LIMIT,
    );
    let Err(error) = result else {
        panic!("article command list limit over max should be rejected");
    };

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Article list limit must be 200 or less"
    ));
}

#[test]
fn article_command_pagination_rejects_load_more_values_with_stable_messages() {
    let cases = [
        (
            Some(MAX_ARTICLE_COMMAND_LIST_OFFSET + 1),
            Some(1),
            "Article list offset must be 10000 or less",
        ),
        (
            Some(MAX_ARTICLE_COMMAND_LIST_OFFSET),
            Some(MAX_ARTICLE_COMMAND_LIST_LIMIT + 1),
            "Article list limit must be 200 or less",
        ),
    ];

    for (offset, limit, expected_message) in cases {
        let Err(error) = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)
        else {
            panic!("invalid pagination should be rejected before repository access");
        };

        assert!(matches!(error, AppError::UserVisible { message } if message == expected_message));
    }
}

#[test]
fn security_privacy_article_render_read_path_repairs_stale_sanitizer_version_before_returning() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "Local");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
    db.writer()
        .execute(
            "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                "stale-render",
                "feed-a",
                "Stale Render",
                r#"<p onclick="evil()">Safe body</p><script>alert(1)</script>"#,
                r#"<script>stale rendered html</script>"#,
                sanitizer::SANITIZER_VERSION - 1,
                "2026-04-01T00:00:00Z",
                "2026-04-01T00:00:00Z"
            ],
        )
        .expect("stale article insert should succeed");
    let repo = SqliteArticleRepository::new(db.writer());
    let stale_articles = repo
        .find_by_feed(&FeedId("feed-a".to_string()), &Pagination::default())
        .expect("stale article should be readable");

    let repaired = repair_outdated_articles_for_render(&repo, stale_articles)
        .expect("render path repair should succeed");

    assert_eq!(repaired.len(), 1);
    assert_eq!(repaired[0].sanitizer_version, sanitizer::SANITIZER_VERSION);
    assert!(repaired[0].content_sanitized.contains("Safe body"));
    assert!(!repaired[0].content_sanitized.contains("<script"));
    assert!(!repaired[0].content_sanitized.contains("onclick"));

    let (saved_html, saved_version): (String, u32) = db
        .reader()
        .query_row(
            "SELECT content_sanitized, sanitizer_version FROM articles WHERE id = 'stale-render'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("repaired article should be persisted");
    assert_eq!(saved_html, repaired[0].content_sanitized);
    assert_eq!(saved_version, sanitizer::SANITIZER_VERSION);
}

#[test]
fn local_like_feeds_under_freshrss_accounts_do_not_queue_pending_mutations() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    let account_id = AccountId("acc-1".to_string());
    let feed_id = FeedId("feed-1".to_string());
    let article_id = ArticleId("article-1".to_string());

    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![account_id.0, "FreshRss", "FreshRSS"],
        )
        .expect("account insert should succeed");
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, remote_id, title, url, site_url, unread_count, reader_mode, web_preview_mode)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                feed_id.0,
                account_id.0,
                "https://example.com/feed.xml",
                "Example Feed",
                "https://example.com/feed.xml",
                "https://example.com",
                0,
                "inherit",
                "inherit"
            ],
        )
        .expect("feed insert should succeed");
    db.writer()
        .execute(
            "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                article_id.0,
                feed_id.0,
                "local-guid-1",
                "Example Article",
                "",
                "",
                1,
                "2026-04-01T00:00:00Z",
                "2026-04-01T00:00:00Z"
            ],
        )
        .expect("article insert should succeed");

    maybe_queue_mutation(db.writer(), &article_id, PendingMutationType::MarkRead)
        .expect("local-like feeds should be ignored without error");

    let pending_repo = SqlitePendingMutationRepository::new(db.reader());
    let pending = pending_repo
        .find_by_account(&account_id)
        .expect("pending mutation query should succeed");
    assert!(pending.is_empty());
}

#[test]
fn article_mutation_missing_id_contract_is_command_error() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");

    let read_error =
        mark_article_read_with_conn(db.writer(), ArticleId("missing-read".to_string()), true)
            .expect_err("missing article read mutation should be returned as a command error");
    assert!(matches!(
        read_error,
        AppError::UserVisible { message }
            if message == "Validation error: Article not found: missing-read"
    ));

    mark_articles_read_with_conn(
        db.writer(),
        &[
            ArticleId("missing-bulk-1".to_string()),
            ArticleId("missing-bulk-2".to_string()),
        ],
    )
    .expect("missing bulk article read mutation should be a no-op");

    let star_error =
        toggle_article_star_with_conn(db.writer(), ArticleId("missing-star".to_string()), true)
            .expect_err("missing article star mutation should be returned as a command error");
    assert!(matches!(
        star_error,
        AppError::UserVisible { message }
            if message == "Validation error: Article not found: missing-star"
    ));

    let pending_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .expect("pending mutation count should succeed");
    assert_eq!(pending_count, 0);
}

#[test]
fn bulk_article_read_ignores_missing_ids_and_allows_mixed_accounts() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_account(&db, "acc-b", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_feed(&db, "feed-b", "acc-b", None, Some("feed/b"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "article-b",
        "feed-b",
        Some("remote-b"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    db.writer()
        .execute(
            "UPDATE feeds SET unread_count = 1 WHERE id IN ('feed-a', 'feed-b')",
            [],
        )
        .expect("feed unread count setup should succeed");

    mark_articles_read_with_conn(
        db.writer(),
        &[
            ArticleId("article-a".to_string()),
            ArticleId("missing-article".to_string()),
            ArticleId("article-b".to_string()),
        ],
    )
    .expect("mixed-account bulk read with missing id should succeed");

    let pending_a = SqlitePendingMutationRepository::new(db.reader())
        .find_by_account(&AccountId("acc-a".to_string()))
        .expect("account a pending query should succeed");
    let pending_b = SqlitePendingMutationRepository::new(db.reader())
        .find_by_account(&AccountId("acc-b".to_string()))
        .expect("account b pending query should succeed");

    assert!(article_is_read(&db, "article-a"));
    assert!(article_is_read(&db, "article-b"));
    assert_eq!(feed_unread_count(&db, "feed-a"), 0);
    assert_eq!(feed_unread_count(&db, "feed-b"), 0);
    assert_eq!(pending_a.len(), 1);
    assert_eq!(pending_a[0].remote_entry_id, "remote-a");
    assert_eq!(pending_b.len(), 1);
    assert_eq!(pending_b[0].remote_entry_id, "remote-b");
}

#[test]
fn article_mutation_transaction_policy_bulk_article_read_handles_large_batch() {
    assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    let ids = (0..250)
        .map(|index| {
            let article_id = format!("article-{index}");
            insert_bulk_article(
                &db,
                &article_id,
                "feed-a",
                Some(&format!("remote-{index}")),
                "2026-04-01T00:00:00Z",
                false,
                false,
            );
            ArticleId(article_id)
        })
        .collect::<Vec<_>>();
    db.writer()
        .execute(
            "UPDATE feeds SET unread_count = 250 WHERE id = 'feed-a'",
            [],
        )
        .expect("feed unread count setup should succeed");

    mark_articles_read_with_conn(db.writer(), &ids)
        .expect("large bulk read should succeed in one transaction");

    let unread_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE is_read = 0",
            [],
            |row| row.get(0),
        )
        .expect("unread count query should succeed");
    assert_eq!(unread_count, 0);
    assert_eq!(feed_unread_count(&db, "feed-a"), 0);
    assert_eq!(pending_mutation_count(&db), ids.len() as i64);
}

#[test]
fn article_mutation_transaction_policy_bulk_article_read_rolls_back_on_mid_batch_update_failure() {
    assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "article-b",
        "feed-a",
        Some("remote-b"),
        "2026-04-02T00:00:00Z",
        false,
        false,
    );
    db.writer()
        .execute("UPDATE feeds SET unread_count = 2 WHERE id = 'feed-a'", [])
        .expect("feed unread count setup should succeed");
    db.writer()
        .execute(
            "CREATE TEMP TRIGGER fail_article_b_mark_read
             BEFORE UPDATE OF is_read ON articles
             WHEN NEW.id = 'article-b'
             BEGIN
               SELECT RAISE(ABORT, 'forced bulk read failure');
             END",
            [],
        )
        .expect("failure trigger should install");

    let error = mark_articles_read_with_conn(
        db.writer(),
        &[
            ArticleId("article-a".to_string()),
            ArticleId("article-b".to_string()),
        ],
    )
    .expect_err("mid-batch update failure should reject the bulk read mutation");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message } if message.contains("forced bulk read failure")
    ));
    assert!(!article_is_read(&db, "article-a"));
    assert!(!article_is_read(&db, "article-b"));
    assert_eq!(feed_unread_count(&db, "feed-a"), 2);
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn record_article_view_missing_id_contract_is_command_noop() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");

    record_article_view_with_conn(
        db.writer(),
        AccountId("acc-a".to_string()),
        ArticleId("missing-article".to_string()),
    )
    .expect("missing article view should be a no-op");

    let history_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
            row.get(0)
        })
        .expect("history count should succeed");
    assert_eq!(history_count, 0);
}

#[test]
fn record_article_view_persistence_failure_is_user_visible_not_retryable() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    db.writer()
        .execute("DROP TABLE article_view_history", [])
        .expect("history table drop should succeed");

    let error = record_article_view_with_conn(
        db.writer(),
        AccountId("acc-a".to_string()),
        ArticleId("article-a".to_string()),
    )
    .expect_err("history persistence failure should reject once");

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message.contains("Persistence error:")
                && message.contains("article_view_history")
    ));
}

#[test]
fn article_pending_mutation_query_errors_are_reported() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    db.writer()
        .execute("DROP TABLE articles", [])
        .expect("articles table drop should succeed");

    let error = maybe_queue_mutation(
        db.writer(),
        &ArticleId("article-1".to_string()),
        PendingMutationType::MarkRead,
    )
    .expect_err("pending mutation query DB errors should be reported");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message } if message.contains("no such table: articles")
    ));
}

#[test]
fn cleanup_feed_integrity_orphans_dry_run_does_not_delete_orphans() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(false);
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_orphaned_article(&db_guard, "orphan-dry-run", "missing-feed");
    }

    let result = cleanup_feed_integrity_orphans_inner(&db, &syncing, true, None)
        .expect("dry-run cleanup should succeed");
    let remaining = {
        let db_guard = db.lock().expect("test DB lock should succeed");
        SqliteArticleRepository::new(db_guard.reader())
            .count_orphaned_articles()
            .expect("orphan count should succeed")
    };

    assert!(result.dry_run);
    assert_eq!(result.orphaned_article_count, 1);
    assert_eq!(result.deleted_article_count, 0);
    assert_eq!(
        result.orphaned_article_ids,
        Some(vec!["orphan-dry-run".to_string()])
    );
    assert_eq!(remaining, 1);
}

#[test]
fn cleanup_feed_integrity_orphans_deletes_counted_orphans() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(false);
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_bulk_account(&db_guard, "acc-cleanup", "Local");
        insert_bulk_feed(&db_guard, "feed-cleanup", "acc-cleanup", None, None);
        insert_bulk_article(
            &db_guard,
            "healthy-cleanup",
            "feed-cleanup",
            None,
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        insert_orphaned_article(&db_guard, "orphan-cleanup", "missing-feed");
    }

    let result = cleanup_feed_integrity_orphans_inner(&db, &syncing, false, None)
        .expect("destructive cleanup should succeed");
    let (remaining_orphans, healthy_articles) = {
        let db_guard = db.lock().expect("test DB lock should succeed");
        let repo = SqliteArticleRepository::new(db_guard.reader());
        (
            repo.count_orphaned_articles()
                .expect("orphan count should succeed"),
            repo.find_by_feed(&FeedId("feed-cleanup".to_string()), &Pagination::default())
                .expect("healthy feed query should succeed")
                .len(),
        )
    };

    assert!(!result.dry_run);
    assert_eq!(result.orphaned_article_count, 1);
    assert_eq!(result.deleted_article_count, 1);
    assert_eq!(result.orphaned_article_ids, None);
    assert_eq!(remaining_orphans, 0);
    assert_eq!(healthy_articles, 1);
    let article_stats_rows: i64 = {
        let db_guard = db.lock().expect("test DB lock should succeed");
        db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_stat1 WHERE tbl = 'articles'",
                [],
                |row| row.get(0),
            )
            .expect("article stats query should succeed")
    };
    assert!(article_stats_rows > 0);
}

#[test]
fn cleanup_feed_integrity_orphans_uses_dry_run_snapshot_when_feed_is_restored() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(false);
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_bulk_account(&db_guard, "acc-restored", "Local");
        insert_orphaned_article(&db_guard, "orphan-restored", "feed-restored");
    }

    let dry_run = cleanup_feed_integrity_orphans_inner(&db, &syncing, true, None)
        .expect("dry-run cleanup should succeed");
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_bulk_feed(&db_guard, "feed-restored", "acc-restored", None, None);
    }

    let result = cleanup_feed_integrity_orphans_inner(
        &db,
        &syncing,
        false,
        dry_run.orphaned_article_ids.clone(),
    )
    .expect("snapshot cleanup should succeed after feed restore");
    let restored_article_count = {
        let db_guard = db.lock().expect("test DB lock should succeed");
        SqliteArticleRepository::new(db_guard.reader())
            .find_by_feed(&FeedId("feed-restored".to_string()), &Pagination::default())
            .expect("restored feed query should succeed")
            .len()
    };

    assert!(!result.dry_run);
    assert_eq!(result.orphaned_article_count, 1);
    assert_eq!(result.deleted_article_count, 0);
    assert_eq!(restored_article_count, 1);
}

#[test]
fn cleanup_feed_integrity_orphans_ignores_new_orphans_outside_dry_run_snapshot() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(false);
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_orphaned_article(&db_guard, "orphan-snapshot", "missing-feed-snapshot");
    }

    let dry_run = cleanup_feed_integrity_orphans_inner(&db, &syncing, true, None)
        .expect("dry-run cleanup should succeed");
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_orphaned_article(&db_guard, "orphan-new", "missing-feed-new");
    }

    let result = cleanup_feed_integrity_orphans_inner(
        &db,
        &syncing,
        false,
        dry_run.orphaned_article_ids.clone(),
    )
    .expect("snapshot cleanup should succeed with new orphan drift");
    let remaining_orphans = {
        let db_guard = db.lock().expect("test DB lock should succeed");
        SqliteArticleRepository::new(db_guard.reader())
            .count_orphaned_articles()
            .expect("orphan count should succeed")
    };

    assert!(!result.dry_run);
    assert_eq!(result.orphaned_article_count, 1);
    assert_eq!(result.deleted_article_count, 1);
    assert_eq!(remaining_orphans, 1);
}

#[test]
fn cleanup_feed_integrity_orphans_treats_feed_delete_cascade_as_already_clean() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(false);
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_bulk_account(&db_guard, "acc-cascade", "Local");
        insert_bulk_feed(&db_guard, "feed-cascade", "acc-cascade", None, None);
        insert_bulk_article(
            &db_guard,
            "article-cascade",
            "feed-cascade",
            None,
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        SqliteFeedRepository::new(db_guard.writer())
            .delete(&FeedId("feed-cascade".to_string()))
            .expect("feed delete should cascade article rows");
    }

    let result = cleanup_feed_integrity_orphans_inner(&db, &syncing, false, None)
        .expect("cleanup after cascade should succeed");

    assert!(!result.dry_run);
    assert_eq!(result.orphaned_article_count, 0);
    assert_eq!(result.deleted_article_count, 0);
}

#[test]
fn cleanup_feed_integrity_orphans_rejects_while_syncing() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(true);

    let error = cleanup_feed_integrity_orphans_inner(&db, &syncing, false, None)
        .expect_err("syncing should block cleanup");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == DATABASE_MAINTENANCE_BUSY_ERROR
    ));
}

#[test]
fn get_feed_integrity_report_rejects_while_syncing_or_maintenance_is_reserved() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(true);

    let error = get_feed_integrity_report_inner(&db, &syncing)
        .expect_err("syncing should block feed integrity report reads");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == DATABASE_MAINTENANCE_BUSY_ERROR
    ));
}

#[test]
fn get_feed_integrity_report_reads_orphans_only_when_idle() {
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
    let syncing = AtomicBool::new(false);
    {
        let db_guard = db.lock().expect("test DB lock should succeed");
        insert_orphaned_article(&db_guard, "orphan-report", "missing-feed-report");
    }

    let result = get_feed_integrity_report_inner(&db, &syncing)
        .expect("idle feed integrity report should succeed");

    assert_eq!(result.orphaned_article_count, 1);
    assert_eq!(result.orphaned_feeds.len(), 1);
    assert_eq!(
        result.orphaned_feeds[0].missing_feed_id,
        "missing-feed-report"
    );
}

fn insert_bulk_account(db: &DbManager, id: &str, kind: &str) {
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, kind, id],
        )
        .expect("account insert should succeed");
}

fn insert_bulk_feed(
    db: &DbManager,
    id: &str,
    account_id: &str,
    folder_id: Option<&str>,
    remote_id: Option<&str>,
) {
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, remote_id, title, url, site_url, unread_count, reader_mode, web_preview_mode)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'inherit', 'inherit')",
            rusqlite::params![
                id,
                account_id,
                folder_id,
                remote_id,
                id,
                format!("https://example.com/{id}.xml"),
                "https://example.com"
            ],
        )
        .expect("feed insert should succeed");
}

fn insert_bulk_article(
    db: &DbManager,
    id: &str,
    feed_id: &str,
    remote_id: Option<&str>,
    published_at: &str,
    is_read: bool,
    is_starred: bool,
) {
    db.writer()
        .execute(
            "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at, is_read, is_starred)
             VALUES (?1, ?2, ?3, ?4, '', '', 1, ?5, ?5, ?6, ?7)",
            rusqlite::params![id, feed_id, remote_id, id, published_at, is_read, is_starred],
        )
        .expect("article insert should succeed");
}

fn insert_orphaned_article(db: &DbManager, id: &str, missing_feed_id: &str) {
    db.writer()
        .execute_batch("PRAGMA foreign_keys = OFF;")
        .expect("foreign key disable should succeed");
    db.writer()
        .execute(
            "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at)
             VALUES (?1, ?2, ?3, ?4, '', '', 1, ?5, ?5)",
            rusqlite::params![
                id,
                missing_feed_id,
                Option::<String>::None,
                id,
                "2026-04-01T00:00:00Z",
            ],
        )
        .expect("orphaned article insert should succeed");
    db.writer()
        .execute_batch("PRAGMA foreign_keys = ON;")
        .expect("foreign key enable should succeed");
}

fn feed_unread_count(db: &DbManager, feed_id: &str) -> i64 {
    db.reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            rusqlite::params![feed_id],
            |row| row.get(0),
        )
        .expect("feed unread count query should succeed")
}

fn pending_mutation_count(db: &DbManager) -> i64 {
    db.reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .expect("pending mutation count query should succeed")
}

fn article_is_read(db: &DbManager, article_id: &str) -> bool {
    db.reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            rusqlite::params![article_id],
            |row| row.get(0),
        )
        .expect("article read state query should succeed")
}

fn article_is_starred(db: &DbManager, article_id: &str) -> bool {
    db.reader()
        .query_row(
            "SELECT is_starred FROM articles WHERE id = ?1",
            rusqlite::params![article_id],
            |row| row.get(0),
        )
        .expect("article starred state query should succeed")
}

fn install_pending_mutation_insert_failure_trigger(db: &DbManager) {
    db.writer()
        .execute_batch(
            "CREATE TEMP TRIGGER fail_pending_mutation_insert
             BEFORE INSERT ON pending_mutations
             BEGIN
               SELECT RAISE(FAIL, 'pending mutation insert failed');
             END;",
        )
        .expect("pending mutation failure trigger should install");
}

#[test]
fn article_read_and_star_commands_queue_pending_mutations_for_remote_feeds() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );

    mark_article_read_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
        .expect("read mutation should succeed");
    toggle_article_star_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
        .expect("star mutation should succeed");

    let pending_repo = SqlitePendingMutationRepository::new(db.reader());
    let pending = pending_repo
        .find_by_account(&AccountId("acc-a".to_string()))
        .expect("pending mutation query should succeed");
    let pending_types = pending
        .iter()
        .map(|mutation| mutation.mutation_type)
        .collect::<Vec<_>>();

    assert_eq!(
        pending_types,
        vec![PendingMutationType::MarkRead, PendingMutationType::Star]
    );
    assert!(pending
        .iter()
        .all(|mutation| mutation.remote_entry_id == "remote-a"));
}

#[test]
fn article_read_and_star_commands_do_not_queue_pending_mutations_for_local_feeds() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "Local");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        None,
        "2026-04-01T00:00:00Z",
        false,
        false,
    );

    mark_article_read_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
        .expect("local read mutation should succeed");
    toggle_article_star_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
        .expect("local star mutation should succeed");

    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn mark_article_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    db.writer()
        .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
        .expect("feed unread count setup should succeed");
    install_pending_mutation_insert_failure_trigger(&db);

    let error = mark_article_read_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
        .expect_err("pending mutation queue failure should reject the read mutation");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message }
            if message.contains("pending mutation insert failed")
    ));
    assert!(!article_is_read(&db, "article-a"));
    assert_eq!(feed_unread_count(&db, "feed-a"), 1);
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn mark_articles_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "article-b",
        "feed-a",
        Some("remote-b"),
        "2026-04-02T00:00:00Z",
        false,
        false,
    );
    db.writer()
        .execute("UPDATE feeds SET unread_count = 2 WHERE id = 'feed-a'", [])
        .expect("feed unread count setup should succeed");
    install_pending_mutation_insert_failure_trigger(&db);

    let error = mark_articles_read_with_conn(
        db.writer(),
        &[
            ArticleId("article-a".to_string()),
            ArticleId("article-b".to_string()),
        ],
    )
    .expect_err("pending mutation queue failure should reject the bulk read mutation");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message }
            if message.contains("pending mutation insert failed")
    ));
    assert!(!article_is_read(&db, "article-a"));
    assert!(!article_is_read(&db, "article-b"));
    assert_eq!(feed_unread_count(&db, "feed-a"), 2);
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn mark_feed_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    db.writer()
        .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
        .expect("feed unread count setup should succeed");
    install_pending_mutation_insert_failure_trigger(&db);

    let error = mark_feed_read_with_conn(db.writer(), FeedId("feed-a".to_string()))
        .expect_err("pending mutation queue failure should reject feed mark read");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message }
            if message.contains("pending mutation insert failed")
    ));
    assert!(!article_is_read(&db, "article-a"));
    assert_eq!(feed_unread_count(&db, "feed-a"), 1);
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn mark_folder_read_returns_marked_unread_article_ids() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-a', 'acc-a', 'Folder', 0)",
            [],
        )
        .expect("folder insert should succeed");
    insert_bulk_feed(&db, "feed-a", "acc-a", Some("folder-a"), Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-unread",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "article-read",
        "feed-a",
        Some("remote-b"),
        "2026-04-02T00:00:00Z",
        true,
        false,
    );

    let marked_ids = mark_folder_read_with_conn(db.writer(), FolderId("folder-a".to_string()))
        .expect("folder mark read should succeed");

    assert_eq!(marked_ids, vec!["article-unread".to_string()]);
    assert!(article_is_read(&db, "article-unread"));
}

#[test]
fn mark_feed_read_returns_marked_unread_article_ids() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-unread",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );

    let marked_ids = mark_feed_read_with_conn(db.writer(), FeedId("feed-a".to_string()))
        .expect("feed mark read should succeed");

    assert_eq!(marked_ids, vec!["article-unread".to_string()]);
    assert!(article_is_read(&db, "article-unread"));
}

#[test]
fn mark_folder_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-a', 'acc-a', 'Folder', 0)",
            [],
        )
        .expect("folder insert should succeed");
    insert_bulk_feed(&db, "feed-a", "acc-a", Some("folder-a"), Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    db.writer()
        .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
        .expect("feed unread count setup should succeed");
    install_pending_mutation_insert_failure_trigger(&db);

    let error = mark_folder_read_with_conn(db.writer(), FolderId("folder-a".to_string()))
        .expect_err("pending mutation queue failure should reject folder mark read");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message }
            if message.contains("pending mutation insert failed")
    ));
    assert!(!article_is_read(&db, "article-a"));
    assert_eq!(feed_unread_count(&db, "feed-a"), 1);
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn bulk_account_and_old_unread_operations_roll_back_when_pending_mutation_queue_fails() {
    let cases: [(&str, Box<dyn Fn(&DbManager) -> Result<u64, AppError>>); 4] = [
        (
            "account read",
            Box::new(|db| bulk_mark_account_read(db.writer(), &AccountId("acc-a".to_string()))),
        ),
        (
            "account starred read",
            Box::new(|db| {
                bulk_mark_account_starred_read(db.writer(), &AccountId("acc-a".to_string()))
            }),
        ),
        (
            "old unread",
            Box::new(|db| {
                let before = chrono::DateTime::parse_from_rfc3339("2026-04-02T00:00:00Z")
                    .expect("timestamp should parse")
                    .with_timezone(&chrono::Utc);
                bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Account, "acc-a", before)
            }),
        ),
        (
            "account unstar",
            Box::new(|db| {
                bulk_unstar_account_articles(db.writer(), &AccountId("acc-a".to_string()))
            }),
        ),
    ];

    for (name, run) in cases {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            true,
        );
        db.writer()
            .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
            .expect("feed unread count setup should succeed");
        install_pending_mutation_insert_failure_trigger(&db);

        let error = run(&db).expect_err("bulk operation should reject queue failure");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message.contains("pending mutation insert failed")
        ));
        assert!(!article_is_read(&db, "article-a"), "{name}");
        assert!(article_is_starred(&db, "article-a"), "{name}");
        assert_eq!(feed_unread_count(&db, "feed-a"), 1, "{name}");
        assert_eq!(pending_mutation_count(&db), 0, "{name}");
    }
}

#[test]
fn article_mutation_transaction_policy_bulk_unstar_rolls_back_on_mid_batch_update_failure() {
    assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        true,
        true,
    );
    insert_bulk_article(
        &db,
        "article-b",
        "feed-a",
        Some("remote-b"),
        "2026-04-02T00:00:00Z",
        true,
        true,
    );
    db.writer()
        .execute(
            "CREATE TEMP TRIGGER fail_article_b_unstar
             BEFORE UPDATE OF is_starred ON articles
             WHEN NEW.id = 'article-b'
             BEGIN
               SELECT RAISE(ABORT, 'forced bulk unstar failure');
             END",
            [],
        )
        .expect("failure trigger should install");

    let error = bulk_unstar_account_articles(db.writer(), &AccountId("acc-a".to_string()))
        .expect_err("mid-batch update failure should reject the bulk unstar mutation");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message }
            if message.contains("forced bulk unstar failure")
    ));
    assert!(article_is_starred(&db, "article-a"));
    assert!(article_is_starred(&db, "article-b"));
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn toggle_article_star_rolls_back_local_state_when_pending_mutation_queue_fails() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        true,
        false,
    );
    install_pending_mutation_insert_failure_trigger(&db);

    let error =
        toggle_article_star_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
            .expect_err("pending mutation queue failure should reject star toggle");

    assert!(matches!(
        error,
        AppError::UserVisible { ref message }
            if message.contains("pending mutation insert failed")
    ));
    assert!(!article_is_starred(&db, "article-a"));
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn bulk_mark_account_read_marks_only_account_and_queues_remote_mutations() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_account(&db, "acc-b", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_feed(&db, "feed-b", "acc-b", None, Some("feed/b"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "article-b",
        "feed-b",
        Some("remote-b"),
        "2026-04-01T00:00:00Z",
        false,
        false,
    );

    bulk_mark_account_read(db.writer(), &AccountId("acc-a".to_string()))
        .expect("bulk mark read should succeed");

    let account_a_unread: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-a' AND a.is_read = 0",
            [],
            |row| row.get(0),
        )
        .expect("count should succeed");
    let account_b_unread: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-b' AND a.is_read = 0",
            [],
            |row| row.get(0),
        )
        .expect("count should succeed");
    let pending_repo = SqlitePendingMutationRepository::new(db.reader());
    let pending = pending_repo
        .find_by_account(&AccountId("acc-a".to_string()))
        .expect("pending query should succeed");

    assert_eq!(account_a_unread, 0);
    assert_eq!(account_b_unread, 1);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].mutation_type, PendingMutationType::MarkRead);
    assert_eq!(pending[0].remote_entry_id, "remote-a");
}

#[test]
fn bulk_feed_unread_recalculation_handles_duplicate_rows_once_per_feed() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "Local");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
    insert_bulk_feed(&db, "feed-b", "acc-a", None, None);
    insert_bulk_article(
        &db,
        "article-a1",
        "feed-a",
        None,
        "2026-04-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "article-a2",
        "feed-a",
        None,
        "2026-04-02T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "article-b1",
        "feed-b",
        None,
        "2026-04-03T00:00:00Z",
        false,
        false,
    );
    db.writer()
        .execute("UPDATE feeds SET unread_count = 99 WHERE id = 'feed-a'", [])
        .expect("feed-a stale count update should succeed");
    db.writer()
        .execute("UPDATE feeds SET unread_count = 77 WHERE id = 'feed-b'", [])
        .expect("feed-b stale count update should succeed");

    let duplicate_rows = vec![
        BulkArticleMutationRow {
            article_id: "article-a1".to_string(),
            feed_id: "feed-a".to_string(),
            remote_entry_id: None,
            account_kind: "Local".to_string(),
            account_id: "acc-a".to_string(),
            feed_remote_id: None,
        },
        BulkArticleMutationRow {
            article_id: "article-a2".to_string(),
            feed_id: "feed-a".to_string(),
            remote_entry_id: None,
            account_kind: "Local".to_string(),
            account_id: "acc-a".to_string(),
            feed_remote_id: None,
        },
        BulkArticleMutationRow {
            article_id: "article-a1-duplicate".to_string(),
            feed_id: "feed-a".to_string(),
            remote_entry_id: None,
            account_kind: "Local".to_string(),
            account_id: "acc-a".to_string(),
            feed_remote_id: None,
        },
    ];

    recalculate_bulk_feed_unread_counts(db.writer(), &duplicate_rows)
        .expect("bulk feed unread recalculation should succeed");

    let feed_a_unread: i64 = db
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = 'feed-a'",
            [],
            |row| row.get(0),
        )
        .expect("feed-a unread count query should succeed");
    let feed_b_unread: i64 = db
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = 'feed-b'",
            [],
            |row| row.get(0),
        )
        .expect("feed-b unread count query should succeed");

    assert_eq!(feed_a_unread, 2);
    assert_eq!(feed_b_unread, 77);
}

#[test]
fn old_unread_missing_targets_are_zero_count_success() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "Local");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        None,
        "2026-03-01T00:00:00Z",
        false,
        false,
    );
    let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
        .expect("timestamp should parse")
        .with_timezone(&chrono::Utc);

    let cases = [
        (OldUnreadScope::Account, "missing-account"),
        (OldUnreadScope::Feed, "missing-feed"),
        (OldUnreadScope::Folder, "missing-folder"),
    ];

    for (scope, target_id) in cases {
        let rows = collect_old_unread_rows(db.reader(), scope, target_id, before)
            .expect("missing old unread target count should succeed");
        let marked = bulk_mark_old_unread_read(db.writer(), scope, target_id, before)
            .expect("missing old unread target mark should succeed");

        assert!(rows.is_empty(), "{target_id} should count as zero");
        assert_eq!(marked, 0, "{target_id} should mark zero articles");
    }
    assert!(!article_is_read(&db, "article-a"));
    assert_eq!(feed_unread_count(&db, "feed-a"), 0);
    assert_eq!(pending_mutation_count(&db), 0);
}

#[test]
fn bulk_mark_old_unread_read_respects_scope_and_published_threshold() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "Local");
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-a', 'acc-a', 'Folder', 0)",
            [],
        )
        .expect("folder insert should succeed");
    insert_bulk_feed(&db, "feed-in-folder", "acc-a", Some("folder-a"), None);
    insert_bulk_feed(&db, "feed-outside", "acc-a", None, None);
    insert_bulk_article(
        &db,
        "old-in-folder",
        "feed-in-folder",
        None,
        "2026-03-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "new-in-folder",
        "feed-in-folder",
        None,
        "2026-05-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "old-outside",
        "feed-outside",
        None,
        "2026-03-01T00:00:00Z",
        false,
        false,
    );
    let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
        .expect("timestamp should parse")
        .with_timezone(&chrono::Utc);

    let count = bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Folder, "folder-a", before)
        .expect("old unread mark should succeed");

    let read_ids: Vec<String> = db
        .reader()
        .prepare("SELECT id FROM articles WHERE is_read = 1 ORDER BY id")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(0))
                .and_then(|rows| rows.collect())
        })
        .expect("read id query should succeed");

    assert_eq!(count, 1);
    assert_eq!(read_ids, vec!["old-in-folder"]);
}

#[test]
fn old_unread_cutoff_is_stable_for_the_same_utc_day() {
    let before_midnight = chrono::DateTime::parse_from_rfc3339("2026-05-10T00:00:01Z")
        .expect("timestamp should parse")
        .with_timezone(&chrono::Utc);
    let before_next_midnight = chrono::DateTime::parse_from_rfc3339("2026-05-10T23:59:59Z")
        .expect("timestamp should parse")
        .with_timezone(&chrono::Utc);

    assert_eq!(
        old_unread_before_from_now(before_midnight, 7),
        old_unread_before_from_now(before_next_midnight, 7)
    );
    assert_eq!(
        old_unread_before_from_now(before_midnight, 7).to_rfc3339(),
        "2026-05-03T00:00:00+00:00"
    );
}

#[test]
fn old_unread_uses_normalized_timestamp_comparison() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "Local");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
    insert_bulk_article(
        &db,
        "fractional-old",
        "feed-a",
        None,
        "2026-03-31T23:59:59.999Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "offset-equal-cutoff",
        "feed-a",
        None,
        "2026-04-01T09:00:00+09:00",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "invalid-legacy",
        "feed-a",
        None,
        "not-a-timestamp",
        false,
        false,
    );
    let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
        .expect("timestamp should parse")
        .with_timezone(&chrono::Utc);

    let count = bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Account, "acc-a", before)
        .expect("old unread mark should succeed");

    assert_eq!(count, 1);
    assert!(article_is_read(&db, "fractional-old"));
    assert!(!article_is_read(&db, "offset-equal-cutoff"));
    assert!(!article_is_read(&db, "invalid-legacy"));
}

#[test]
fn bulk_mark_old_unread_read_queues_only_provider_supported_pending_mutations() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_account(&db, "acc-local", "Local");
    insert_bulk_account(&db, "acc-future", "FutureProvider");
    insert_bulk_feed(&db, "feed-remote", "acc-a", None, Some("feed/a"));
    insert_bulk_feed(
        &db,
        "feed-local-like",
        "acc-a",
        None,
        Some("https://example.com/feed.xml"),
    );
    insert_bulk_feed(&db, "feed-local", "acc-local", None, None);
    insert_bulk_feed(&db, "feed-future", "acc-future", None, Some("feed/future"));
    insert_bulk_article(
        &db,
        "remote-a",
        "feed-remote",
        Some("remote-shared"),
        "2026-03-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "remote-b",
        "feed-remote",
        Some("remote-shared"),
        "2026-03-02T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "local-like",
        "feed-local-like",
        Some("local-guid"),
        "2026-03-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "local",
        "feed-local",
        None,
        "2026-03-01T00:00:00Z",
        false,
        false,
    );
    insert_bulk_article(
        &db,
        "future",
        "feed-future",
        Some("future-remote"),
        "2026-03-01T00:00:00Z",
        false,
        false,
    );
    let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
        .expect("timestamp should parse")
        .with_timezone(&chrono::Utc);

    let count = bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Account, "acc-a", before)
        .expect("old unread mark should succeed");

    let pending_repo = SqlitePendingMutationRepository::new(db.reader());
    let pending = pending_repo
        .find_by_account(&AccountId("acc-a".to_string()))
        .expect("pending mutation query should succeed");

    assert_eq!(count, 3);
    assert!(article_is_read(&db, "remote-a"));
    assert!(article_is_read(&db, "remote-b"));
    assert!(article_is_read(&db, "local-like"));
    assert!(!article_is_read(&db, "local"));
    assert!(!article_is_read(&db, "future"));
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].mutation_type, PendingMutationType::MarkRead);
    assert_eq!(pending[0].remote_entry_id, "remote-shared");
    assert_eq!(pending_mutation_count(&db), 1);
}

#[test]
fn old_unread_scope_parse_accepts_command_scope_values() {
    assert_eq!(
        OldUnreadScope::parse("account").unwrap(),
        OldUnreadScope::Account
    );
    assert_eq!(OldUnreadScope::parse("feed").unwrap(), OldUnreadScope::Feed);
    assert_eq!(
        OldUnreadScope::parse("folder").unwrap(),
        OldUnreadScope::Folder
    );
}

#[test]
fn old_unread_scope_parse_rejects_invalid_scope_with_user_visible_error() {
    let error = OldUnreadScope::parse("tag").expect_err("unknown scope should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Invalid old unread scope"
    ));
}

#[test]
fn validate_older_than_days_accepts_supported_command_values() {
    assert_eq!(validate_older_than_days(7).unwrap(), 7);
    assert_eq!(validate_older_than_days(30).unwrap(), 30);
    assert_eq!(validate_older_than_days(90).unwrap(), 90);
}

#[test]
fn validate_older_than_days_rejects_invalid_values_with_user_visible_error() {
    for value in [0, -7, 1, 365] {
        let error = validate_older_than_days(value).expect_err("invalid period should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Invalid old unread period"
        ));
    }
}

#[test]
fn bulk_unstar_account_articles_scopes_and_queues_remote_mutations() {
    let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
    insert_bulk_account(&db, "acc-a", "FreshRss");
    insert_bulk_account(&db, "acc-b", "FreshRss");
    insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
    insert_bulk_feed(&db, "feed-b", "acc-b", None, Some("feed/b"));
    insert_bulk_article(
        &db,
        "article-a",
        "feed-a",
        Some("remote-a"),
        "2026-04-01T00:00:00Z",
        true,
        true,
    );
    insert_bulk_article(
        &db,
        "article-b",
        "feed-b",
        Some("remote-b"),
        "2026-04-01T00:00:00Z",
        true,
        true,
    );

    let count = bulk_unstar_account_articles(db.writer(), &AccountId("acc-a".to_string()))
        .expect("unstar should succeed");

    let account_a_starred: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-a' AND a.is_starred = 1",
            [],
            |row| row.get(0),
        )
        .expect("count should succeed");
    let account_b_starred: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-b' AND a.is_starred = 1",
            [],
            |row| row.get(0),
        )
        .expect("count should succeed");
    let pending_repo = SqlitePendingMutationRepository::new(db.reader());
    let pending = pending_repo
        .find_by_account(&AccountId("acc-a".to_string()))
        .expect("pending query should succeed");

    assert_eq!(count, 1);
    assert_eq!(account_a_starred, 0);
    assert_eq!(account_b_starred, 1);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].mutation_type, PendingMutationType::Unstar);
    assert_eq!(pending[0].remote_entry_id, "remote-a");
}
