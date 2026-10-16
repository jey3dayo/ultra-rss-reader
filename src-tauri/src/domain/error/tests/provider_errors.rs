use super::*;

#[test]
fn sqlite_errors_map_to_persistence_and_user_visible_app_errors() {
    let domain_error = DomainError::from(rusqlite::Error::QueryReturnedNoRows);

    assert!(matches!(domain_error, DomainError::Persistence(_)));
    assert_eq!(
        domain_error.to_string(),
        "Persistence error: Query returned no rows"
    );

    let app_error = AppError::from(DomainError::from(rusqlite::Error::QueryReturnedNoRows));

    match app_error {
        AppError::UserVisible { message } => {
            assert_eq!(message, "Persistence error: Query returned no rows");
        }
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            panic!("sqlite persistence errors must not become retryable: {message}");
        }
    }
}

#[test]
fn provider_boundary_errors_keep_internal_kind_and_user_visible_messages() {
    let cases = [
        (
            DomainError::Auth("invalid credentials".to_string()),
            "Auth error: invalid credentials",
        ),
        (
            DomainError::Validation("missing feed url".to_string()),
            "Validation error: missing feed url",
        ),
        (
            DomainError::Parse("invalid feed document".to_string()),
            "Parse error: invalid feed document",
        ),
    ];

    for (domain_error, expected_message) in cases {
        match &domain_error {
            DomainError::Auth(_) | DomainError::Validation(_) | DomainError::Parse(_) => {}
            other => panic!("unexpected provider boundary error kind: {other:?}"),
        }

        assert_eq!(domain_error.to_string(), expected_message);

        match AppError::from(domain_error) {
            AppError::UserVisible { message } => {
                assert_eq!(message, expected_message);
            }
            AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
                panic!("provider boundary errors must not become retryable: {message}");
            }
        }
    }
}

#[test]
fn provider_boundary_errors_keep_category_and_recovery_surface() {
    let cases = [
        (
            DomainError::Network(
                "Could not resolve the server name. Check the server URL or your DNS/network settings."
                    .to_string(),
            ),
            "Network error: Could not resolve the server name. Check the server URL or your DNS/network settings.",
            true,
            true,
        ),
        (
            DomainError::Network(
                "Request timed out. Check the server URL or your network connection."
                    .to_string(),
            ),
            "Network error: Request timed out. Check the server URL or your network connection.",
            true,
            true,
        ),
        (
            DomainError::Network(
                "Could not verify the server certificate. Check the server certificate or account URL."
                    .to_string(),
            ),
            "Network error: Could not verify the server certificate. Check the server certificate or account URL.",
            true,
            true,
        ),
        (
            DomainError::Network(
                "The server closed the connection unexpectedly. Check the server status and try again."
                    .to_string(),
            ),
            "Network error: The server closed the connection unexpectedly. Check the server status and try again.",
            true,
            true,
        ),
        (
            DomainError::RateLimitWithRetryAfter {
                message: "HTTP 429 Too Many Requests".to_string(),
                retry_after_seconds: 120,
            },
            "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=120",
            true,
            false,
        ),
        (
            DomainError::Auth("HTTP 401 Unauthorized".to_string()),
            "Auth error: HTTP 401 Unauthorized",
            false,
            false,
        ),
        (
            DomainError::RateLimit("HTTP 429 Too Many Requests".to_string()),
            "Rate limit error: HTTP 429 Too Many Requests",
            true,
            false,
        ),
        (
            DomainError::Parse("malformed provider response".to_string()),
            "Parse error: malformed provider response",
            false,
            false,
        ),
        (
            DomainError::Persistence("Query returned no rows".to_string()),
            "Persistence error: Query returned no rows",
            false,
            false,
        ),
    ];

    for (domain_error, expected_message, expected_retryable, expected_recovery_guidance) in cases {
        assert_eq!(domain_error.to_string(), expected_message);
        match (AppError::from(domain_error), expected_retryable) {
            (
                AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. },
                true,
            ) => assert_eq!(message, expected_message),
            (AppError::UserVisible { message }, false) => assert_eq!(message, expected_message),
            (
                AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. },
                false,
            ) => {
                panic!("provider boundary error became unexpectedly retryable: {message}");
            }
            (AppError::UserVisible { message }, true) => {
                panic!("provider boundary error stopped being retryable: {message}");
            }
        }
        assert_eq!(
            expected_message.contains("Check "),
            expected_recovery_guidance,
            "recovery guidance presence changed for {expected_message}"
        );
    }
}

#[test]
fn provider_http_status_errors_keep_domain_failure_kinds() {
    let cases = [
        (
            StatusCode::UNAUTHORIZED,
            DomainError::Auth("HTTP 401 Unauthorized".to_string()),
            false,
        ),
        (
            StatusCode::FORBIDDEN,
            DomainError::Auth("HTTP 403 Forbidden".to_string()),
            false,
        ),
        (
            StatusCode::TOO_MANY_REQUESTS,
            DomainError::RateLimit("HTTP 429 Too Many Requests".to_string()),
            true,
        ),
        (
            StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
            DomainError::Validation("HTTP 451 Unavailable For Legal Reasons".to_string()),
            false,
        ),
        (
            StatusCode::SERVICE_UNAVAILABLE,
            DomainError::Network("HTTP 503 Service Unavailable".to_string()),
            true,
        ),
        (
            StatusCode::BAD_GATEWAY,
            DomainError::Network("HTTP 502 Bad Gateway".to_string()),
            true,
        ),
    ];

    for (status, expected_error, expected_retryable) in cases {
        let domain_error = DomainError::from_provider_http_status(status);

        assert_eq!(domain_error.to_string(), expected_error.to_string());
        assert_eq!(
            matches!(AppError::from(domain_error), AppError::Retryable { .. }),
            expected_retryable
        );
    }
}

