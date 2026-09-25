use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::infra::db::connection::{DatabaseInfo, ReadOnlyDbManager};

use super::error::CliResult;

/// A capability a [`super::command::CliCommand`] declares it needs. The
/// dispatcher uses `capabilities()` to decide the [`Route`] and whether
/// [`NetworkAccess`] is `Allowed`; a command never opens a DB connection,
/// lock, or HTTP client itself.
///
/// `DbWrite` / `Credentials` / `Sync` are added when Phase 2 needs them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Capability {
    DbRead,
    Network,
}

/// A read-only view onto the application database.
///
/// Holds only the schema-validated path, not an open connection:
/// [`ReadOnlyDb::with_conn`] opens a fresh [`ReadOnlyDbManager`], runs the
/// closure, and drops it before returning.
///
/// An open reader holds a WAL read mark that blocks the app's
/// `wal_checkpoint(TRUNCATE)`, so a command doing both DB and network I/O
/// must finish its DB reads and drop the connection before awaiting network.
pub(crate) struct ReadOnlyDb {
    path: PathBuf,
}

impl ReadOnlyDb {
    /// Opens once to run the schema-version check, then immediately drops
    /// that connection; only the validated path is kept.
    pub(crate) fn open(path: &Path) -> CliResult<Self> {
        ReadOnlyDbManager::open(path)?;
        Ok(Self {
            path: path.to_path_buf(),
        })
    }

    pub(crate) fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> CliResult<T>) -> CliResult<T> {
        let manager = ReadOnlyDbManager::open(&self.path)?;
        f(manager.conn())
    }

    /// File-size read (db/wal/shm), independent of `with_conn`: opens its own
    /// short-lived connection and drops it before returning, same as
    /// `with_conn`.
    pub(crate) fn database_info(&self) -> CliResult<DatabaseInfo> {
        let manager = ReadOnlyDbManager::open(&self.path)?;
        Ok(manager.database_info())
    }
}

/// Whether a command may perform network I/O this invocation. Computed by
/// the dispatcher from `--no-network` and handed to every command regardless
/// of whether it declared `Capability::Network`; only commands that declared
/// it will ever consult this value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum NetworkAccess {
    Allowed,
    Disabled,
}

/// The DB-access route a dispatched command receives. Phase 2 adds
/// `Headless` (direct DB access under a process lock while the app is not
/// running) and `ViaApp` (routed through the app's control endpoint).
pub(crate) enum Route {
    None,
    ReadOnly(ReadOnlyDb),
}
