use rusqlite::Connection;

mod data_cleanup;
mod legacy_data_cleanup;
mod legacy_repairs;
mod migration_constraints;
mod migration_contracts;
mod schema_metadata;
mod schema_progression;

fn open_in_memory() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    conn
}

pub(in crate::infra::db) fn migrate_to_v17(conn: &Connection) {
    use super::consts::*;
    use super::repairs::*;
    use super::set_schema_version;

    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();
    apply_v8_feed_reader_preview_modes(conn).unwrap();
    conn.execute_batch(MIGRATION_V9).unwrap();
    set_schema_version(conn, 10).unwrap();
    conn.execute_batch(MIGRATION_V11).unwrap();
    conn.execute_batch(MIGRATION_V12).unwrap();
    conn.execute_batch(MIGRATION_V13).unwrap();
    conn.execute_batch(MIGRATION_V14).unwrap();
    conn.execute_batch(MIGRATION_V15).unwrap();
    apply_v16_account_connection_verification(conn).unwrap();
    conn.execute_batch(MIGRATION_V17).unwrap();
}

fn migrate_to_v19(conn: &Connection) {
    use super::consts::{MIGRATION_V18, MIGRATION_V19};

    migrate_to_v17(conn);
    conn.execute_batch(MIGRATION_V18).unwrap();
    conn.execute_batch(MIGRATION_V19).unwrap();
}

fn migrate_to_v28(conn: &Connection) {
    use super::consts::*;
    use super::repairs::*;

    migrate_to_v19(conn);
    apply_v20_article_account_ordered_indexes(conn).unwrap();
    conn.execute_batch(MIGRATION_V21).unwrap();
    apply_v22_local_account_sync_export_state(conn).unwrap();
    conn.execute_batch(MIGRATION_V23).unwrap();
    apply_v24_feed_icon_url(conn).unwrap();
    conn.execute_batch(MIGRATION_V25).unwrap();
    conn.execute_batch(MIGRATION_V26).unwrap();
    apply_v27_account_folder_order_mode(conn).unwrap();
    apply_v28_article_state_change_times(conn).unwrap();
}

fn migrate_to_v29(conn: &Connection) {
    migrate_to_v28(conn);
    super::repairs::apply_v29_local_sync_entity_change_times(conn).unwrap();
}

fn migrate_to_v31(conn: &Connection) {
    use super::consts::{MIGRATION_V30, MIGRATION_V31};

    migrate_to_v29(conn);
    conn.execute_batch(MIGRATION_V30).unwrap();
    conn.execute_batch(MIGRATION_V31).unwrap();
}

fn normalize_sql(sql: &str) -> String {
    sql.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn assert_single_schema_version_row(conn: &Connection, expected_version: i32) {
    let (row_count, version): (i64, i32) = conn
        .query_row(
            "SELECT COUNT(*), MAX(version) FROM schema_version",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(row_count, 1);
    assert_eq!(version, expected_version);
}
