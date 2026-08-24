use super::*;

pub(super) fn account_to_profile_account(account: Account) -> SettingsProfileAccount {
    SettingsProfileAccount {
        source_id: account.id.0,
        kind: account.kind,
        name: account.name,
        server_url: account.server_url,
        username: account.username,
        sync_interval_secs: account.sync_interval_secs,
        sync_on_startup: account.sync_on_startup,
        sync_on_wake: account.sync_on_wake,
        keep_read_items_days: account.keep_read_items_days,
    }
}

pub(super) fn import_profile_accounts(
    conn: &rusqlite::Connection,
    profile_accounts: &[SettingsProfileAccount],
    result: &mut SettingsProfileImportResult,
) -> Result<HashMap<String, AccountId>, AppError> {
    let account_repo = SqliteAccountRepository::new(conn);
    let mut existing_accounts = account_repo.find_all()?;
    let mut id_map = HashMap::new();

    for profile_account in profile_accounts {
        let normalized = normalize_profile_account(profile_account)?;
        let matching_id = find_matching_account(&existing_accounts, &normalized)?;
        let target_account = if let Some(existing_id) = matching_id {
            ensure_account_name_is_available(
                &existing_accounts,
                &normalized.name,
                Some(&existing_id),
            )?;
            let account = Account {
                id: existing_id,
                kind: normalized.kind.clone(),
                name: normalized.name,
                server_url: normalized.server_url,
                username: normalized.username,
                sync_interval_secs: normalized.sync_interval_secs,
                sync_on_startup: normalized.sync_on_startup,
                sync_on_wake: normalized.sync_on_wake,
                keep_read_items_days: normalized.keep_read_items_days,
                connection_verification_status: ConnectionVerificationStatus::Unverified,
                connection_verified_at: None,
                connection_verification_error: None,
            };
            upsert_imported_account(conn, &account)?;
            result.accounts_updated += 1;
            account
        } else {
            ensure_account_name_is_available(&existing_accounts, &normalized.name, None)?;
            let account = Account {
                id: AccountId::new(),
                kind: normalized.kind.clone(),
                name: normalized.name,
                server_url: normalized.server_url,
                username: normalized.username,
                sync_interval_secs: normalized.sync_interval_secs,
                sync_on_startup: normalized.sync_on_startup,
                sync_on_wake: normalized.sync_on_wake,
                keep_read_items_days: normalized.keep_read_items_days,
                connection_verification_status: ConnectionVerificationStatus::Unverified,
                connection_verified_at: None,
                connection_verification_error: None,
            };
            upsert_imported_account(conn, &account)?;
            result.accounts_created += 1;
            account
        };

        id_map.insert(profile_account.source_id.clone(), target_account.id.clone());
        existing_accounts = account_repo.find_all()?;
    }

    Ok(id_map)
}

fn normalize_profile_account(
    account: &SettingsProfileAccount,
) -> Result<SettingsProfileAccount, AppError> {
    validate_profile_account_sync_settings(
        account.sync_interval_secs,
        account.keep_read_items_days,
    )?;
    let name = normalize_account_name(&account.name)?;
    match account.kind {
        ProviderKind::Local => Ok(SettingsProfileAccount {
            source_id: account.source_id.clone(),
            kind: ProviderKind::Local,
            name,
            server_url: None,
            username: None,
            sync_interval_secs: account.sync_interval_secs,
            sync_on_startup: account.sync_on_startup,
            sync_on_wake: account.sync_on_wake,
            keep_read_items_days: account.keep_read_items_days,
        }),
        ProviderKind::FreshRss => {
            let server_url = normalize_freshrss_profile_server_url(account.server_url.as_deref())?;
            let username = account
                .username
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| AppError::UserVisible {
                    message: "FreshRSS username is required in settings profile".to_string(),
                })?
                .to_string();
            Ok(SettingsProfileAccount {
                source_id: account.source_id.clone(),
                kind: ProviderKind::FreshRss,
                name,
                server_url: Some(server_url),
                username: Some(username),
                sync_interval_secs: account.sync_interval_secs,
                sync_on_startup: account.sync_on_startup,
                sync_on_wake: account.sync_on_wake,
                keep_read_items_days: account.keep_read_items_days,
            })
        }
        ProviderKind::Quarantined => Err(AppError::UserVisible {
            message: "Quarantined accounts cannot be imported from a settings profile".to_string(),
        }),
    }
}

