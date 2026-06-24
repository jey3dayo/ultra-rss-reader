use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use chrono::Utc;
use rusqlite::{params, TransactionBehavior};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::browser_webview::set_browser_webview_diagnostics_enabled;
use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::error::DomainError;
use crate::domain::mute_keyword::MuteKeywordScope;
use crate::domain::preference::preference_row_quarantine_reason;
use crate::domain::provider::ProviderKind;
use crate::domain::tag::Tag;
use crate::domain::types::{AccountId, TagId};
use crate::domain::url_policy::validate_http_url_without_credentials;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_mute_keyword::SqliteMuteKeywordRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::db::sqlite_tag::SqliteTagRepository;
use crate::repository::account::AccountRepository;
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::preference::PreferenceRepository;
use crate::repository::tag::TagRepository;

const SETTINGS_PROFILE_VERSION: u32 = 1;
const SETTINGS_PROFILE_CONTENT_TYPE: &str =
    "application/vnd.ultra-rss-reader.settings-profile+json";
const SELECTED_ACCOUNT_ID_KEY: &str = "selected_account_id";

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
struct SettingsProfile {
    version: u32,
    exported_at: String,
    content_type: String,
    preferences: HashMap<String, String>,
    accounts: Vec<SettingsProfileAccount>,
    tags: Vec<SettingsProfileTag>,
    mute_keywords: Vec<SettingsProfileMuteKeyword>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
struct SettingsProfileAccount {
    source_id: String,
    kind: ProviderKind,
    name: String,
    server_url: Option<String>,
    username: Option<String>,
    sync_interval_secs: i64,
    sync_on_startup: bool,
    sync_on_wake: bool,
    keep_read_items_days: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
struct SettingsProfileTag {
    name: String,
    color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
struct SettingsProfileMuteKeyword {
    keyword: String,
    scope: MuteKeywordScope,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq, Default)]
pub struct SettingsProfileImportResult {
    pub accounts_created: usize,
    pub accounts_updated: usize,
    pub preferences_imported: usize,
    pub preferences_skipped: usize,
    pub tags_created: usize,
    pub tags_updated: usize,
    pub mute_keywords_created: usize,
    pub mute_keywords_skipped: usize,
}

#[tauri::command]
pub fn export_settings_profile(state: State<'_, AppState>) -> Result<String, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    export_settings_profile_from_db(&db)
}

#[tauri::command]
pub fn export_settings_profile_to_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<(), AppError> {
    let path = validate_settings_profile_export_path(path)?;
    let db = crate::commands::lock_db(&state.db)?;
    export_settings_profile_to_file_from_db(&db, path)
}

#[tauri::command]
pub fn import_settings_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    profile_json: String,
) -> Result<SettingsProfileImportResult, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let (result, side_effects) = import_settings_profile_into_db(&db, &profile_json)?;
    apply_imported_preference_runtime_side_effects(&app, side_effects)?;
    Ok(result)
}

fn validate_settings_profile_export_path(path: String) -> Result<PathBuf, AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::UserVisible {
            message: "Settings profile export path cannot be empty".to_string(),
        });
    }
    Ok(PathBuf::from(trimmed))
}

fn export_settings_profile_to_file_from_db(
    db: &crate::infra::db::connection::DbManager,
    path: PathBuf,
) -> Result<(), AppError> {
    let profile_json = export_settings_profile_from_db(db)?;
    std::fs::write(&path, profile_json).map_err(|error| AppError::UserVisible {
        message: format!("Failed to write settings profile: {error}"),
    })
}

fn export_settings_profile_from_db(
    db: &crate::infra::db::connection::DbManager,
) -> Result<String, AppError> {
    let preferences = SqlitePreferenceRepository::new(db.reader()).get_all()?;
    let accounts = SqliteAccountRepository::new(db.reader())
        .find_all()?
        .into_iter()
        .filter(|account| !matches!(account.kind, ProviderKind::Quarantined))
        .map(account_to_profile_account)
        .collect();
    let tags = SqliteTagRepository::new(db.reader())
        .find_all()?
        .into_iter()
        .map(|tag| SettingsProfileTag {
            name: tag.name,
            color: tag.color,
        })
        .collect();
    let mute_keywords = SqliteMuteKeywordRepository::new(db.reader())
        .find_all()?
        .into_iter()
        .map(|rule| SettingsProfileMuteKeyword {
            keyword: rule.keyword,
            scope: rule.scope,
        })
        .collect();

    let profile = SettingsProfile {
        version: SETTINGS_PROFILE_VERSION,
        exported_at: Utc::now().to_rfc3339(),
        content_type: SETTINGS_PROFILE_CONTENT_TYPE.to_string(),
        preferences,
        accounts,
        tags,
        mute_keywords,
    };

    serde_json::to_string_pretty(&profile).map_err(|error| AppError::UserVisible {
        message: format!("Failed to export settings profile: {error}"),
    })
}

