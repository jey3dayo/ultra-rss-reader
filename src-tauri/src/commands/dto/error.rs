use serde::Serialize;

use crate::domain::error::DomainError;

pub const APP_ERROR_MESSAGE_MAX_CHARS: usize = 2048;
const APP_ERROR_FALLBACK_MESSAGE: &str = "An application error occurred";

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum AppError {
    UserVisible {
        message: String,
    },
    Retryable {
        message: String,
    },
    #[serde(rename = "Retryable")]
    RetryableWithMetadata {
        message: String,
        retry_after_seconds: Option<u64>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserFacingErrorSupportPolicy {
    StableSupportCodeOnly,
    EphemeralDiagnosticsIdForLogs,
}

pub fn user_facing_error_support_policy(error: &AppError) -> UserFacingErrorSupportPolicy {
    match error {
        AppError::UserVisible { .. } => UserFacingErrorSupportPolicy::StableSupportCodeOnly,
        AppError::Retryable { .. } | AppError::RetryableWithMetadata { .. } => {
            UserFacingErrorSupportPolicy::EphemeralDiagnosticsIdForLogs
        }
    }
}

fn non_empty_app_error_message(message: String) -> String {
    let sanitized: String = message
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .take(APP_ERROR_MESSAGE_MAX_CHARS)
        .collect();

    if sanitized.trim().is_empty() {
        APP_ERROR_FALLBACK_MESSAGE.to_string()
    } else {
        sanitized
    }
}

impl From<DomainError> for AppError {
    fn from(e: DomainError) -> Self {
        let message = non_empty_app_error_message(e.to_string());
        match &e {
            DomainError::Network(_) | DomainError::RateLimit(_) => AppError::Retryable { message },
            DomainError::RateLimitWithRetryAfter {
                retry_after_seconds,
                ..
            } => AppError::RetryableWithMetadata {
                message,
                retry_after_seconds: Some(*retry_after_seconds),
            },
            _ => AppError::UserVisible { message },
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::UserVisible { message }
            | AppError::Retryable { message }
            | AppError::RetryableWithMetadata { message, .. } => {
                write!(f, "{}", message)
            }
        }
    }
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SyncIssueOwner {
    Account,
    Feed,
    Credential,
    Scheduler,
}

pub fn sync_issue_owner_for_app_error(error: &AppError) -> SyncIssueOwner {
    let message = error.to_string();
    if message.starts_with("Auth error:") {
        SyncIssueOwner::Credential
    } else if message.starts_with("Rate limit error:")
        || matches!(
            error,
            AppError::Retryable { .. } | AppError::RetryableWithMetadata { .. }
        )
    {
        SyncIssueOwner::Scheduler
    } else {
        SyncIssueOwner::Account
    }
}

#[cfg(test)]
mod tests {
    use super::{
        sync_issue_owner_for_app_error, user_facing_error_support_policy, AppError, SyncIssueOwner,
        UserFacingErrorSupportPolicy,
    };
    use crate::domain::error::DomainError;

    #[test]
    fn domain_network_error_maps_to_retryable_app_error() {
        let app_error = AppError::from(DomainError::Network("timeout".to_string()));

        match app_error {
            AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
                assert_eq!(message, "Network error: timeout");
            }
            AppError::UserVisible { message } => {
                panic!("network errors should be retryable, got user-visible: {message}");
            }
        }
    }

    #[test]
    fn domain_non_network_errors_map_to_user_visible_app_errors() {
        let errors = [
            DomainError::Parse("bad feed".to_string()),
            DomainError::Persistence("database locked".to_string()),
            DomainError::Auth("unauthorized".to_string()),
            DomainError::Validation("missing url".to_string()),
            DomainError::Keychain("missing secret".to_string()),
            DomainError::Migration("failed migration".to_string()),
        ];

        for domain_error in errors {
            let expected_message = domain_error.to_string();
            let app_error = AppError::from(domain_error);

            match app_error {
                AppError::UserVisible { message } => {
                    assert_eq!(message, expected_message);
                }
                AppError::Retryable { message }
                | AppError::RetryableWithMetadata { message, .. } => {
                    panic!("non-network errors should be user-visible, got retryable: {message}");
                }
            }
        }
    }

    #[test]
    fn domain_error_conversion_never_returns_blank_app_error_messages() {
        let errors = [
            DomainError::Network(String::new()),
            DomainError::RateLimit("   ".to_string()),
            DomainError::Parse(String::new()),
            DomainError::Persistence("   ".to_string()),
            DomainError::Auth(String::new()),
            DomainError::Validation("   ".to_string()),
            DomainError::Keychain(String::new()),
            DomainError::Migration("   ".to_string()),
        ];

        for domain_error in errors {
            let app_error = AppError::from(domain_error);
            let message = match app_error {
                AppError::UserVisible { message }
                | AppError::Retryable { message }
                | AppError::RetryableWithMetadata { message, .. } => message,
            };

            assert!(
                !message.trim().is_empty(),
                "AppError message should not be blank"
            );
        }
    }

    #[test]
    fn sync_issue_owner_for_app_error_separates_provider_block_recovery_surface() {
        let cases = [
            (
                AppError::from(DomainError::Auth("HTTP 403 Forbidden".to_string())),
                SyncIssueOwner::Credential,
            ),
            (
                AppError::from(DomainError::RateLimitWithRetryAfter {
                    message: "HTTP 429 Too Many Requests".to_string(),
                    retry_after_seconds: 120,
                }),
                SyncIssueOwner::Scheduler,
            ),
            (
                AppError::from(DomainError::Validation(
                    "HTTP 451 Unavailable For Legal Reasons".to_string(),
                )),
                SyncIssueOwner::Account,
            ),
            (
                AppError::from(DomainError::Network(
                    "HTTP 503 Service Unavailable".to_string(),
                )),
                SyncIssueOwner::Scheduler,
            ),
        ];

        for (error, expected_owner) in cases {
            assert_eq!(sync_issue_owner_for_app_error(&error), expected_owner);
        }
    }

    #[test]
    fn app_error_message_normalizer_falls_back_for_blank_messages() {
        assert_eq!(
            super::non_empty_app_error_message(String::new()),
            "An application error occurred"
        );
        assert_eq!(
            super::non_empty_app_error_message("   ".to_string()),
            "An application error occurred"
        );
        assert_eq!(
            super::non_empty_app_error_message("visible message".to_string()),
            "visible message"
        );
    }

    #[test]
    fn app_error_message_normalizer_removes_control_characters_and_caps_length() {
        assert_eq!(
            super::non_empty_app_error_message("line 1\nline 2\u{0000}".to_string()),
            "line 1 line 2 "
        );

        let message = "x".repeat(super::APP_ERROR_MESSAGE_MAX_CHARS + 1);
        assert_eq!(
            super::non_empty_app_error_message(message).chars().count(),
            super::APP_ERROR_MESSAGE_MAX_CHARS
        );
    }

    #[test]
    fn user_facing_error_support_policy_keeps_wire_shape_stable() {
        assert_eq!(
            user_facing_error_support_policy(&AppError::UserVisible {
                message: "Database needs recovery".to_string(),
            }),
            UserFacingErrorSupportPolicy::StableSupportCodeOnly
        );
        assert_eq!(
            user_facing_error_support_policy(&AppError::Retryable {
                message: "Network error: timeout".to_string(),
            }),
            UserFacingErrorSupportPolicy::EphemeralDiagnosticsIdForLogs
        );
    }
}
