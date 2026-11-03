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
#[cfg(test)]
pub(super) const MIGRATION_V27: &str =
    include_str!("../../../../migrations/V27__account_folder_order_mode.sql");

#[cfg(test)]
pub(super) const MIGRATION_V28: &str =
    include_str!("../../../../migrations/V28__article_state_change_times.sql");

#[cfg(test)]
pub(super) const MIGRATION_V29: &str =
    include_str!("../../../../migrations/V29__local_account_sync_entity_change_times.sql");

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
pub(super) const V27_FOLDER_ORDER_MODE_COLUMN: &str = "folder_order_mode";
pub(super) const V27_FOLDER_ORDER_MODE_SQL: &str =
    "ALTER TABLE accounts ADD COLUMN folder_order_mode TEXT NOT NULL DEFAULT 'name' CHECK (folder_order_mode IN ('name', 'manual'))";
pub(super) const V28_READ_CHANGED_AT_COLUMN: &str = "read_changed_at";
pub(super) const V28_READ_CHANGED_AT_SQL: &str =
    "ALTER TABLE articles ADD COLUMN read_changed_at TEXT";
pub(super) const V28_STARRED_CHANGED_AT_COLUMN: &str = "starred_changed_at";
pub(super) const V28_STARRED_CHANGED_AT_SQL: &str =
    "ALTER TABLE articles ADD COLUMN starred_changed_at TEXT";
/// Stamps the change time of is_read / is_starred on every write path. An UPDATE that sets
/// *_changed_at itself (local-sync import) is left as written.
pub(super) const V28_STAMP_TRIGGERS_SQL: &str = "
CREATE TRIGGER IF NOT EXISTS articles_stamp_read_changed_at
AFTER UPDATE OF is_read ON articles
FOR EACH ROW
WHEN NEW.is_read IS NOT OLD.is_read AND NEW.read_changed_at IS OLD.read_changed_at
BEGIN
    UPDATE articles
    SET read_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS articles_stamp_starred_changed_at
AFTER UPDATE OF is_starred ON articles
FOR EACH ROW
WHEN NEW.is_starred IS NOT OLD.is_starred AND NEW.starred_changed_at IS OLD.starred_changed_at
BEGIN
    UPDATE articles
    SET starred_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;
";
pub(super) const V29_CHANGED_AT_COLUMN: &str = "changed_at";
pub(super) const V29_FOLDERS_CHANGED_AT_SQL: &str =
    "ALTER TABLE folders ADD COLUMN changed_at TEXT";
pub(super) const V29_FEEDS_CHANGED_AT_SQL: &str = "ALTER TABLE feeds ADD COLUMN changed_at TEXT";
pub(super) const V29_TAGS_CHANGED_AT_SQL: &str = "ALTER TABLE tags ADD COLUMN changed_at TEXT";
pub(super) const V29_ARTICLE_TAGS_CHANGED_AT_SQL: &str =
    "ALTER TABLE article_tags ADD COLUMN changed_at TEXT";
/// Guard and tombstone storage for local-sync change tracking.
pub(super) const V29_LOCAL_SYNC_TABLES_SQL: &str = "
CREATE TABLE IF NOT EXISTS local_sync_apply_guard (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1))
);

