-- Subscription age for the "no articles" review candidate. Existing feeds are stamped with the
-- migration time because their real subscription time is unknown. Imports and local-sync applies
-- stamp their own insert time, so re-importing a feed restarts its age.
ALTER TABLE feeds ADD COLUMN created_at TEXT;

UPDATE feeds SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

CREATE TRIGGER feeds_stamp_created_at_on_insert
AFTER INSERT ON feeds
FOR EACH ROW
WHEN NEW.created_at IS NULL
BEGIN
    UPDATE feeds
    SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (32);
