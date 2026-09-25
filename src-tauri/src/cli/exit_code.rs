/// Stable process exit codes for `urr`.
///
/// This mirrors the exit-code contract in `plans/cli/001-cli-design.md` §5,
/// which reserves the full 0-8 range across CLI phases:
/// `0=OK 1=FAILED 2=USAGE 3=NOT_FOUND 4=SCHEMA_MISMATCH 5=APP_REQUIRED
/// 6=APP_BUSY 7=DIAGNOSIS_UNHEALTHY 8=APP_OPERATION_IN_PROGRESS`.
///
/// Only the variants a code path actually returns are defined here.
/// `APP_REQUIRED` (5), `APP_BUSY` (6), and `APP_OPERATION_IN_PROGRESS` (8)
/// are added alongside the Phase-2 routed/app-connected commands that
/// produce them, rather than pre-declared now (which `-D warnings` treats as
/// dead code since nothing would construct them yet).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CliExitCode {
    Ok,
    Failed,
    Usage,
    NotFound,
    SchemaMismatch,
    /// `feed diagnose` returns this (via `CommandOutput::exit_code`, not as
    /// an error) when any match's verdict is `behind_source` or
    /// `source_unreachable`.
    DiagnosisUnhealthy,
}

impl CliExitCode {
    pub(crate) fn as_u8(self) -> u8 {
        match self {
            Self::Ok => 0,
            Self::Failed => 1,
            Self::Usage => 2,
            Self::NotFound => 3,
            Self::SchemaMismatch => 4,
            Self::DiagnosisUnhealthy => 7,
        }
    }

    /// Stable machine-readable string used as the JSON error envelope's
    /// `error.code` field.
    pub(crate) fn as_code_str(self) -> &'static str {
        match self {
            Self::Ok => "OK",
            Self::Failed => "FAILED",
            Self::Usage => "USAGE",
            Self::NotFound => "NOT_FOUND",
            Self::SchemaMismatch => "SCHEMA_MISMATCH",
            Self::DiagnosisUnhealthy => "DIAGNOSIS_UNHEALTHY",
        }
    }
}

impl From<CliExitCode> for std::process::ExitCode {
    fn from(value: CliExitCode) -> Self {
        std::process::ExitCode::from(value.as_u8())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exit_codes_match_the_design_contract() {
        assert_eq!(CliExitCode::Ok.as_u8(), 0);
        assert_eq!(CliExitCode::Failed.as_u8(), 1);
        assert_eq!(CliExitCode::Usage.as_u8(), 2);
        assert_eq!(CliExitCode::NotFound.as_u8(), 3);
        assert_eq!(CliExitCode::SchemaMismatch.as_u8(), 4);
        assert_eq!(CliExitCode::DiagnosisUnhealthy.as_u8(), 7);
    }

    #[test]
    fn code_strings_are_stable_upper_snake_case() {
        assert_eq!(CliExitCode::Ok.as_code_str(), "OK");
        assert_eq!(CliExitCode::Failed.as_code_str(), "FAILED");
        assert_eq!(CliExitCode::Usage.as_code_str(), "USAGE");
        assert_eq!(CliExitCode::NotFound.as_code_str(), "NOT_FOUND");
        assert_eq!(CliExitCode::SchemaMismatch.as_code_str(), "SCHEMA_MISMATCH");
        assert_eq!(
            CliExitCode::DiagnosisUnhealthy.as_code_str(),
            "DIAGNOSIS_UNHEALTHY"
        );
    }
}
