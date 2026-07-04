ALTER TABLE local_account_sync_settings ADD COLUMN last_export_digest TEXT;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (22);
