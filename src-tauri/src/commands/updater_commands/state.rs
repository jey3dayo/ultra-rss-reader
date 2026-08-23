use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use tauri_plugin_updater::Update;
use tokio::sync::Mutex;

use super::super::dto::AppError;
use super::super::DATABASE_MAINTENANCE_BUSY_ERROR;

pub(crate) static DOWNLOADING: AtomicBool = AtomicBool::new(false);
pub(crate) static DOWNLOAD_SESSION_ID: AtomicU64 = AtomicU64::new(0);
pub(crate) static ACTIVE_DOWNLOAD_SESSION_ID: AtomicU64 = AtomicU64::new(0);

pub(crate) struct PendingUpdateHandle {
    pub(crate) update: Update,
    pub(crate) version: String,
    pub(crate) source: String,
    /// Bytes downloaded but not yet installed. Populated when install is
    /// deferred until the user requests a restart: always on non-macOS
    /// platforms, and on macOS when the sync/maintenance guard was busy at
    /// download completion. `None` after a macOS immediate install.
    pub(crate) downloaded_bytes: Option<Vec<u8>>,
}

/// Cached update handle from the last successful check. The version/source
/// metadata is verified again before install so a stale handle cannot be used
/// after a later check cleared or replaced the pending update.
pub struct PendingUpdate(pub(crate) Arc<Mutex<PendingUpdateSlot<PendingUpdateHandle>>>);

impl Default for PendingUpdate {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(PendingUpdateSlot::default())))
    }
}

pub(crate) struct PendingUpdateSlot<T> {
    generation: u64,
    value: Option<T>,
}

impl<T> Default for PendingUpdateSlot<T> {
    fn default() -> Self {
        Self {
            generation: 0,
            value: None,
        }
    }
}

impl<T> PendingUpdateSlot<T> {
    #[cfg(test)]
    pub(crate) fn with_value(value: Option<T>) -> Self {
        Self {
            generation: 0,
            value,
        }
    }

    pub(crate) fn advance_generation(&mut self) {
        self.generation = self.generation.wrapping_add(1);
    }

    pub(crate) fn clear(&mut self) {
        self.replace(None);
    }

    pub(crate) fn replace(&mut self, value: Option<T>) {
        self.advance_generation();
        self.value = value;
    }

    pub(crate) fn take(&mut self) -> (u64, Option<T>) {
        self.advance_generation();
        (self.generation, self.value.take())
    }

    pub(crate) fn restore_if_unchanged(&mut self, take_generation: u64, value: T) -> bool {
        if self.generation != take_generation {
            return false;
        }

        self.replace(Some(value));
        true
    }
}

pub(crate) struct DownloadGuard {
    session_id: u64,
}

impl DownloadGuard {
    pub(crate) fn acquire(session_id: u64) -> Result<Self, AppError> {
        DOWNLOADING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| {
                ACTIVE_DOWNLOAD_SESSION_ID.store(session_id, Ordering::SeqCst);
                Self { session_id }
            })
            .map_err(|_| AppError::UserVisible {
                message: "Update download already in progress".to_string(),
            })
    }

    pub(crate) fn is_current(&self) -> bool {
        ACTIVE_DOWNLOAD_SESSION_ID.load(Ordering::SeqCst) == self.session_id
    }
}

impl Drop for DownloadGuard {
    fn drop(&mut self) {
        DOWNLOADING.store(false, Ordering::SeqCst);
        ACTIVE_DOWNLOAD_SESSION_ID
            .compare_exchange(self.session_id, 0, Ordering::SeqCst, Ordering::SeqCst)
            .ok();
    }
}

pub(crate) fn is_update_download_in_flight() -> bool {
    DOWNLOADING.load(Ordering::SeqCst)
}

pub(crate) fn next_download_session_id() -> u64 {
    DOWNLOAD_SESSION_ID.fetch_add(1, Ordering::SeqCst) + 1
}

#[derive(Debug)]
pub(crate) struct SyncInstallGuard<'a>(&'a std::sync::atomic::AtomicBool);

impl<'a> SyncInstallGuard<'a> {
    pub(crate) fn acquire(syncing: &'a std::sync::atomic::AtomicBool) -> Result<Self, AppError> {
        syncing
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self(syncing))
            .map_err(|_| AppError::UserVisible {
                message: DATABASE_MAINTENANCE_BUSY_ERROR.to_string(),
            })
    }
}

impl Drop for SyncInstallGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// How to apply freshly downloaded update bytes on the immediate-install path.
#[cfg(any(target_os = "macos", test))]
pub(crate) enum PostDownloadInstall<'a> {
    /// The sync/maintenance guard is free: install right now while holding it.
    Immediate(SyncInstallGuard<'a>),
    /// The guard is busy (e.g. sync in flight when the download finishes).
    /// Do not fail the completed download; keep the bytes as a pending update
    /// and install later from `restart_app`.
    DeferUntilRestart,
}

#[cfg(any(target_os = "macos", test))]
pub(crate) fn resolve_post_download_install(
    acquire_result: Result<SyncInstallGuard<'_>, AppError>,
) -> PostDownloadInstall<'_> {
    match acquire_result {
        Ok(guard) => PostDownloadInstall::Immediate(guard),
        Err(_) => PostDownloadInstall::DeferUntilRestart,
    }
}