INSERT OR IGNORE INTO local_sync_apply_guard (id, active) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS local_sync_tombstones (
    kind TEXT NOT NULL CHECK (kind IN ('folder', 'feed', 'tag', 'article_tag', 'mute_keyword')),
    account_id TEXT NOT NULL DEFAULT '',
    key TEXT NOT NULL,
    key2 TEXT NOT NULL DEFAULT '',
    removed_at TEXT NOT NULL,
    PRIMARY KEY (kind, account_id, key, key2)
);
";
/// Stamps entity change times and records local deletions. Every trigger is inactive while
/// local-sync import holds the apply guard, so import writes are never recorded as local changes.
pub(super) const V29_TRIGGERS_SQL: &str = "
CREATE TRIGGER IF NOT EXISTS folders_stamp_changed_at_on_insert
AFTER INSERT ON folders
FOR EACH ROW
WHEN NEW.changed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE folders
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS folders_stamp_changed_at_on_update
AFTER UPDATE OF name, sort_order ON folders
FOR EACH ROW
WHEN (NEW.name IS NOT OLD.name OR NEW.sort_order IS NOT OLD.sort_order)
    AND NEW.changed_at IS OLD.changed_at
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE folders
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS feeds_stamp_changed_at_on_update
AFTER UPDATE OF folder_id, title, url, site_url, icon_url ON feeds
FOR EACH ROW
WHEN (
        NEW.folder_id IS NOT OLD.folder_id
        OR NEW.title IS NOT OLD.title
        OR NEW.url IS NOT OLD.url
        OR NEW.site_url IS NOT OLD.site_url
        OR NEW.icon_url IS NOT OLD.icon_url
    )
    AND NEW.changed_at IS OLD.changed_at
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE feeds
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS feeds_stamp_changed_at_on_insert
AFTER INSERT ON feeds
FOR EACH ROW
WHEN NEW.changed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE feeds
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tags_stamp_changed_at_on_insert
AFTER INSERT ON tags
FOR EACH ROW
WHEN NEW.changed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE tags
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tags_stamp_changed_at_on_update
AFTER UPDATE OF name ON tags
FOR EACH ROW
WHEN NEW.name IS NOT OLD.name
    AND NEW.changed_at IS OLD.changed_at
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE tags
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS article_tags_stamp_changed_at_on_insert
AFTER INSERT ON article_tags
FOR EACH ROW
WHEN NEW.changed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE article_tags
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE article_id = NEW.article_id AND tag_id = NEW.tag_id;
END;

