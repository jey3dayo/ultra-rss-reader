use std::net::IpAddr;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;

pub(crate) fn is_private_freshrss_ipv4(ip: std::net::Ipv4Addr) -> bool {
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
}

pub(crate) fn is_private_freshrss_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_private_freshrss_ipv4(ip),
        IpAddr::V6(ip) => {
            // IPv4-mapped IPv6 (::ffff:a.b.c.d) must be evaluated against the
            // same V4 policy as a bare IPv4 host, otherwise addresses like
            // ::ffff:127.0.0.1 or ::ffff:169.254.169.254 bypass the private-host
            // check that a plain IPv4 literal would fail.
            if let Some(v4) = ip.to_ipv4_mapped() {
                return is_private_freshrss_ipv4(v4);
            }

            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
        }
    }
}

pub(crate) fn normalize_new_freshrss_server_url(server_url: &str) -> Result<String, AppError> {
    let trimmed = server_url.trim();
    let url = reqwest::Url::parse(trimmed).map_err(|_| AppError::UserVisible {
        message: "FreshRSS server URL must be a valid URL".into(),
    })?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(AppError::UserVisible {
            message: "FreshRSS server URL must use http or https".into(),
        });
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::UserVisible {
            message: "FreshRSS server URL must not include userinfo".into(),
        });
    }

    let host = url.host_str().ok_or_else(|| AppError::UserVisible {
        message: "FreshRSS server URL must include a host".into(),
    })?;
    let ip_host = host.trim_start_matches('[').trim_end_matches(']');
    if host.eq_ignore_ascii_case("localhost")
        || ip_host.parse::<IpAddr>().is_ok_and(is_private_freshrss_ip)
    {
        return Err(AppError::UserVisible {
            message: "FreshRSS server URL must not use a private host".into(),
        });
    }

    Ok(url.to_string())
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
