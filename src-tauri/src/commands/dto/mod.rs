mod error;
mod feed;
mod platform;
mod read_diagnostics;
mod sync;

pub use error::{
    sync_issue_owner_for_app_error, user_facing_error_support_policy, AppError, SyncIssueOwner,
    UserFacingErrorSupportPolicy, APP_ERROR_MESSAGE_MAX_CHARS,
};
pub use feed::{
    AccountDto, AccountProviderCapabilitiesDto, ArticleDto, DiscoveredFeedDto, FeedDto,
    FeedIntegrityCleanupDto, FeedIntegrityIssueDto, FeedIntegrityReportDto, FolderDto,
    MuteKeywordDto, TagDto,
};
pub use platform::{
    DevRuntimeOptionsDto, PlatformCapabilitiesDto, PlatformInfoDto, PlatformKindDto,
    PlatformPermissionDeniedRecoveryDto, PlatformPermissionDeniedSurfaceDto,
};
pub use read_diagnostics::{
    is_valid_read_diagnostic_request_id, ReadDiagnosticCancelReasonArg, ReadDiagnosticContextArg,
    ReadDiagnosticErrorClassArg, ReadDiagnosticEventArg, ReadDiagnosticOutcomeArg,
    ReadDiagnosticSkipReasonArg, READ_DIAGNOSTICS_BATCH_MAX_BYTES,
    READ_DIAGNOSTICS_BATCH_MAX_EVENTS, READ_DIAGNOSTICS_SESSION_MAX_BYTES,
    READ_DIAGNOSTIC_REQUEST_ID_MAX_CHARS,
};
pub use sync::{
    AccountSyncError, AccountSyncStatus, AccountSyncWarning, AccountSyncWarningDetail,
    AccountSyncWarningKind, FeedArticleSummaryDto, SyncProgressEvent, SyncProgressKind,
    SyncProgressStage, SyncResult, COUNT_RESPONSE_MAX_VALUE,
};
