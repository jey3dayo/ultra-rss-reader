ALTER TABLE accounts
ADD COLUMN connection_verification_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE accounts
ADD COLUMN connection_verified_at TEXT;

ALTER TABLE accounts
ADD COLUMN connection_verification_error TEXT;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (16);
