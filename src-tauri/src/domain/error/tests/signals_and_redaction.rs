use super::*;

#[test]
fn frontend_offline_online_signal_is_only_a_hint_for_native_network_errors() {
    let docs = include_str!("../../../../../docs/incident-runbook.md");

    let offline = crate::domain::error::network_signal_contract(FrontendNetworkSignal::Offline);
    assert_eq!(offline.frontend_signal, FrontendNetworkSignal::Offline);
    assert!(offline.native_error_classification_is_authoritative);
    assert!(offline.suppresses_automatic_background_attempts);
    assert!(offline.allows_manual_retry);

    let online = crate::domain::error::network_signal_contract(FrontendNetworkSignal::Online);
    assert_eq!(online.frontend_signal, FrontendNetworkSignal::Online);
    assert!(online.native_error_classification_is_authoritative);
    assert!(!online.suppresses_automatic_background_attempts);
    assert!(online.allows_manual_retry);

    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "dns error while browser reported online",
            has_dns_error_marker: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Could not resolve the server name. Check the server URL or your DNS/network settings."
    );

    for required in [
        "frontend offline/online state as a trigger hint",
        "online === true",
        "native provider error for recovery category and retry/backoff decisions",
    ] {
        assert!(
            docs.contains(required),
            "missing offline/native network contract text: {required}"
        );
    }
}

#[test]
fn user_facing_error_correlation_contract_keeps_support_code_stable_and_diagnostics_ephemeral() {
    let docs = [
        include_str!("../../../../../docs/incident-runbook.md"),
        include_str!("../../../../../docs/feed-content-privacy.md"),
    ]
    .join("\n");

    for required in [
        "stable support code for the broad recovery area",
        "Diagnostics IDs are ephemeral log-correlation values",
        "must not encode private data",
        "must not be reused as stable user, device, account, or environment identifiers",
        "Recovery guidance must stay separate from raw diagnostic detail",
    ] {
        assert!(
            docs.contains(required),
            "missing user-facing error correlation contract: {required}"
        );
    }
}

#[test]
fn network_error_message_redacts_url_query_and_fragment_values() {
    let message = redact_sensitive_network_error_message(
        "request failed for https://example.com/feed?token=secret-token&api_key=raw-key#access_token=fragment-token",
    );

    assert_eq!(
        message,
        "request failed for https://example.com/feed?redacted#redacted"
    );
    assert!(!message.contains("secret-token"));
    assert!(!message.contains("raw-key"));
    assert!(!message.contains("fragment-token"));
}

#[test]
fn network_error_message_redacts_punctuated_sensitive_urls() {
    let message = redact_sensitive_network_error_message(
        "retryable error (https://example.com/path?password=hunter2), next retry soon",
    );

    assert_eq!(
        message,
        "retryable error (https://example.com/path?redacted), next retry soon"
    );
    assert!(!message.contains("hunter2"));
}

#[test]
fn network_error_message_redacts_unicode_punctuated_sensitive_urls() {
    let message = redact_sensitive_network_error_message(
        "接続失敗: https://example.com/path?password=hunter2。",
    );

    assert_eq!(message, "接続失敗: https://example.com/path?redacted。");
    assert!(!message.contains("hunter2"));
}

#[test]
fn network_error_message_redacts_multiline_sensitive_urls() {
    let message = redact_sensitive_network_error_message(
        "request failed:\nhttps://example.com/path?token=secret-token\nretry later",
    );

    assert_eq!(
        message,
        "request failed: https://example.com/path?redacted retry later"
    );
    assert!(!message.contains("secret-token"));
}

#[test]
fn network_error_message_redacts_url_userinfo_credentials() {
    let message = redact_sensitive_network_error_message(
        "request failed for https://alice:hunter2@example.com/feed",
    );

    assert_eq!(message, "request failed for https://example.com/feed");
    assert!(!message.contains("alice"));
    assert!(!message.contains("hunter2"));
}

#[test]
fn network_error_message_redacts_userinfo_with_query_and_fragment() {
    let message = redact_sensitive_network_error_message(
        "request failed for https://alice:hunter2@example.com/feed?token=secret#frag",
    );

    assert_eq!(
        message,
        "request failed for https://example.com/feed?redacted#redacted"
    );
    assert!(!message.contains("alice"));
    assert!(!message.contains("hunter2"));
    assert!(!message.contains("secret"));
}

#[test]
fn security_privacy_network_error_message_redacts_authorization_header_values() {
    let message = redact_sensitive_network_error_message(
        "upstream rejected request\nprovider Authorization: Bearer provider-secret\nretry later",
    );

    assert_eq!(
        message,
        "upstream rejected request provider authorization: <redacted> retry later"
    );
    assert!(!message.contains("provider-secret"));
    assert!(!message.contains("Bearer"));
}

#[test]
fn security_privacy_network_error_message_redacts_provider_auth_kv_tokens() {
    let message = redact_sensitive_network_error_message(
        "GReader auth failed with GoogleLogin auth=provider-auth-token token=raw-token",
    );

    assert_eq!(
        message,
        "GReader auth failed with GoogleLogin auth=<redacted> token=<redacted>"
    );
    assert!(!message.contains("provider-auth-token"));
    assert!(!message.contains("raw-token"));
}