fn import_settings_profile_into_db(
    db: &crate::infra::db::connection::DbManager,
    profile_json: &str,
) -> Result<(SettingsProfileImportResult, ImportedPreferenceSideEffects), AppError> {
    let profile: SettingsProfile =
        serde_json::from_str(profile_json).map_err(|error| AppError::UserVisible {
            message: format!("Failed to parse settings profile: {error}"),
        })?;
    if profile.version != SETTINGS_PROFILE_VERSION {
        return Err(AppError::UserVisible {
            message: format!("Unsupported settings profile version: {}", profile.version),
        });
    }
    if profile.content_type != SETTINGS_PROFILE_CONTENT_TYPE {
        return Err(AppError::UserVisible {
            message: "Unsupported settings profile content type".to_string(),
        });
    }

    let tx = rusqlite::Transaction::new_unchecked(db.writer(), TransactionBehavior::Immediate)
        .map_err(DomainError::from)?;
    let mut result = SettingsProfileImportResult::default();

    let account_id_map = import_profile_accounts(&tx, &profile.accounts, &mut result)?;
    let side_effects =
        import_profile_preferences(&tx, &profile.preferences, &account_id_map, &mut result)?;
    import_profile_tags(&tx, &profile.tags, &mut result)?;
    import_profile_mute_keywords(&tx, &profile.mute_keywords, &mut result)?;

    tx.commit().map_err(DomainError::from)?;

    Ok((result, side_effects))
}

#[derive(Debug, Default)]
struct ImportedPreferenceSideEffects {
    menu_preferences: Option<HashMap<String, String>>,
    debug_browser_hud: Option<bool>,
}

fn account_to_profile_account(account: Account) -> SettingsProfileAccount {
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

fn import_profile_accounts(
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
    validate_http_url_without_credentials(&url).map_err(AppError::from)?;
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

fn import_profile_preferences(
    conn: &rusqlite::Connection,
    preferences: &HashMap<String, String>,
    account_id_map: &HashMap<String, AccountId>,
    result: &mut SettingsProfileImportResult,
) -> Result<ImportedPreferenceSideEffects, AppError> {
    let repo = SqlitePreferenceRepository::new(conn);
    let mut side_effects = ImportedPreferenceSideEffects::default();
    for (key, value) in preferences {
        let value = if key == SELECTED_ACCOUNT_ID_KEY {
            let Some(mapped_id) = account_id_map.get(value) else {
                result.preferences_skipped += 1;
                continue;
            };
            mapped_id.as_ref().to_string()
        } else {
            value.clone()
        };
        validate_preference_for_profile_import(key, &value)?;
        repo.set(key, &value)?;
        if key == "language" {
            side_effects.menu_preferences = Some(repo.get_all()?);
        } else if key == "debug_browser_hud" {
            side_effects.debug_browser_hud = Some(value == "true");
        }
        result.preferences_imported += 1;
    }
    Ok(side_effects)
}

fn validate_preference_for_profile_import(key: &str, value: &str) -> Result<(), AppError> {
    if let Some(reason) = preference_row_quarantine_reason(key, value) {
        return Err(AppError::UserVisible {
            message: reason.message(key),
        });
    }
    Ok(())
}

fn apply_imported_preference_runtime_side_effects(
    app: &AppHandle,
    side_effects: ImportedPreferenceSideEffects,
) -> Result<(), AppError> {
    if let Some(prefs) = side_effects.menu_preferences {
        crate::menu::rebuild(app, &prefs).map_err(|error| AppError::UserVisible {
            message: format!(
                "Imported settings profile, but failed to update the application menu: {error}"
            ),
        })?;
    }
    if let Some(enabled) = side_effects.debug_browser_hud {
        set_browser_webview_diagnostics_enabled(enabled);
    }
    Ok(())
}

fn import_profile_tags(
    conn: &rusqlite::Connection,
    tags: &[SettingsProfileTag],
    result: &mut SettingsProfileImportResult,
) -> Result<(), AppError> {
    let repo = SqliteTagRepository::new(conn);
    for tag in tags {
        let name = normalize_tag_name(&tag.name)?;
        let color = normalize_tag_color(tag.color.as_deref())?;
        if let Some(existing) = repo.find_by_name(&name)? {
            let updated = Tag {
                id: existing.id,
                name,
                color,
            };
            repo.save(&updated)?;
            result.tags_updated += 1;
        } else {
            repo.save(&Tag {
                id: TagId::new(),
                name,
                color,
            })?;
            result.tags_created += 1;
        }
    }
    Ok(())
}

fn normalize_tag_name(name: &str) -> Result<String, AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::UserVisible {
            message: "Tag name cannot be empty".to_string(),
        });
    }
    if name.chars().count() > 50 {
        return Err(AppError::UserVisible {
            message: "Tag name must be 50 characters or less".to_string(),
        });
    }
    Ok(name.to_string())
}

