ALTER TABLE feeds ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'normal';

INSERT INTO schema_version (version) VALUES (5);
