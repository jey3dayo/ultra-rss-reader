ALTER TABLE accounts ADD COLUMN sync_enabled INTEGER NOT NULL DEFAULT 1;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (31);
