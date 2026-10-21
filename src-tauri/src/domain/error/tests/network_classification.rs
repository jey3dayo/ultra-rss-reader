use super::*;

#[test]
fn network_error_classification_maps_resolution_failures_to_actionable_message() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "request failed before DNS resolution",
            has_resolution_failed: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Could not resolve the server name. Check the server URL or your DNS/network settings."
    );
}

#[test]
fn network_error_classification_maps_dns_markers_to_actionable_message() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "request failed without a URL",
            has_dns_error_marker: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Could not resolve the server name. Check the server URL or your DNS/network settings."
    );
}

#[test]
fn network_error_classification_maps_tls_certificate_failures_to_actionable_message() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "certificate has expired",
            has_tls_certificate_error_marker: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Could not verify the server certificate. Check the server certificate or account URL."
    );
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "self signed certificate",
            has_tls_certificate_error_marker: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Could not verify the server certificate. Check the server certificate or account URL."
    );
}

#[test]
fn network_error_classification_maps_connection_reset_to_actionable_message() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "connection reset by peer",
            has_connection_reset_error_marker: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "The server closed the connection unexpectedly. Check the server status and try again."
    );
}

#[test]
fn network_error_classification_keeps_loopback_connectivity_timeout_as_connectivity_failure() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "request timed out while probing a closed loopback port",
            is_loopback_connectivity_timeout: true,
            is_timeout: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Could not connect to the server. Check the server URL and whether the server is reachable."
    );
}

#[test]
fn network_error_classification_maps_response_timeouts_to_timeout_message() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "request timed out waiting for a response",
            is_timeout: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Request timed out. Check the server URL or your network connection."
    );
}

#[test]
fn network_error_classification_maps_connect_errors_to_connectivity_failure() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "connection refused",
            is_connect: true,
            ..NetworkErrorClassificationInput::default()
        }),
        "Could not connect to the server. Check the server URL and whether the server is reachable."
    );
}

#[test]
fn network_error_classification_redacts_fallback_messages() {
    assert_eq!(
        classify_network_error(NetworkErrorClassificationInput {
            message: "request failed for https://example.test/feed?token=secret#section",
            ..NetworkErrorClassificationInput::default()
        }),
        "request failed for https://example.test/feed?redacted#redacted"
    );
}

#[test]
fn fallback_network_errors_do_not_surface_sensitive_url_parts_as_retryable_messages() {
    let message = classify_network_error(NetworkErrorClassificationInput {
        message: "request failed for https://example.test/feed?token=secret-token&api_key=raw-key#access-token",
        ..NetworkErrorClassificationInput::default()
    });

    assert!(!message.is_empty());
    assert!(!message.contains("secret-token"));
    assert!(!message.contains("raw-key"));
    assert!(!message.contains("access-token"));

    match AppError::from(DomainError::Network(message)) {
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            assert!(!message.contains("secret-token"));
            assert!(!message.contains("raw-key"));
            assert!(!message.contains("access-token"));
        }
        AppError::UserVisible { message } | AppError::CredentialStore { message, .. } => {
            panic!("network fallback errors should remain retryable: {message}");
        }
    }
}

#[test]
fn loopback_probe_checks_all_resolved_addresses_before_classifying_connectivity_failure() {
    let listener =
        TcpListener::bind("127.0.0.1:0").expect("listener should bind to an ephemeral port");
    let port = listener
        .local_addr()
        .expect("listener should expose its bound address")
        .port();
    let addrs = [
        SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), port),
        SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port),
    ];

    assert!(any_loopback_socket_accepts_connection(addrs));
}
