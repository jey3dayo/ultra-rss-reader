-- destructive-migration: replaces the folder name uniqueness scope.
-- Local-only and provider-managed folders may share a display name because
-- their identities and lifecycle are owned by different authorities.
DROP INDEX IF EXISTS idx_folders_account_name_nocase_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_account_name_nocase_unique
    ON folders(account_id, lower(name))
    WHERE remote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_account_local_name_nocase_unique
    ON folders(account_id, lower(name))
    WHERE remote_id IS NULL;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (25);
