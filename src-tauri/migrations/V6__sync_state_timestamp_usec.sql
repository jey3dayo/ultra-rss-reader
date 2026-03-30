ALTER TABLE sync_state ADD COLUMN timestamp_usec INTEGER;

INSERT INTO schema_version VALUES (6);
