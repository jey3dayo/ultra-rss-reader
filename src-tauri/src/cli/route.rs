use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::infra::db::connection::{DatabaseInfo, ReadOnlyDbManager};

use super::error::CliResult;

/// A capability a [`super::command::CliCommand`] declares it needs. The
/// dispatcher inspects `capabilities()` to decide which [`Route`] to build
/// and whether [`NetworkAccess`] is `Allowed`; a command never opens a
/// database connection, acquires a lock, or builds an HTTP client itself, so
/// a command that declares only `DbRead` cannot reach the network even if
/// its `run` body tried to.
///
/// `DbWrite` / `Credentials` / `Sync` (design doc §5) are added when the
/// Phase 2 routed/app-connected commands that need them land.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Capability {
    DbRead,
    Network,
}

/// A read-only view onto the application database.
///
/// Holds only the already schema-validated path, not an open connection:
/// [`ReadOnlyDb::with_conn`] opens a fresh [`ReadOnlyDbManager`], runs the
/// closure, and drops it before returning. This matters for commands that
/// also do network I/O (`feed diagnose`): an open reader holds a WAL read
/// mark that blocks the app's `wal_checkpoint(TRUNCATE)`
/// (`infra/db/connection/maintenance.rs`), so the connection must not still
/// be open while a command is waiting on an HTTP response. A command that
/// needs both DB and network reads should call `with_conn` to gather what it
/// needs, let the returned value drop the connection, and only then await
/// the network call.
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

/// The DB-access route a dispatched command receives. Phase 2 (design doc §3)
/// adds `Headless` (process-lock-guarded direct DB access while the app is
/// not running) and `ViaApp` (routed through the running app's control
/// endpoint); those variants are added alongside the commands that need them.
pub(crate) enum Route {
    None,
    ReadOnly(ReadOnlyDb),
}
