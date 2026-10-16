use super::*;

#[test]
fn migration_error_message_does_not_suggest_deleting_restored_database() {
    let message = database_init_error_message(
        &DomainError::Migration(
            "Migration to v5 failed: duplicate column. Database restored to v4.".to_string(),
        ),
        Path::new("/tmp/ultra-rss-reader.db"),
    );

    assert!(
        !message.contains("try deleting the database file"),
        "migration recovery message should not suggest deleting the restored database: {message}"
    );
}

#[test]
fn migration_error_message_includes_restore_steps() {
    let message = database_init_error_message(
        &DomainError::Migration(
            "Migration to v5 failed: duplicate column. Database restored to v4.".to_string(),
        ),
        Path::new("/tmp/ultra-rss-reader.db"),
    );

    assert!(
        message.contains("restore the newest backup"),
        "migration recovery message should explain how to restore manually: {message}"
    );
}

#[test]
fn non_migration_error_message_keeps_database_deletion_guidance() {
    let message = database_init_error_message(
        &DomainError::Persistence("database is locked".to_string()),
        Path::new("/tmp/ultra-rss-reader.db"),
    );

    assert!(
        message.contains("Check OS permissions and available disk space"),
        "non-migration init errors should explain filesystem recovery: {message}"
    );
}

#[test]
fn user_facing_startup_paths_are_redacted_to_file_labels() {
    let path = Path::new("/Users/example/Library/Application Support/app/ultra-rss-reader.db");
    let message = database_init_error_message(
        &DomainError::Migration("migration failed".to_string()),
        path,
    );

    assert!(message.contains("[redacted parent]/ultra-rss-reader.db"));
    assert!(message.contains("[redacted parent]/backups"));
    assert!(!message.contains("/Users/example"));
}

#[test]
fn startup_shutdown_contract_database_init_error_is_recoverable_copy() {
    let db_path = Path::new("/Users/example/app/ultra-rss-reader.db");
    let migration = database_init_startup_error_message(
        &DomainError::Migration("duplicate column".to_string()),
        db_path,
    );
    let persistence = database_init_startup_error_message(
        &DomainError::Persistence("permission denied".to_string()),
        db_path,
    );

    assert!(migration.contains("restore the newest backup"));
    assert!(migration.contains("Backup directory"));
    assert!(migration.contains("contact support with this startup error text"));
    assert!(!migration.contains("startup filesystem access"));
    assert!(persistence.contains("Check OS permissions and available disk space"));
    assert!(persistence.contains("permission denied"));
    assert!(persistence.contains("contact support with this startup error text"));
    assert!(!persistence.contains("/Users/example"));
}

#[test]
fn startup_migration_recovery_message_matches_backup_restore_runbook_contract() {
    let db_path = Path::new("/Users/example/app/ultra-rss-reader.db");
    let message = database_init_startup_error_message(
        &DomainError::Migration("duplicate column at /Users/example/app/private.db".to_string()),
        db_path,
    );
    let incident_runbook = include_str!("../../../docs/incident-runbook.md");

    assert!(message.contains("Backup directory"));
    assert!(message.contains("Do not delete the database file"));
    assert!(message.contains("close it and restore the newest backup"));
    assert!(message.contains("[redacted parent]/ultra-rss-reader.db"));
    assert!(message.contains("[redacted parent]/backups"));
    assert!(!message.contains("/Users/example"));
    assert!(incident_runbook.contains("redacted database or backup label"));
    assert!(incident_runbook.contains("backup directory label"));
    assert!(incident_runbook.contains("Do not delete backup files"));
    assert!(incident_runbook.contains("complete backup set with the app closed"));
    assert!(incident_runbook.contains("do not edit `schema_version`"));
}

#[test]
fn db_recovery_startup_messages_keep_restore_copy_redacted() {
    let db_path = Path::new("/Users/example/app/ultra-rss-reader.db");

    for error in [
        DomainError::Migration(
            "Migration to v18 failed: duplicate column. Database restored to v17. Backup: [redacted parent]/ultra-rss-reader_v17_20260511T010203.db."
                .to_string(),
        ),
        DomainError::Persistence("permission denied".to_string()),
        DomainError::Migration(
            "SQLite integrity_check failed before restore for [redacted parent]/ultra-rss-reader_v17_20260511T010203.db: database disk image is malformed"
                .to_string(),
        ),
    ] {
        let message = database_init_startup_error_message(&error, db_path);

        assert!(
            message.contains("[redacted parent]/ultra-rss-reader.db"),
            "startup recovery message should show only a redacted database label: {message}"
        );
        assert!(
            !message.contains("/Users/example"),
            "startup recovery message must not expose raw local paths: {message}"
        );
        assert!(
            !message.contains("try deleting the database file"),
            "startup recovery message must not recommend deleting the database: {message}"
        );
    }
}

#[test]
fn incident_runbook_keeps_database_recovery_path_redaction_contract() {
    let incident_runbook = include_str!("../../../docs/incident-runbook.md");

    assert!(incident_runbook.contains("redacted database or backup label"));
    assert!(incident_runbook.contains("backup directory label"));
    assert!(!incident_runbook.contains("note the reported database or backup path"));
    assert!(!incident_runbook.contains("find the backup path"));
}
