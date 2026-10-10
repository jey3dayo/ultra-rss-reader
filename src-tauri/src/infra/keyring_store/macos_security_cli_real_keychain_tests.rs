use super::CredentialKind;
use super::{read_credential_from_security_cli_command, read_password_from_security_cli_command};
use crate::infra::keyring_store::CredentialLookupMode;
use std::process::{Command, Stdio};
use std::time::Duration;

const DUMMY_SERVICE: &str = "urr-test-keychain-cli-read";
const DUMMY_ACCOUNT: &str = "urr-test-keychain-cli-read";
const NON_ASCII_VALUE: &str = "pässwörd-テスト";

struct DummyKeychainItem;

impl DummyKeychainItem {
    fn add(value: &str) -> Self {
        let status = Command::new("/usr/bin/security")
            .args([
                "add-generic-password",
                "-U",
                "-s",
                DUMMY_SERVICE,
                "-a",
                DUMMY_ACCOUNT,
                "-w",
                value,
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .expect("security add-generic-password should start");
        assert!(status.success(), "dummy keychain item should be added");
        Self
    }
}

impl Drop for DummyKeychainItem {
    fn drop(&mut self) {
        let _ = Command::new("/usr/bin/security")
            .args([
                "delete-generic-password",
                "-s",
                DUMMY_SERVICE,
                "-a",
                DUMMY_ACCOUNT,
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

#[test]
#[ignore = "touches the real macOS Keychain with a dummy service"]
fn real_keychain_non_ascii_value_is_read_exactly_by_both_readers() {
    let _item = DummyKeychainItem::add(NON_ASCII_VALUE);
    let timeout = Duration::from_secs(10);

    let password = read_password_from_security_cli_command(
        Command::new(super::SECURITY_CLI_PATH),
        DUMMY_SERVICE,
        DUMMY_ACCOUNT,
        CredentialLookupMode::Background,
        timeout,
    )
    .expect("password reader should read the dummy item");
    assert_eq!(password, NON_ASCII_VALUE);

    let credential = read_credential_from_security_cli_command(
        Command::new(super::SECURITY_CLI_PATH),
        CredentialKind::CloudflareAccess,
        DUMMY_SERVICE,
        DUMMY_ACCOUNT,
        CredentialLookupMode::Background,
        timeout,
    )
    .expect("credential reader should read the dummy item");
    assert_eq!(credential.as_deref(), Some(NON_ASCII_VALUE));
}