fn normalize_tag_color(color: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(color) = color else {
        return Ok(None);
    };
    let color = color.trim();
    if color.is_empty() {
        return Ok(None);
    }
    let bytes = color.as_bytes();
    if color.len() != 7 || bytes[0] != b'#' || !bytes[1..].iter().all(|b| b.is_ascii_hexdigit()) {
        return Err(AppError::UserVisible {
            message: "Color must be a valid hex color (e.g. #ff0000)".to_string(),
        });
    }
    Ok(Some(color.to_ascii_lowercase()))
}

fn import_profile_mute_keywords(
    conn: &rusqlite::Connection,
    mute_keywords: &[SettingsProfileMuteKeyword],
    result: &mut SettingsProfileImportResult,
) -> Result<(), AppError> {
    let repo = SqliteMuteKeywordRepository::new(conn);
    let mut existing_keys = repo
        .find_all()?
        .into_iter()
        .map(|rule| mute_keyword_identity(&rule.keyword, &rule.scope))
        .collect::<HashSet<_>>();

    for rule in mute_keywords {
        let keyword = rule.keyword.trim();
        let identity = mute_keyword_identity(keyword, &rule.scope);
        if existing_keys.contains(&identity) {
            result.mute_keywords_skipped += 1;
            continue;
        }
        repo.create(keyword, rule.scope.clone())?;
        existing_keys.insert(identity);
        result.mute_keywords_created += 1;
    }
    Ok(())
}

