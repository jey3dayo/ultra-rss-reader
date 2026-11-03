-- destructive-migration: only trigger bodies delete rows (tombstone cleanup); existing data is untouched.
ALTER TABLE folders ADD COLUMN changed_at TEXT;
ALTER TABLE feeds ADD COLUMN changed_at TEXT;
ALTER TABLE tags ADD COLUMN changed_at TEXT;
ALTER TABLE article_tags ADD COLUMN changed_at TEXT;

CREATE TABLE IF NOT EXISTS local_sync_apply_guard (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1))
);

INSERT OR IGNORE INTO local_sync_apply_guard (id, active) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS local_sync_tombstones (
    kind TEXT NOT NULL CHECK (kind IN ('folder', 'tag', 'article_tag', 'mute_keyword')),
    account_id TEXT NOT NULL DEFAULT '',
    key TEXT NOT NULL,
    key2 TEXT NOT NULL DEFAULT '',
    removed_at TEXT NOT NULL,
    PRIMARY KEY (kind, account_id, key, key2)
);

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
AFTER UPDATE OF folder_id, title, site_url, icon_url ON feeds
FOR EACH ROW
WHEN (
        NEW.folder_id IS NOT OLD.folder_id
        OR NEW.title IS NOT OLD.title
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

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (29);