#[test]
fn provider_http_status_429_includes_retry_after_seconds_when_present() {
    let mut headers = HeaderMap::new();
    headers.insert(RETRY_AFTER, HeaderValue::from_static("120"));

    let domain_error =
        DomainError::from_provider_http_response_status(StatusCode::TOO_MANY_REQUESTS, &headers);

    assert_eq!(
        domain_error.to_string(),
        "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=120"
    );
}

#[test]
fn provider_http_status_429_caps_huge_retry_after_delta() {
    let mut headers = HeaderMap::new();
    headers.insert(RETRY_AFTER, HeaderValue::from_static("999999"));

    let domain_error =
        DomainError::from_provider_http_response_status(StatusCode::TOO_MANY_REQUESTS, &headers);

    assert!(matches!(
        domain_error,
        DomainError::RateLimitWithRetryAfter {
            retry_after_seconds: PROVIDER_RETRY_AFTER_MAX_SECONDS,
            ..
        }
    ));
}

#[test]
fn provider_http_status_429_accepts_http_date_retry_after() {
    let mut headers = HeaderMap::new();
    headers.insert(
        RETRY_AFTER,
        HeaderValue::from_static("Thu, 01 Jan 2099 00:00:00 GMT"),
    );

    let domain_error =
        DomainError::from_provider_http_response_status(StatusCode::TOO_MANY_REQUESTS, &headers);

    assert!(matches!(
        domain_error,
        DomainError::RateLimitWithRetryAfter {
            retry_after_seconds: PROVIDER_RETRY_AFTER_MAX_SECONDS,
            ..
        }
    ));
}

#[test]
fn provider_http_status_429_past_http_date_retry_after_is_zero() {
    let mut headers = HeaderMap::new();
    headers.insert(
        RETRY_AFTER,
        HeaderValue::from_static("Wed, 01 Jan 2020 00:00:00 GMT"),
    );

    let domain_error =
        DomainError::from_provider_http_response_status(StatusCode::TOO_MANY_REQUESTS, &headers);

    assert!(matches!(
        domain_error,
        DomainError::RateLimitWithRetryAfter {
            retry_after_seconds: 0,
            ..
        }
    ));
}

#[test]
fn provider_http_status_429_ignores_invalid_retry_after() {
    let mut headers = HeaderMap::new();
    headers.insert(RETRY_AFTER, HeaderValue::from_static("not-a-date"));

    let domain_error =
        DomainError::from_provider_http_response_status(StatusCode::TOO_MANY_REQUESTS, &headers);

    assert_eq!(
        domain_error.to_string(),
        "Rate limit error: HTTP 429 Too Many Requests"
    );
}

#[test]
fn provider_block_response_contract_splits_backoff_user_action_and_manual_retry() {
    let cases = [
        (
            StatusCode::FORBIDDEN,
            true,
            AppRecoveryAction::EditAccountSettings,
            false,
        ),
        (
            StatusCode::TOO_MANY_REQUESTS,
            true,
            AppRecoveryAction::WaitForRetryWindow,
            false,
        ),
        (
            StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
            true,
            AppRecoveryAction::FixInput,
            false,
        ),
        (
            StatusCode::SERVICE_UNAVAILABLE,
            true,
            AppRecoveryAction::Retry,
            true,
        ),
    ];

    for (status, uses_sync_backoff, primary_user_action, manual_retry_allowed) in cases {
        let contract =
            provider_block_response_contract(status).expect("status should be classified");

        assert_eq!(contract.status, status);
        assert_eq!(contract.uses_sync_backoff, uses_sync_backoff);
        assert_eq!(contract.primary_user_action, primary_user_action);
        assert_eq!(contract.manual_retry_allowed, manual_retry_allowed);
    }
}

#[test]
fn platform_permission_denied_copy_is_action_specific() {
    let cases = [
        (
            PlatformPermissionDeniedSurface::File,
            "Choose a writable location or allow file access in the OS privacy settings.",
        ),
        (
            PlatformPermissionDeniedSurface::Dialog,
            "Allow the OS file dialog and choose the file again.",
        ),
        (
            PlatformPermissionDeniedSurface::Keyring,
            "Allow keyring access, then save or reconnect the account again.",
        ),
        (
            PlatformPermissionDeniedSurface::Clipboard,
            "Allow clipboard access, or copy the redacted log excerpt manually.",
        ),
    ];

    for (surface, expected_copy) in cases {
        assert_eq!(
            crate::domain::error::platform_permission_denied_user_action(surface),
            expected_copy
        );
    }

    let docs = include_str!("../../../../../docs/incident-runbook.md");
    for required in [
        "File permission denied",
        "Dialog permission denied",
        "Keyring permission denied",
        "Clipboard permission denied",
        "failure class and artifact class",
    ] {
        assert!(
            docs.contains(required),
            "missing permission denied support copy contract: {required}"
        );
    }
}
