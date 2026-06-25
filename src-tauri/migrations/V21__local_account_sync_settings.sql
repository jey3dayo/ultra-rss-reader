CREATE TABLE IF NOT EXISTS local_account_sync_settings (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    sync_folder_path TEXT NOT NULL,
    sync_account_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_local_account_sync_settings_enabled
    ON local_account_sync_settings(enabled)
    WHERE enabled = 1;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (21);
