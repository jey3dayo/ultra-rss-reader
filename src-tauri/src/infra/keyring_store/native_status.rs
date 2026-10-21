use crate::domain::error::CredentialFailureCause;

#[cfg(target_os = "macos")]
const ERR_SEC_USER_CANCELED: i32 = -128;
#[cfg(target_os = "macos")]
const ERR_SEC_AUTH_FAILED: i32 = -25293;

/// The OSStatus the Security framework reported, when the failure carries one.
#[cfg(target_os = "macos")]
pub(super) fn keyring_os_status(error: &keyring::Error) -> Option<i32> {
    let keyring::Error::PlatformFailure(source) = error else {
        return None;
    };
    source
        .downcast_ref::<security_framework::base::Error>()
        .map(|error| error.code())
}

#[cfg(not(target_os = "macos"))]
pub(super) fn keyring_os_status(_error: &keyring::Error) -> Option<i32> {
    None
}

/// Cause of a native keyring failure. Only an OSStatus reported by the Security framework can
/// say the user cancelled or was refused; any other failure, including a prompt that could not
/// be shown, keeps the caller's `default`.
#[cfg(target_os = "macos")]
pub(super) fn keyring_cause(
    error: &keyring::Error,
    default: CredentialFailureCause,
) -> CredentialFailureCause {
    match keyring_os_status(error) {
        Some(ERR_SEC_USER_CANCELED) => CredentialFailureCause::Canceled,
        Some(ERR_SEC_AUTH_FAILED) => CredentialFailureCause::NotAllowed,
        _ => default,
    }
}

#[cfg(not(target_os = "macos"))]
pub(super) fn keyring_cause(
    _error: &keyring::Error,
    default: CredentialFailureCause,
) -> CredentialFailureCause {
    default
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    fn platform_failure(status: i32) -> keyring::Error {
        keyring::Error::PlatformFailure(Box::new(security_framework::base::Error::from_code(
            status,
        )))
    }

    #[test]
    fn only_an_os_status_of_user_canceled_is_a_confirmed_cancellation() {
        let cause = |status| {
            keyring_cause(
                &platform_failure(status),
                CredentialFailureCause::WriteFailed,
            )
        };

        assert_eq!(cause(-128), CredentialFailureCause::Canceled);
        assert_eq!(cause(-25293), CredentialFailureCause::NotAllowed);
        assert_eq!(cause(-50), CredentialFailureCause::WriteFailed);
    }

    #[test]
    fn a_prompt_that_could_not_be_shown_is_not_a_refusal() {
        let error = platform_failure(-25308);

        assert_eq!(
            keyring_cause(&error, CredentialFailureCause::ReadFailed),
            CredentialFailureCause::ReadFailed
        );
        assert_eq!(keyring_os_status(&error), Some(-25308));
    }

    #[test]
    fn failures_without_an_os_status_report_none() {
        let platform_error: Box<dyn std::error::Error + Send + Sync> = "dummy".into();

        assert_eq!(
            keyring_os_status(&keyring::Error::PlatformFailure(platform_error)),
            None
        );
        assert_eq!(keyring_os_status(&keyring::Error::NoEntry), None);
    }

    #[test]
    fn failures_without_an_os_status_keep_the_default_cause() {
        let platform_error: Box<dyn std::error::Error + Send + Sync> = "dummy".into();

        assert_eq!(
            keyring_cause(
                &keyring::Error::PlatformFailure(platform_error),
                CredentialFailureCause::ReadFailed,
            ),
            CredentialFailureCause::ReadFailed
        );
        assert_eq!(
            keyring_cause(&keyring::Error::NoEntry, CredentialFailureCause::ReadFailed),
            CredentialFailureCause::ReadFailed
        );
    }
}
