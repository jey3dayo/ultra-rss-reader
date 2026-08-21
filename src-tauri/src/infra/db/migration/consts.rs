pub(super) const MIGRATION_V1: &str = include_str!("../../../../migrations/V1__initial.sql");
pub(super) const MIGRATION_V2: &str = include_str!("../../../../migrations/V2__preferences.sql");
pub(super) const MIGRATION_V3: &str = include_str!("../../../../migrations/V3__fts5.sql");
pub(super) const MIGRATION_V4: &str = include_str!("../../../../migrations/V4__tags.sql");
pub(super) const MIGRATION_V5: &str =
    include_str!("../../../../migrations/V5__feed_display_mode.sql");
pub(super) const MIGRATION_V6: &str =
    include_str!("../../../../migrations/V6__sync_state_timestamp_usec.sql");
pub(super) const MIGRATION_V7: &str =
    include_str!("../../../../migrations/V7__feed_display_mode_inherit.sql");
pub(super) const MIGRATION_V9: &str =
    include_str!("../../../../migrations/V9__reader_preview_default_preferences.sql");
pub(super) const MIGRATION_V11: &str =
    include_str!("../../../../migrations/V11__account_sync_on_startup.sql");
pub(super) const MIGRATION_V12: &str =
    include_str!("../../../../migrations/V12__mute_keywords.sql");
pub(super) const MIGRATION_V13: &str =
    include_str!("../../../../migrations/V13__tag_color_palette_refresh.sql");
pub(super) const MIGRATION_V14: &str =
    include_str!("../../../../migrations/V14__article_content_text.sql");
pub(super) const MIGRATION_V15: &str =
    include_str!("../../../../migrations/V15__remove_inoreader.sql");
#[cfg(test)]
pub(super) const MIGRATION_V16: &str =
    include_str!("../../../../migrations/V16__account_connection_verification.sql");
pub(super) const MIGRATION_V17: &str =
    include_str!("../../../../migrations/V17__article_view_history.sql");
pub(super) const MIGRATION_V18: &str =
    include_str!("../../../../migrations/V18__db_repository_contracts.sql");
pub(super) const MIGRATION_V19: &str =
    include_str!("../../../../migrations/V19__article_list_ordered_indexes.sql");
pub(super) const MIGRATION_V20: &str =
    include_str!("../../../../migrations/V20__article_account_ordered_indexes.sql");
pub(super) const MIGRATION_V21: &str =
    include_str!("../../../../migrations/V21__local_account_sync_settings.sql");
#[cfg(test)]
pub(super) const MIGRATION_V22: &str =
    include_str!("../../../../migrations/V22__local_account_sync_export_state.sql");
pub(super) const MIGRATION_V23: &str =
    include_str!("../../../../migrations/V23__reset_empty_freshrss_feed_sync_state.sql");
#[cfg(test)]
pub(super) const MIGRATION_V24: &str =
    include_str!("../../../../migrations/V24__feed_icon_url.sql");
pub(super) const MIGRATION_V25: &str =
    include_str!("../../../../migrations/V25__folder_name_scope.sql");
pub(super) const MIGRATION_V26: &str =
    include_str!("../../../../migrations/V26__sanitizer_version_backfill_index.sql");

pub(super) const V8_READER_MODE_COLUMN: &str = "reader_mode";
pub(super) const V8_WEB_PREVIEW_MODE_COLUMN: &str = "web_preview_mode";
pub(super) const V16_CONNECTION_VERIFICATION_STATUS_COLUMN: &str = "connection_verification_status";
pub(super) const V16_CONNECTION_VERIFIED_AT_COLUMN: &str = "connection_verified_at";
pub(super) const V16_CONNECTION_VERIFICATION_ERROR_COLUMN: &str = "connection_verification_error";
pub(super) const V16_CONNECTION_VERIFICATION_STATUS_SQL: &str = "ALTER TABLE accounts ADD COLUMN connection_verification_status TEXT NOT NULL DEFAULT 'unverified'";
pub(super) const V16_CONNECTION_VERIFIED_AT_SQL: &str =
    "ALTER TABLE accounts ADD COLUMN connection_verified_at TEXT";
pub(super) const V16_CONNECTION_VERIFICATION_ERROR_SQL: &str =
    "ALTER TABLE accounts ADD COLUMN connection_verification_error TEXT";
pub(super) const V22_LAST_EXPORT_DIGEST_COLUMN: &str = "last_export_digest";
pub(super) const V22_LAST_EXPORT_DIGEST_SQL: &str =
    "ALTER TABLE local_account_sync_settings ADD COLUMN last_export_digest TEXT";
pub(super) const V24_FEED_ICON_URL_COLUMN: &str = "icon_url";
pub(super) const V24_FEED_ICON_URL_SQL: &str = "ALTER TABLE feeds ADD COLUMN icon_url TEXT";
