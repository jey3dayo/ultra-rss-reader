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

fn migrate_to_v19(conn: &Connection) {
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
    conn.execute_batch(MIGRATION_V18).unwrap();
    conn.execute_batch(MIGRATION_V19).unwrap();
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
