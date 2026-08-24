use crate::domain::error::DomainError;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::domain::url_policy::{
    validate_user_provided_server_url, CREDENTIAL_URL_VALIDATION_MESSAGE,
    MISSING_HOST_URL_VALIDATION_MESSAGE, UNSUPPORTED_URL_VALIDATION_MESSAGE,
};

pub(crate) fn normalize_new_freshrss_server_url(server_url: &str) -> Result<String, AppError> {
    let trimmed = server_url.trim();
    let url = reqwest::Url::parse(trimmed).map_err(|_| AppError::UserVisible {
        message: "FreshRSS server URL must be a valid URL".into(),
    })?;

    validate_user_provided_server_url(&url).map_err(map_freshrss_url_validation_error)?;

    Ok(url.to_string())
}

fn map_freshrss_url_validation_error(error: DomainError) -> AppError {
    let message = match &error {
        DomainError::Validation(message) if message == UNSUPPORTED_URL_VALIDATION_MESSAGE => {
            Some("FreshRSS server URL must use http or https")
        }
        DomainError::Validation(message) if message == CREDENTIAL_URL_VALIDATION_MESSAGE => {
            Some("FreshRSS server URL must not include userinfo")
        }
        DomainError::Validation(message) if message == MISSING_HOST_URL_VALIDATION_MESSAGE => {
            Some("FreshRSS server URL must include a host")
        }
        _ => None,
    };

    message.map_or_else(
        || AppError::from(error),
        |message| AppError::UserVisible {
            message: message.to_string(),
        },
    )
}

pub(crate) fn validate_add_account_args(
    kind: &str,
    server_url: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<ProviderKind, AppError> {
    match kind {
        "Local" => Ok(ProviderKind::Local),
        "Quarantined" => Err(AppError::UserVisible {
            message: "Quarantined provider accounts cannot be created".into(),
        }),
        "FreshRss" => {
            if server_url.is_none_or(|value| value.trim().is_empty()) {
                return Err(AppError::UserVisible {
                    message: "FreshRSS server URL is required".into(),
                });
            }
            if username.is_none_or(|value| value.trim().is_empty()) {
                return Err(AppError::UserVisible {
                    message: "FreshRSS username is required".into(),
                });
            }
            if password.is_none_or(|value| value.trim().is_empty()) {
                return Err(AppError::UserVisible {
                    message: "FreshRSS password is required".into(),
                });
            }
            normalize_new_freshrss_server_url(server_url.unwrap())?;

            Ok(ProviderKind::FreshRss)
        }
        _ => Err(AppError::UserVisible {
            message: "Unknown provider kind".into(),
        }),
    }
}

pub(crate) fn validate_account_sync_settings(
    sync_interval_secs: i64,
    keep_read_items_days: i64,
) -> Result<(), AppError> {
    if !(60..=86_400).contains(&sync_interval_secs) {
        return Err(AppError::UserVisible {
            message: "Sync interval must be between 60 and 86400 seconds".into(),
        });
    }
    if !(0..=3650).contains(&keep_read_items_days) {
        return Err(AppError::UserVisible {
            message: "Keep read items days must be between 0 and 3650".into(),
        });
    }
    Ok(())
}

pub(crate) fn account_name_matches(left: &str, right: &str) -> bool {
    left.trim().eq_ignore_ascii_case(right.trim())
}

pub(crate) fn validate_account_name_with_excluded_id(
    name: &str,
    accounts: &[Account],
    excluded_id: Option<&AccountId>,
) -> Result<String, AppError> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::UserVisible {
            message: "Account name cannot be empty".into(),
        });
    }
    if name.chars().count() > 100 {
        return Err(AppError::UserVisible {
            message: "Account name must be 100 characters or less".into(),
        });
    }
    if accounts.iter().any(|account| {
        excluded_id.is_none_or(|excluded_id| account.id != *excluded_id)
            && account_name_matches(&account.name, &name)
    }) {
        return Err(AppError::UserVisible {
            message: format!("Account name \"{name}\" is already in use"),
        });
    }
    Ok(name)
}

pub(crate) fn validate_account_name(name: &str, accounts: &[Account]) -> Result<String, AppError> {
    validate_account_name_with_excluded_id(name, accounts, None)
}

pub(crate) fn validate_freshrss_server_url(account: &Account) -> Result<&str, AppError> {
    account
        .server_url
        .as_deref()
        .map(str::trim)
        .filter(|server_url| !server_url.is_empty())
        .ok_or_else(|| AppError::UserVisible {
            message: "FreshRSS server URL is not configured".into(),
        })
}

pub(crate) fn normalize_updated_account_server_url(
    account: &Account,
    server_url: Option<&str>,
) -> Result<Option<String>, AppError> {
    match account.kind {
        ProviderKind::FreshRss => {
            let server_url = server_url.ok_or_else(|| AppError::UserVisible {
                message: "FreshRSS server URL is required".into(),
            })?;
            if server_url.trim().is_empty() {
                return Err(AppError::UserVisible {
                    message: "FreshRSS server URL is required".into(),
                });
            }
            Ok(Some(normalize_new_freshrss_server_url(server_url)?))
        }
        ProviderKind::Local => Ok(server_url.map(ToOwned::to_owned)),
        ProviderKind::Quarantined => Ok(None),
    }
}
