use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, TcpListener};

use crate::commands::dto::AppError;
use crate::domain::error::{
    any_loopback_socket_accepts_connection, classify_network_error,
    provider_block_response_contract, redact_sensitive_network_error_message, AppRecoveryAction,
    DomainError, FrontendNetworkSignal, NetworkErrorClassificationInput,
    PlatformPermissionDeniedSurface, PROVIDER_RETRY_AFTER_MAX_SECONDS,
};
use reqwest::{
    header::{HeaderMap, HeaderValue, RETRY_AFTER},
    StatusCode,
};

mod network_classification;
mod provider_errors;
mod signals_and_redaction;
