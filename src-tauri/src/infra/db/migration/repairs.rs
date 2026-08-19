use rusqlite::Connection;

use crate::domain::error::DomainResult;

use super::consts::{
    MIGRATION_V20, V16_CONNECTION_VERIFICATION_ERROR_COLUMN, V16_CONNECTION_VERIFICATION_ERROR_SQL,
    V16_CONNECTION_VERIFICATION_STATUS_COLUMN, V16_CONNECTION_VERIFICATION_STATUS_SQL,
    V16_CONNECTION_VERIFIED_AT_COLUMN, V16_CONNECTION_VERIFIED_AT_SQL,
    V22_LAST_EXPORT_DIGEST_COLUMN, V22_LAST_EXPORT_DIGEST_SQL, V8_READER_MODE_COLUMN,
    V8_WEB_PREVIEW_MODE_COLUMN,
};
use super::{set_schema_version, table_exists, table_has_column};

pub(super) fn feed_mode_columns_need_repair(conn: &Connection) -> DomainResult<bool> {
    if !table_exists(conn, "feeds")? {
        return Ok(false);
    }

    let has_reader_mode = table_has_column(conn, "feeds", "reader_mode")?;
    let has_web_preview_mode = table_has_column(conn, "feeds", "web_preview_mode")?;
    Ok(!has_reader_mode || !has_web_preview_mode)
}

pub(super) fn repair_missing_feed_mode_columns(conn: &Connection) -> DomainResult<bool> {
    if !table_exists(conn, "feeds")? {
        return Ok(false);
    }

    let has_reader_mode = table_has_column(conn, "feeds", "reader_mode")?;
    let has_web_preview_mode = table_has_column(conn, "feeds", "web_preview_mode")?;

    if has_reader_mode && has_web_preview_mode {
        return Ok(false);
    }

    if !has_reader_mode {
        conn.execute(
            "ALTER TABLE feeds ADD COLUMN reader_mode TEXT NOT NULL DEFAULT 'inherit'",
            [],
        )?;
    }
    if !has_web_preview_mode {
        conn.execute(
            "ALTER TABLE feeds ADD COLUMN web_preview_mode TEXT NOT NULL DEFAULT 'inherit'",
            [],
        )?;
    }

    if table_has_column(conn, "feeds", "display_mode")? {
        if !has_reader_mode {
            conn.execute(
                "UPDATE feeds
                 SET reader_mode = CASE
                    WHEN display_mode = 'normal' THEN 'on'
                    WHEN display_mode = 'widescreen' THEN 'on'
                    ELSE 'inherit'
                 END
                 WHERE reader_mode = 'inherit'",
                [],
            )?;
        }
        if !has_web_preview_mode {
            conn.execute(
                "UPDATE feeds
                 SET web_preview_mode = CASE
                    WHEN display_mode = 'normal' THEN 'off'
                    WHEN display_mode = 'widescreen' THEN 'on'
                    ELSE 'inherit'
                 END
                 WHERE web_preview_mode = 'inherit'",
                [],
            )?;
        }
    }

    Ok(true)
}

pub(super) fn apply_v8_feed_reader_preview_modes(conn: &Connection) -> DomainResult<()> {
    add_column_if_missing(
        conn,
        "feeds",
        V8_READER_MODE_COLUMN,
        "ALTER TABLE feeds ADD COLUMN reader_mode TEXT NOT NULL DEFAULT 'inherit'",
    )?;
    add_column_if_missing(
        conn,
        "feeds",
        V8_WEB_PREVIEW_MODE_COLUMN,
        "ALTER TABLE feeds ADD COLUMN web_preview_mode TEXT NOT NULL DEFAULT 'inherit'",
    )?;

    conn.execute(
        "UPDATE feeds
         SET
           reader_mode = CASE
             WHEN display_mode = 'normal' THEN 'on'
             WHEN display_mode = 'widescreen' THEN 'on'
             ELSE 'inherit'
           END,
           web_preview_mode = CASE
             WHEN display_mode = 'normal' THEN 'off'
             WHEN display_mode = 'widescreen' THEN 'on'
             ELSE 'inherit'
           END",
        [],
    )?;
    conn.execute("INSERT INTO schema_version (version) VALUES (8)", [])?;
    Ok(())
}

pub(super) fn apply_v16_account_connection_verification(conn: &Connection) -> DomainResult<()> {
    add_column_if_missing(
        conn,
        "accounts",
        V16_CONNECTION_VERIFICATION_STATUS_COLUMN,
        V16_CONNECTION_VERIFICATION_STATUS_SQL,
    )?;
    add_column_if_missing(
        conn,
        "accounts",
        V16_CONNECTION_VERIFIED_AT_COLUMN,
        V16_CONNECTION_VERIFIED_AT_SQL,
    )?;
    add_column_if_missing(
        conn,
        "accounts",
        V16_CONNECTION_VERIFICATION_ERROR_COLUMN,
        V16_CONNECTION_VERIFICATION_ERROR_SQL,
    )?;

    set_schema_version(conn, 16)?;
    Ok(())
}

pub(super) fn apply_v20_article_account_ordered_indexes(conn: &Connection) -> DomainResult<()> {
    add_column_if_missing(
        conn,
        "articles",
        "account_id",
        "ALTER TABLE articles ADD COLUMN account_id TEXT",
    )?;
    conn.execute_batch(MIGRATION_V20)?;
    Ok(())
}

pub(super) fn apply_v22_local_account_sync_export_state(conn: &Connection) -> DomainResult<()> {
    add_column_if_missing(
        conn,
        "local_account_sync_settings",
        V22_LAST_EXPORT_DIGEST_COLUMN,
        V22_LAST_EXPORT_DIGEST_SQL,
    )?;

    set_schema_version(conn, 22)?;
    Ok(())
}

pub(super) fn add_column_if_missing(
    conn: &Connection,
    table_name: &str,
    column_name: &str,
    alter_sql: &str,
) -> DomainResult<bool> {
    if table_has_column(conn, table_name, column_name)? {
        return Ok(false);
    }

    conn.execute(alter_sql, [])?;
    Ok(true)
}