fn mute_keyword_identity(keyword: &str, scope: &MuteKeywordScope) -> (String, &'static str) {
    (keyword.trim().to_ascii_lowercase(), scope.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn insert_account(db: &DbManager, account: &Account) {
        SqliteAccountRepository::new(db.writer())
            .save(account)
            .unwrap();
    }

    fn local_account(id: &str, name: &str) -> Account {
        Account {
            id: AccountId(id.to_string()),
            kind: ProviderKind::Local,
            name: name.to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn freshrss_account(id: &str, name: &str, server_url: &str, username: &str) -> Account {
        Account {
            id: AccountId(id.to_string()),
            kind: ProviderKind::FreshRss,
            name: name.to_string(),
            server_url: Some(server_url.to_string()),
            username: Some(username.to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Verified,
            connection_verified_at: Some("2026-01-01T00:00:00Z".to_string()),
            connection_verification_error: Some("old".to_string()),
        }
    }

    fn profile_json(profile: SettingsProfile) -> String {
        serde_json::to_string(&profile).unwrap()
    }

    fn empty_profile() -> SettingsProfile {
        SettingsProfile {
            version: SETTINGS_PROFILE_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            content_type: SETTINGS_PROFILE_CONTENT_TYPE.to_string(),
            preferences: HashMap::new(),
            accounts: Vec::new(),
            tags: Vec::new(),
            mute_keywords: Vec::new(),
        }
    }

    #[test]
    fn export_profile_omits_credentials_and_article_dependent_data() {
        let db = test_db();
        insert_account(
            &db,
            &freshrss_account("acc-1", "Fresh", "https://rss.example.com", "alice"),
        );
        SqlitePreferenceRepository::new(db.writer())
            .set("theme", "dark")
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES ('feed-1', 'acc-1', 'Feed', 'https://example.com/feed.xml')",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO sync_state (account_id, scope_key, continuation) VALUES ('acc-1', '', 'secret-cursor')",
                [],
            )
            .unwrap();

        let exported = export_settings_profile_from_db(&db).unwrap();
        let profile: SettingsProfile = serde_json::from_str(&exported).unwrap();

        assert_eq!(profile.version, SETTINGS_PROFILE_VERSION);
        assert_eq!(
            profile.preferences.get("theme").map(String::as_str),
            Some("dark")
        );
        assert_eq!(profile.accounts.len(), 1);
        assert!(!exported.contains("secret-cursor"));
        assert!(!exported.contains("connection_verification"));
        assert!(!exported.contains("feeds"));
        assert!(!exported.contains("articles"));
    }

    #[test]
    fn export_profile_to_file_writes_selected_json_path() {
        let db = test_db();
        insert_account(&db, &local_account("acc-1", "Local"));
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("profile.json");

        export_settings_profile_to_file_from_db(&db, path.clone()).unwrap();

        let exported = std::fs::read_to_string(path).unwrap();
        let profile: SettingsProfile = serde_json::from_str(&exported).unwrap();
        assert_eq!(profile.version, SETTINGS_PROFILE_VERSION);
        assert_eq!(profile.accounts.len(), 1);
        assert_eq!(profile.accounts[0].name, "Local");
    }

    #[test]
    fn import_updates_matching_freshrss_account_without_preserving_verification() {
        let db = test_db();
        insert_account(
            &db,
            &freshrss_account("target", "Old", "https://rss.example.com", "alice"),
        );
        let mut profile = empty_profile();
        profile.accounts.push(SettingsProfileAccount {
            source_id: "source".to_string(),
            kind: ProviderKind::FreshRss,
            name: "New".to_string(),
            server_url: Some("https://rss.example.com/".to_string()),
            username: Some("alice".to_string()),
            sync_interval_secs: 7200,
            sync_on_startup: false,
            sync_on_wake: true,
            keep_read_items_days: 7,
        });

        let (result, _) = import_settings_profile_into_db(&db, &profile_json(profile)).unwrap();
        let accounts = SqliteAccountRepository::new(db.reader())
            .find_all()
            .unwrap();

        assert_eq!(result.accounts_updated, 1);
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].id.as_ref(), "target");
        assert_eq!(accounts[0].name, "New");
        assert_eq!(
            accounts[0].connection_verification_status,
            ConnectionVerificationStatus::Unverified
        );
        assert_eq!(accounts[0].connection_verified_at, None);
        assert_eq!(accounts[0].connection_verification_error, None);
    }

    #[test]
    fn import_matches_existing_freshrss_account_by_normalized_server_url() {
        let db = test_db();
        insert_account(
            &db,
            &freshrss_account("target", "Old", "https://rss.example.com/", "alice"),
        );
        let mut profile = empty_profile();
        profile.accounts.push(SettingsProfileAccount {
            source_id: "source".to_string(),
            kind: ProviderKind::FreshRss,
            name: "New".to_string(),
            server_url: Some("https://rss.example.com?ignored=true".to_string()),
            username: Some("alice".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
        });

        let (result, _) = import_settings_profile_into_db(&db, &profile_json(profile)).unwrap();
        let accounts = SqliteAccountRepository::new(db.reader())
            .find_all()
            .unwrap();

        assert_eq!(result.accounts_updated, 1);
        assert_eq!(result.accounts_created, 0);
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].id.as_ref(), "target");
        assert_eq!(
            accounts[0].server_url.as_deref(),
            Some("https://rss.example.com")
        );
    }

    #[test]
    fn import_local_accounts_match_by_name_without_collapsing_different_local_accounts() {
        let db = test_db();
        insert_account(&db, &local_account("local-1", "Personal"));
        insert_account(&db, &local_account("local-2", "Work"));
        let mut profile = empty_profile();
        profile.accounts.push(SettingsProfileAccount {
            source_id: "source-personal".to_string(),
            kind: ProviderKind::Local,
            name: "personal".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 1800,
            sync_on_startup: false,
            sync_on_wake: false,
            keep_read_items_days: 10,
        });

        let (result, _) = import_settings_profile_into_db(&db, &profile_json(profile)).unwrap();
        let accounts = SqliteAccountRepository::new(db.reader())
            .find_all()
            .unwrap();

        assert_eq!(result.accounts_updated, 1);
        assert_eq!(accounts.len(), 2);
        assert_eq!(
            accounts
                .iter()
                .find(|account| account.id.as_ref() == "local-1")
                .unwrap()
                .sync_interval_secs,
            1800
        );
    }

    #[test]
    fn import_maps_selected_account_id_from_source_to_target() {
        let db = test_db();
        let mut profile = empty_profile();
        profile.accounts.push(SettingsProfileAccount {
            source_id: "source-fresh".to_string(),
            kind: ProviderKind::FreshRss,
            name: "Fresh".to_string(),
            server_url: Some("https://rss.example.com".to_string()),
            username: Some("alice".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
        });
        profile.preferences.insert(
            SELECTED_ACCOUNT_ID_KEY.to_string(),
            "source-fresh".to_string(),
        );

        let (result, _) = import_settings_profile_into_db(&db, &profile_json(profile)).unwrap();
        let accounts = SqliteAccountRepository::new(db.reader())
            .find_all()
            .unwrap();
        let selected = SqlitePreferenceRepository::new(db.reader())
            .get(SELECTED_ACCOUNT_ID_KEY)
            .unwrap();

        assert_eq!(result.preferences_imported, 1);
        assert_eq!(selected.as_deref(), Some(accounts[0].id.as_ref()));
    }

    #[test]
    fn import_rolls_back_when_account_name_conflicts_with_different_identity() {
        let db = test_db();
        insert_account(
            &db,
            &freshrss_account("existing", "Fresh", "https://old.example.com", "alice"),
        );
        let mut profile = empty_profile();
        profile
            .preferences
            .insert("theme".to_string(), "dark".to_string());
        profile.accounts.push(SettingsProfileAccount {
            source_id: "source".to_string(),
            kind: ProviderKind::FreshRss,
            name: "Fresh".to_string(),
            server_url: Some("https://new.example.com".to_string()),
            username: Some("alice".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
        });

        let error = import_settings_profile_into_db(&db, &profile_json(profile)).unwrap_err();
        assert!(matches!(error, AppError::UserVisible { .. }));
        assert_eq!(
            SqlitePreferenceRepository::new(db.reader())
                .get("theme")
                .unwrap(),
            None
        );
        assert_eq!(
            SqliteAccountRepository::new(db.reader())
                .find_all()
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn import_merges_tags_and_mute_keywords_without_duplicates() {
        let db = test_db();
        SqliteTagRepository::new(db.writer())
            .save(&Tag {
                id: TagId("tag-1".to_string()),
                name: "Tech".to_string(),
                color: Some("#ff0000".to_string()),
            })
            .unwrap();
        SqliteMuteKeywordRepository::new(db.writer())
            .create("spoiler", MuteKeywordScope::Title)
            .unwrap();
        let mut profile = empty_profile();
        profile.tags.push(SettingsProfileTag {
            name: "tech".to_string(),
            color: Some("#00FF00".to_string()),
        });
        profile.tags.push(SettingsProfileTag {
            name: "News".to_string(),
            color: None,
        });
        profile.mute_keywords.push(SettingsProfileMuteKeyword {
            keyword: " SPOILER ".to_string(),
            scope: MuteKeywordScope::Title,
        });
        profile.mute_keywords.push(SettingsProfileMuteKeyword {
            keyword: "rumor".to_string(),
            scope: MuteKeywordScope::Body,
        });

        let (result, _) = import_settings_profile_into_db(&db, &profile_json(profile)).unwrap();
        let tags = SqliteTagRepository::new(db.reader()).find_all().unwrap();
        let rules = SqliteMuteKeywordRepository::new(db.reader())
            .find_all()
            .unwrap();

        assert_eq!(result.tags_updated, 1);
        assert_eq!(result.tags_created, 1);
        assert_eq!(result.mute_keywords_skipped, 1);
        assert_eq!(result.mute_keywords_created, 1);
        assert_eq!(tags.len(), 2);
        assert_eq!(
            tags.iter()
                .find(|tag| tag.name == "tech")
                .unwrap()
                .color
                .as_deref(),
            Some("#00ff00")
        );
        assert_eq!(rules.len(), 2);
    }

    #[test]
    fn import_collects_runtime_side_effects_for_language_and_debug_hud_preferences() {
        let db = test_db();
        let mut profile = empty_profile();
        profile
            .preferences
            .insert("language".to_string(), "en".to_string());
        profile
            .preferences
            .insert("debug_browser_hud".to_string(), "true".to_string());

        let (result, side_effects) =
            import_settings_profile_into_db(&db, &profile_json(profile)).unwrap();

        assert_eq!(result.preferences_imported, 2);
        assert_eq!(side_effects.debug_browser_hud, Some(true));
        assert_eq!(
            side_effects
                .menu_preferences
                .as_ref()
                .and_then(|prefs| prefs.get("language"))
                .map(String::as_str),
            Some("en")
        );
    }

    #[test]
    fn import_rejects_invalid_profile_metadata_and_invalid_preference() {
        let db = test_db();
        let mut profile = empty_profile();
        profile.version = 2;
        assert!(import_settings_profile_into_db(&db, &profile_json(profile)).is_err());

        let mut profile = empty_profile();
        profile.content_type = "application/json".to_string();
        assert!(import_settings_profile_into_db(&db, &profile_json(profile)).is_err());

        let mut profile = empty_profile();
        profile
            .preferences
            .insert("debug_browser_hud".to_string(), "TRUE".to_string());
        assert!(import_settings_profile_into_db(&db, &profile_json(profile)).is_err());
    }
}
