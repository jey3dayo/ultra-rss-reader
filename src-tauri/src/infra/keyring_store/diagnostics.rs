use super::CredentialLookupMode;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CredentialKind {
    FreshRssPassword,
    CloudflareAccess,
}

impl CredentialKind {
    pub(super) fn label(self) -> &'static str {
        match self {
            Self::FreshRssPassword => "freshrss-password",
            Self::CloudflareAccess => "cloudflare-access",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum KeyringOp {
    Load,
    Save,
    Remove,
    Restore,
    Verify,
}

impl KeyringOp {
    fn label(self) -> &'static str {
        match self {
            Self::Load => "load",
            Self::Save => "save",
            Self::Remove => "remove",
            Self::Restore => "restore",
            Self::Verify => "verify",
        }
    }
}

fn mode_label(mode: CredentialLookupMode) -> &'static str {
    match mode {
        CredentialLookupMode::Background => "background",
        CredentialLookupMode::Interactive => "interactive",
    }
}

pub(super) fn keyring_failure_reason(error: &keyring::Error) -> &'static str {
    match error {
        keyring::Error::PlatformFailure(_) => "platform",
        keyring::Error::NoStorageAccess(_) => "no-storage-access",
        keyring::Error::NoEntry => "no-entry",
        keyring::Error::BadEncoding(_) => "bad-encoding",
        keyring::Error::TooLong(..) => "too-long",
        keyring::Error::Invalid(..) => "invalid",
        keyring::Error::Ambiguous(_) => "ambiguous",
        _ => "other",
    }
}

pub(super) fn keyring_access_failed_diagnostic(
    credential_kind: CredentialKind,
    op: KeyringOp,
    failure_reason: &str,
) -> String {
    format!(
        "event=keyring-access-failed credential_kind={} op={} failure_reason={}",
        credential_kind.label(),
        op.label(),
        failure_reason
    )
}

pub(super) fn log_keyring_access_failed(
    credential_kind: CredentialKind,
    op: KeyringOp,
    failure_reason: &str,
) {
    log::warn!(
        target: "keyring_store",
        "{}",
        keyring_access_failed_diagnostic(credential_kind, op, failure_reason)
    );
}

pub(super) fn log_keyring_error(
    credential_kind: CredentialKind,
    op: KeyringOp,
    error: &keyring::Error,
) {
    log_keyring_access_failed(credential_kind, op, keyring_failure_reason(error));
}

pub(super) fn log_sync_read_gate_failed(
    credential_kind: CredentialKind,
    mode: CredentialLookupMode,
    failure_reason: &str,
) {
    log::warn!(
        target: "keyring_store",
        "event=keyring-read-gate-failed credential_kind={} mode={} failure_reason={}",
        credential_kind.label(),
        mode_label(mode),
        failure_reason
    );
}

pub(super) fn log_credential_malformed(credential_kind: CredentialKind, stage: &str) {
    log::warn!(
        target: "keyring_store",
        "event=keyring-credential-malformed credential_kind={} stage={}",
        credential_kind.label(),
        stage
    );
}

#[cfg(test)]
mod tests;
