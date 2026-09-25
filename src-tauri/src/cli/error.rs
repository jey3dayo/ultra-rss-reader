use crate::domain::error::DomainError;
use crate::infra::db::connection::ReadOnlyOpenError;

use super::exit_code::CliExitCode;

#[derive(Debug)]
pub(crate) struct CliError {
    pub(crate) exit_code: CliExitCode,
    pub(crate) message: String,
}

impl CliError {
    pub(crate) fn usage(message: impl Into<String>) -> Self {
        Self {
            exit_code: CliExitCode::Usage,
            message: message.into(),
        }
    }

    pub(crate) fn failed(message: impl Into<String>) -> Self {
        Self {
            exit_code: CliExitCode::Failed,
            message: message.into(),
        }
    }

    pub(crate) fn not_found(message: impl Into<String>) -> Self {
        Self {
            exit_code: CliExitCode::NotFound,
            message: message.into(),
        }
    }

    pub(crate) fn code_str(&self) -> &'static str {
        self.exit_code.as_code_str()
    }
}

impl From<DomainError> for CliError {
    fn from(error: DomainError) -> Self {
        Self::failed(error.to_string())
    }
}

impl From<ReadOnlyOpenError> for CliError {
    fn from(error: ReadOnlyOpenError) -> Self {
        match error {
            ReadOnlyOpenError::MissingFile(path) => Self {
                exit_code: CliExitCode::NotFound,
                message: format!("database file not found: {}", path.display()),
            },
            ReadOnlyOpenError::SchemaMismatch { found, expected } => Self {
                exit_code: CliExitCode::SchemaMismatch,
                message: format!(
                    "database schema version {found} does not match the version this CLI expects ({expected})"
                ),
            },
            ReadOnlyOpenError::Domain(domain_error) => Self::from(domain_error),
        }
    }
}

pub(crate) type CliResult<T> = Result<T, CliError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_maps_to_not_found() {
        let error = CliError::from(ReadOnlyOpenError::MissingFile("/tmp/x.db".into()));
        assert_eq!(error.exit_code, CliExitCode::NotFound);
        assert_eq!(error.code_str(), "NOT_FOUND");
    }

    #[test]
    fn schema_mismatch_maps_to_schema_mismatch() {
        let error = CliError::from(ReadOnlyOpenError::SchemaMismatch {
            found: 10,
            expected: 26,
        });
        assert_eq!(error.exit_code, CliExitCode::SchemaMismatch);
        assert_eq!(error.code_str(), "SCHEMA_MISMATCH");
        assert!(error.message.contains("10"));
        assert!(error.message.contains("26"));
    }

    #[test]
    fn domain_error_maps_to_failed() {
        let error = CliError::from(DomainError::Persistence("boom".to_string()));
        assert_eq!(error.exit_code, CliExitCode::Failed);
        assert_eq!(error.code_str(), "FAILED");
    }

    #[test]
    fn not_found_helper_uses_not_found_exit_code() {
        let error = CliError::not_found("no match");
        assert_eq!(error.exit_code, CliExitCode::NotFound);
        assert_eq!(error.code_str(), "NOT_FOUND");
        assert_eq!(error.message, "no match");
    }

    #[test]
    fn usage_helper_uses_usage_exit_code() {
        let error = CliError::usage("bad arg");
        assert_eq!(error.exit_code, CliExitCode::Usage);
        assert_eq!(error.code_str(), "USAGE");
        assert_eq!(error.message, "bad arg");
    }
}
