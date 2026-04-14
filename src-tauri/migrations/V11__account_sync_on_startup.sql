ALTER TABLE accounts ADD COLUMN sync_on_startup INTEGER NOT NULL DEFAULT 1;

DELETE FROM schema_version;
INSERT INTO schema_version VALUES (11);
