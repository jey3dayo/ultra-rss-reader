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
fn import_rejects_oversized_profile_before_parsing_without_mutating_db() {
    let db = test_db();
    insert_account(&db, &local_account("existing", "Existing"));
    SqlitePreferenceRepository::new(db.writer())
        .set("theme", "dark")
        .unwrap();

    let oversized_profile = "x".repeat(SETTINGS_PROFILE_IMPORT_MAX_BYTES + 1);
    let error = import_settings_profile_into_db(&db, &oversized_profile).unwrap_err();

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == format!(
                "Settings profile import file must be {SETTINGS_PROFILE_IMPORT_MAX_BYTES} UTF-8 bytes or less"
            )
    ));
    assert_eq!(
        SqlitePreferenceRepository::new(db.reader())
            .get_all()
            .unwrap()
            .len(),
        1
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
fn import_allows_explicit_private_freshrss_server_url() {
    let db = test_db();
    let mut profile = empty_profile();
    profile.accounts.push(SettingsProfileAccount {
        source_id: "source".to_string(),
        kind: ProviderKind::FreshRss,
        name: "NAS FreshRSS".to_string(),
        server_url: Some("https://nas.local:8080".to_string()),
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

    assert_eq!(result.accounts_created, 1);
    assert_eq!(
        accounts[0].server_url.as_deref(),
        Some("https://nas.local:8080")
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