fn validate_profile_account_sync_settings(
    sync_interval_secs: i64,
    keep_read_items_days: i64,
) -> Result<(), AppError> {
    if !(60..=86_400).contains(&sync_interval_secs) {
        return Err(AppError::UserVisible {
            message: "Sync interval must be between 60 and 86400 seconds".to_string(),
        });
    }
    if !(0..=3650).contains(&keep_read_items_days) {
        return Err(AppError::UserVisible {
            message: "Keep read items days must be between 0 and 3650".to_string(),
        });
    }
    Ok(())
}

fn upsert_imported_account(conn: &rusqlite::Connection, account: &Account) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO accounts (
            id,
            kind,
            name,
            server_url,
            username,
            sync_interval_secs,
            sync_on_startup,
            sync_on_wake,
            keep_read_items_days,
            connection_verification_status,
            connection_verified_at,
            connection_verification_error
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'unverified', NULL, NULL)
         ON CONFLICT(id) DO UPDATE SET
            kind = excluded.kind,
            name = excluded.name,
            server_url = excluded.server_url,
            username = excluded.username,
            sync_interval_secs = excluded.sync_interval_secs,
            sync_on_startup = excluded.sync_on_startup,
            sync_on_wake = excluded.sync_on_wake,
            keep_read_items_days = excluded.keep_read_items_days,
            connection_verification_status = 'unverified',
            connection_verified_at = NULL,
            connection_verification_error = NULL",
        params![
            account.id.0,
            provider_kind_to_db_str(&account.kind),
            account.name,
            account.server_url,
            account.username,
            account.sync_interval_secs,
            account.sync_on_startup,
            account.sync_on_wake,
            account.keep_read_items_days,
        ],
    )
    .map_err(DomainError::from)?;
    Ok(())
}

fn provider_kind_to_db_str(kind: &ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Local => "Local",
        ProviderKind::FreshRss => "FreshRss",
        ProviderKind::Quarantined => "Quarantined",
    }
}

fn normalize_account_name(name: &str) -> Result<String, AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::UserVisible {
            message: "Account name cannot be empty".to_string(),
        });
    }
    if name.chars().count() > 100 {
        return Err(AppError::UserVisible {
            message: "Account name must be 100 characters or less".to_string(),
        });
    }
    Ok(name.to_string())
}

fn normalize_freshrss_profile_server_url(server_url: Option<&str>) -> Result<String, AppError> {
    let Some(server_url) = server_url else {
        return Err(AppError::UserVisible {
            message: "FreshRSS server URL is required in settings profile".to_string(),
        });
    };
    let mut url = reqwest::Url::parse(server_url.trim()).map_err(|_| AppError::UserVisible {
        message: "FreshRSS server URL must be a valid http:// or https:// URL".to_string(),
    })?;
    validate_user_provided_server_url(&url).map_err(AppError::from)?;
    url.set_fragment(None);
    url.set_query(None);
    let mut normalized = url.to_string();
    while normalized.ends_with('/') {
        normalized.pop();
    }
    Ok(normalized)
}

fn find_matching_account(
    existing_accounts: &[Account],
    profile_account: &SettingsProfileAccount,
) -> Result<Option<AccountId>, AppError> {
    let matches = existing_accounts
        .iter()
        .filter(|existing| account_matches_profile_identity(existing, profile_account))
        .map(|account| account.id.clone())
        .collect::<Vec<_>>();
    if matches.len() > 1 {
        return Err(AppError::UserVisible {
            message: format!(
                "Multiple accounts match settings profile identity for {}",
                profile_account.name
            ),
        });
    }
    Ok(matches.into_iter().next())
}

fn account_matches_profile_identity(
    existing: &Account,
    profile_account: &SettingsProfileAccount,
) -> bool {
    match profile_account.kind {
        ProviderKind::Local => {
            matches!(existing.kind, ProviderKind::Local)
                && existing.name.eq_ignore_ascii_case(&profile_account.name)
        }
        ProviderKind::FreshRss => {
            let existing_server_url = existing.server_url.as_deref().and_then(|server_url| {
                normalize_freshrss_profile_server_url(Some(server_url)).ok()
            });
            matches!(existing.kind, ProviderKind::FreshRss)
                && existing_server_url.as_deref() == profile_account.server_url.as_deref()
                && existing.username.as_deref() == profile_account.username.as_deref()
        }
        ProviderKind::Quarantined => false,
    }
}

fn ensure_account_name_is_available(
    existing_accounts: &[Account],
    name: &str,
    allowed_id: Option<&AccountId>,
) -> Result<(), AppError> {
    if existing_accounts.iter().any(|existing| {
        allowed_id != Some(&existing.id) && existing.name.eq_ignore_ascii_case(name)
    }) {
        return Err(AppError::UserVisible {
            message: format!("Account name \"{name}\" already exists"),
        });
    }
    Ok(())
}
