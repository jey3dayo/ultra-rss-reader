/// Recent article history is persisted in SQLite and pruned per account.
pub const RECENT_ARTICLE_HISTORY_LIMIT: usize = 50;

/// Batch article mutations are intentionally atomic across the whole request.
///
/// `None` means no transaction chunking: local article state, unread counts, and
/// pending remote mutations commit together or roll back together.
pub const ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE: Option<usize> = None;
