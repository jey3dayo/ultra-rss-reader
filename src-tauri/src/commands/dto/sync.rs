use serde::Serialize;

pub const COUNT_RESPONSE_MAX_VALUE: i64 = 9_007_199_254_740_991;

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct FeedArticleSummaryDto {
    pub feed_id: String,
    pub latest_article_at: Option<String>,
    pub starred_count: i32,
    pub recent_article_count: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct SyncResult {
    /// Whether any sync actually ran (false = skipped because already in progress)
    pub synced: bool,
    pub total: usize,
    pub succeeded: usize,
    pub failed: Vec<AccountSyncError>,
    pub warnings: Vec<AccountSyncWarning>,
}

#[derive(Debug, Serialize, Clone)]
pub struct AccountSyncStatus {
    pub last_success_at: Option<String>,
    pub last_error: Option<String>,
    pub error_count: i32,
    pub next_retry_at: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct AccountSyncError {
    pub account_id: String,
    pub account_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_owner: Option<super::error::SyncIssueOwner>,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct AccountSyncWarning {
    pub account_id: String,
    pub account_name: String,
    pub kind: AccountSyncWarningKind,
    pub message: String,
    pub retry_at: Option<String>,
    pub retry_in_seconds: Option<u64>,
    pub detail: AccountSyncWarningDetail,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountSyncWarningKind {
    Generic,
    RetryPending,
    RetryScheduled,
}

/// Structured detail for [`AccountSyncWarning`], resolved into a localized
/// message on the frontend (see `sync-result-feedback.ts`). Additive to
/// `kind`/`message`/retry fields: every generation site must attach a variant
/// here, but `kind` and retry semantics are unchanged. `message` remains the
/// English `AppError` Display fallback for logs and older clients.
///
/// Kept in sync with `src/api/schemas/sync-result.ts` and
/// `src/locales/{en,ja}/{sidebar,settings}.json` (`sync_warning_detail.<type>`
/// keys); `i18next-locale-contract.node.test.ts` pins the mapping by
/// extracting this enum's variants via `?raw` import.
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AccountSyncWarningDetail {
    PendingMutationRetry {
        mutation: String,
    },
    DroppedPendingMutation {
        mutation: String,
    },
    DeletedGreaderFolders {
        count: usize,
    },
    FeedSkippedEntries {
        feed_title: String,
        count: usize,
    },
    FeedArticlesVanished {
        feed_title: String,
        count_before: usize,
    },
    AccountSkippedEntries {
        account_name: String,
        count: usize,
    },
    LocalFeedSyncFailed {
        feed_title: String,
        message: String,
    },
    LocalAccountSyncOperationFailed {
        operation: String,
        message: String,
    },
    LocalImportResult {
        conflicted: usize,
        rejected_files: usize,
        rejected_operations: usize,
    },
    StartupRepairMarkerFailed {
        message: String,
    },
    SchedulerLoadFailed {
        message: String,
    },
    BackoffPersistFailed {
        account_name: String,
        message: String,
    },
    BackgroundSyncRetryScheduled {
        account_name: String,
    },
}

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum SyncProgressStage {
    Started,
    AccountStarted,
    AccountFinished,
    Finished,
}

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum SyncProgressKind {
    ManualAll,
    ManualAccount,
    Automatic,
}

#[derive(Debug, Serialize, Clone)]
pub struct SyncProgressEvent {
    pub stage: SyncProgressStage,
    pub session_id: u64,
    pub kind: SyncProgressKind,
    pub total: usize,
    pub completed: usize,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub success: Option<bool>,
}
