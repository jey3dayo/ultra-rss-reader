use crate::domain::error::DomainError;
use crate::domain::error::DomainResult;
use serde::Deserialize;
use serde::Serialize;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::AtomicU8;
use std::sync::atomic::Ordering;
use std::sync::OnceLock;

pub(crate) const MARKER_FILE_NAME: &str = "credential-storage.json";
pub(crate) const LOCAL_CREDENTIALS_FILE_NAME: &str = "credentials.json";

const ACTIVE_OS_KEYCHAIN: u8 = 0;
const ACTIVE_LOCAL_FILE: u8 = 1;

static ACTIVE: AtomicU8 = AtomicU8::new(ACTIVE_OS_KEYCHAIN);
static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CredentialStorage {
    #[default]
    OsKeychain,
    LocalFile,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Marker {
    storage: CredentialStorage,
}

pub(crate) fn read_marker(dir: &Path) -> CredentialStorage {
    match std::fs::read_to_string(dir.join(MARKER_FILE_NAME)) {
        Ok(content) => match serde_json::from_str::<Marker>(&content) {
            Ok(marker) => marker.storage,
            Err(e) => {
                tracing::warn!("Failed to parse credential storage marker: {e}");
                CredentialStorage::OsKeychain
            }
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => CredentialStorage::OsKeychain,
        Err(e) => {
            tracing::warn!("Failed to read credential storage marker: {e}");
            CredentialStorage::OsKeychain
        }
    }
}

pub(crate) fn write_marker(dir: &Path, storage: CredentialStorage) -> DomainResult<()> {
    let temp_path = temp_marker_path(dir);
    let outcome = write_marker_atomically(dir, &temp_path, storage);
    if outcome.is_err() {
        let _ = std::fs::remove_file(&temp_path);
    }
    outcome.map_err(|e| {
        DomainError::Keychain(format!("Failed to save credential storage setting: {e}"))
    })
}

fn temp_marker_path(dir: &Path) -> PathBuf {
    dir.join(format!(".{MARKER_FILE_NAME}.tmp"))
}

fn write_marker_atomically(
    dir: &Path,
    temp_path: &Path,
    storage: CredentialStorage,
) -> std::io::Result<()> {
    match std::fs::remove_file(temp_path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e),
    }

    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }

    let mut file = options.open(temp_path)?;
    let body = serde_json::to_string(&Marker { storage }).map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("Failed to serialize credential storage marker: {e}"),
        )
    })?;
    file.write_all(body.as_bytes())?;
    file.sync_all()?;
    std::fs::rename(temp_path, dir.join(MARKER_FILE_NAME))?;
    super::dev_store_file::sync_parent_dir(&dir.join(MARKER_FILE_NAME))?;
    Ok(())
}

pub(crate) fn init(app_data_dir: &Path) {
    let _ = APP_DATA_DIR.set(app_data_dir.to_path_buf());
    set_active(read_marker(app_data_dir));
}

pub(crate) fn active() -> CredentialStorage {
    if ACTIVE.load(Ordering::SeqCst) == ACTIVE_LOCAL_FILE {
        CredentialStorage::LocalFile
    } else {
        CredentialStorage::OsKeychain
    }
}

pub(crate) fn set_active(storage: CredentialStorage) {
    let value = match storage {
        CredentialStorage::OsKeychain => ACTIVE_OS_KEYCHAIN,
        CredentialStorage::LocalFile => ACTIVE_LOCAL_FILE,
    };
    ACTIVE.store(value, Ordering::SeqCst);
}

pub(crate) fn persist(storage: CredentialStorage) -> DomainResult<()> {
    let dir = APP_DATA_DIR.get().ok_or_else(|| {
        DomainError::Keychain("Credential storage is not initialized".to_string())
    })?;
    write_marker(dir, storage)?;
    set_active(storage);
    Ok(())
}

pub(crate) fn local_credentials_path() -> Option<PathBuf> {
    let dir = APP_DATA_DIR.get()?;
    Some(local_credentials_path_in(dir))
}

pub(crate) fn local_credentials_path_in(dir: &Path) -> PathBuf {
    dir.join(LOCAL_CREDENTIALS_FILE_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_no_temp_file(dir: &std::path::Path) {
        let temp_path = temp_marker_path(dir);
        assert!(
            !temp_path.exists(),
            "a successful marker write should not leave a temporary file behind"
        );
    }

    #[test]
    fn missing_marker_file_defaults_to_os_keychain() {
        let dir = tempfile::tempdir().expect("temp dir should be created");

        assert_eq!(read_marker(dir.path()), CredentialStorage::OsKeychain);
    }

    #[test]
    fn write_marker_round_trips_local_file_choice() {
        let dir = tempfile::tempdir().expect("temp dir should be created");

        write_marker(dir.path(), CredentialStorage::LocalFile)
            .expect("marker write should succeed");

        assert_eq!(
            read_marker(dir.path()),
            CredentialStorage::LocalFile,
            "the next startup should read back the persisted storage mode"
        );
        assert_no_temp_file(dir.path());
    }

    #[test]
    fn write_marker_replaces_an_existing_marker() {
        let dir = tempfile::tempdir().expect("temp dir should be created");

        for expected in [
            CredentialStorage::LocalFile,
            CredentialStorage::OsKeychain,
            CredentialStorage::LocalFile,
        ] {
            write_marker(dir.path(), expected).expect("marker write should succeed");
            assert_eq!(
                read_marker(dir.path()),
                expected,
                "each marker write should replace the previously stored mode"
            );
            assert_no_temp_file(dir.path());
        }
    }

    #[test]
    fn write_marker_round_trips_os_keychain_choice() {
        let dir = tempfile::tempdir().expect("temp dir should be created");

        write_marker(dir.path(), CredentialStorage::OsKeychain)
            .expect("marker write should succeed");

        assert_eq!(read_marker(dir.path()), CredentialStorage::OsKeychain);
        assert_no_temp_file(dir.path());
    }

    #[cfg(unix)]
    #[test]
    fn marker_file_is_created_with_owner_only_permissions_on_unix() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().expect("temp dir should be created");

        write_marker(dir.path(), CredentialStorage::LocalFile)
            .expect("marker write should succeed");

        let mode = std::fs::metadata(dir.path().join(MARKER_FILE_NAME))
            .expect("marker file should exist")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn invalid_marker_json_falls_back_to_os_keychain() {
        let dir = tempfile::tempdir().expect("temp dir should be created");
        std::fs::write(dir.path().join(MARKER_FILE_NAME), "{not-json")
            .expect("invalid marker fixture should be writable");

        assert_eq!(read_marker(dir.path()), CredentialStorage::OsKeychain);
    }

    #[test]
    fn marker_with_unknown_fields_falls_back_to_os_keychain() {
        let dir = tempfile::tempdir().expect("temp dir should be created");
        std::fs::write(
            dir.path().join(MARKER_FILE_NAME),
            r#"{"storage":"local_file","extra":1}"#,
        )
        .expect("marker fixture should be writable");

        assert_eq!(read_marker(dir.path()), CredentialStorage::OsKeychain);
    }
}
