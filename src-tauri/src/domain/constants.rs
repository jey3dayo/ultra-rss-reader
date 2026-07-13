/// Recent article history is persisted in SQLite and pruned per account.
pub const RECENT_ARTICLE_HISTORY_LIMIT: usize = 50;

/// Rolling window (in days) used to measure a feed's recent update frequency.
///
/// Keep this in sync with the frontend window constant
/// (`SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS` in
/// `src/lib/subscriptions/subscription-update-frequency.ts`). The backend returns
/// the raw count over this window; tier thresholds are a frontend concern.
pub const RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS: i64 = 30;

/// Batch article mutations are intentionally atomic across the whole request.
///
/// `None` means no transaction chunking: local article state, unread counts, and
/// pending remote mutations commit together or roll back together.
pub const ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE: Option<usize> = None;