CREATE TRIGGER IF NOT EXISTS feeds_stamp_changed_at_on_folder_rename
AFTER UPDATE OF name ON folders
FOR EACH ROW
WHEN lower(trim(NEW.name)) <> lower(trim(OLD.name))
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE feeds
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE folder_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS folders_tombstone_on_delete
AFTER DELETE ON folders
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM accounts WHERE id = OLD.account_id)
    AND NOT EXISTS (
        SELECT 1 FROM folders
        WHERE account_id = OLD.account_id AND lower(trim(name)) = lower(trim(OLD.name))
    )
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('folder', OLD.account_id, lower(trim(OLD.name)), '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS folders_tombstone_on_rename
AFTER UPDATE OF name ON folders
FOR EACH ROW
WHEN lower(trim(NEW.name)) <> lower(trim(OLD.name))
    AND NOT EXISTS (
        SELECT 1 FROM folders
        WHERE account_id = OLD.account_id AND lower(trim(name)) = lower(trim(OLD.name))
    )
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('folder', OLD.account_id, lower(trim(OLD.name)), '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS folders_clear_tombstone_on_name
AFTER INSERT ON folders
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    DELETE FROM local_sync_tombstones
    WHERE kind = 'folder' AND account_id = NEW.account_id AND key = lower(trim(NEW.name));
END;

CREATE TRIGGER IF NOT EXISTS folders_clear_tombstone_on_rename
AFTER UPDATE OF name ON folders
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    DELETE FROM local_sync_tombstones
    WHERE kind = 'folder' AND account_id = NEW.account_id AND key = lower(trim(NEW.name));
END;

CREATE TRIGGER IF NOT EXISTS feeds_tombstone_on_delete
AFTER DELETE ON feeds
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM accounts WHERE id = OLD.account_id)
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('feed', OLD.account_id, OLD.url, '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS feeds_tombstone_on_url_change
AFTER UPDATE OF url ON feeds
FOR EACH ROW
WHEN NEW.url <> OLD.url
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('feed', OLD.account_id, OLD.url, '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS articles_stamp_changed_at_on_feed_url_change
AFTER UPDATE OF url ON feeds
FOR EACH ROW
WHEN NEW.url <> OLD.url
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE articles
    SET read_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE feed_id = NEW.id AND read_changed_at IS NOT NULL;
    UPDATE articles
    SET starred_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE feed_id = NEW.id AND starred_changed_at IS NOT NULL;
    UPDATE article_tags
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE changed_at IS NOT NULL
        AND article_id IN (SELECT id FROM articles WHERE feed_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS article_tags_stamp_changed_at_on_tag_rename
AFTER UPDATE OF name ON tags
FOR EACH ROW
WHEN lower(trim(NEW.name)) <> lower(trim(OLD.name))
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    UPDATE article_tags
    SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE tag_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS article_tag_tombstone_follow_tag_rename
AFTER UPDATE OF name ON tags
FOR EACH ROW
WHEN lower(trim(NEW.name)) <> lower(trim(OLD.name))
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    SELECT kind, account_id, key, lower(trim(NEW.name)), removed_at
    FROM local_sync_tombstones
    WHERE kind = 'article_tag' AND key2 = lower(trim(OLD.name))
    ON CONFLICT (kind, account_id, key, key2) DO UPDATE SET
        removed_at = max(local_sync_tombstones.removed_at, excluded.removed_at);
END;

CREATE TRIGGER IF NOT EXISTS article_tags_tombstone_on_tag_delete
BEFORE DELETE ON tags
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    SELECT 'article_tag', '', article_id, lower(trim(OLD.name)), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM article_tags
    WHERE tag_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS tags_tombstone_on_delete
AFTER DELETE ON tags
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('tag', '', lower(trim(OLD.name)), '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS tags_clear_tombstone_on_insert
AFTER INSERT ON tags
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    DELETE FROM local_sync_tombstones
    WHERE kind = 'tag' AND key = lower(trim(NEW.name));
END;

CREATE TRIGGER IF NOT EXISTS tags_tombstone_on_rename
AFTER UPDATE OF name ON tags
FOR EACH ROW
WHEN lower(trim(NEW.name)) <> lower(trim(OLD.name))
    AND NOT EXISTS (SELECT 1 FROM tags WHERE lower(trim(name)) = lower(trim(OLD.name)))
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('tag', '', lower(trim(OLD.name)), '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS tags_clear_tombstone_on_rename
AFTER UPDATE OF name ON tags
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    DELETE FROM local_sync_tombstones
    WHERE kind = 'tag' AND key = lower(trim(NEW.name));
END;

CREATE TRIGGER IF NOT EXISTS article_tags_tombstone_on_delete
AFTER DELETE ON article_tags
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM tags WHERE id = OLD.tag_id)
    AND EXISTS (SELECT 1 FROM articles WHERE id = OLD.article_id)
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES (
        'article_tag',
        '',
        OLD.article_id,
        (SELECT lower(trim(name)) FROM tags WHERE id = OLD.tag_id),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

CREATE TRIGGER IF NOT EXISTS article_tags_clear_tombstone_on_insert
AFTER INSERT ON article_tags
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    DELETE FROM local_sync_tombstones
    WHERE kind = 'article_tag'
        AND key = NEW.article_id
        AND key2 = (SELECT lower(trim(name)) FROM tags WHERE id = NEW.tag_id);
END;

CREATE TRIGGER IF NOT EXISTS mute_keywords_tombstone_on_delete
AFTER DELETE ON mute_keywords
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('mute_keyword', '', lower(trim(OLD.keyword)), OLD.scope, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS mute_keywords_clear_tombstone_on_insert
AFTER INSERT ON mute_keywords
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    DELETE FROM local_sync_tombstones
    WHERE kind = 'mute_keyword' AND key = lower(trim(NEW.keyword)) AND key2 = NEW.scope;
END;

CREATE TRIGGER IF NOT EXISTS mute_keywords_tombstone_on_update
AFTER UPDATE OF keyword, scope ON mute_keywords
FOR EACH ROW
WHEN (lower(trim(NEW.keyword)) <> lower(trim(OLD.keyword)) OR NEW.scope <> OLD.scope)
    AND NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    INSERT OR REPLACE INTO local_sync_tombstones (kind, account_id, key, key2, removed_at)
    VALUES ('mute_keyword', '', lower(trim(OLD.keyword)), OLD.scope, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS mute_keywords_clear_tombstone_on_update
AFTER UPDATE OF keyword, scope ON mute_keywords
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM local_sync_apply_guard WHERE active = 1)
BEGIN
    DELETE FROM local_sync_tombstones
    WHERE kind = 'mute_keyword' AND key = lower(trim(NEW.keyword)) AND key2 = NEW.scope;
END;
";
