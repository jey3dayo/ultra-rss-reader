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
use crate::domain::url_policy::validate_user_provided_server_url;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_mute_keyword::SqliteMuteKeywordRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::db::sqlite_tag::SqliteTagRepository;
use crate::repository::account::AccountRepository;
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::preference::PreferenceRepository;
use crate::repository::tag::TagRepository;

mod accounts;

const SETTINGS_PROFILE_VERSION: u32 = 1;
const SETTINGS_PROFILE_CONTENT_TYPE: &str =
    "application/vnd.ultra-rss-reader.settings-profile+json";
const SELECTED_ACCOUNT_ID_KEY: &str = "selected_account_id";
// Must stay aligned with SETTINGS_PROFILE_IMPORT_MAX_BYTES in src/api/schemas/commands/settings-profile.ts.
pub(crate) const SETTINGS_PROFILE_IMPORT_MAX_BYTES: usize = 1024 * 1024;

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
        .map(accounts::account_to_profile_account)
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
    if profile_json.len() > SETTINGS_PROFILE_IMPORT_MAX_BYTES {
        return Err(AppError::UserVisible {
            message: format!(
                "Settings profile import file must be {SETTINGS_PROFILE_IMPORT_MAX_BYTES} UTF-8 bytes or less"
            ),
        });
    }

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

    let account_id_map = accounts::import_profile_accounts(&tx, &profile.accounts, &mut result)?;
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
mod tests;
