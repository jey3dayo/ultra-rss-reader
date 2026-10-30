ALTER TABLE articles ADD COLUMN read_changed_at TEXT;
ALTER TABLE articles ADD COLUMN starred_changed_at TEXT;

CREATE TRIGGER IF NOT EXISTS articles_stamp_read_changed_at
AFTER UPDATE OF is_read ON articles
FOR EACH ROW
WHEN NEW.is_read IS NOT OLD.is_read AND NEW.read_changed_at IS OLD.read_changed_at
BEGIN
    UPDATE articles
    SET read_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS articles_stamp_starred_changed_at
AFTER UPDATE OF is_starred ON articles
FOR EACH ROW
WHEN NEW.is_starred IS NOT OLD.is_starred AND NEW.starred_changed_at IS OLD.starred_changed_at
BEGIN
    UPDATE articles
    SET starred_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.id;
END;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (28);
