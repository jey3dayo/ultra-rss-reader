ALTER TABLE accounts ADD COLUMN folder_order_mode TEXT NOT NULL DEFAULT 'name' CHECK (folder_order_mode IN ('name', 'manual'));

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (27);
