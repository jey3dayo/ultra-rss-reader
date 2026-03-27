use rusqlite::Connection;

use crate::domain::error::DomainResult;

const MIGRATION_V1: &str = include_str!("../../../migrations/V1__initial.sql");
const MIGRATION_V2: &str = include_str!("../../../migrations/V2__preferences.sql");

pub fn run_migrations(conn: &mut Connection) -> DomainResult<()> {
    let current_version = get_schema_version(conn);

    if current_version < 1 {
        conn.execute_batch(MIGRATION_V1)?;
    }
    if current_version < 2 {
        conn.execute_batch(MIGRATION_V2)?;
    }

    Ok(())
}

fn get_schema_version(conn: &Connection) -> i32 {
    conn.query_row(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}
