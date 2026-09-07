mod bulk;
mod pending;
pub(crate) mod read_diagnostics;
mod single;

pub use bulk::{
    __cmd__count_old_unread_articles, __cmd__mark_account_read, __cmd__mark_account_starred_read,
    __cmd__mark_old_unread_read, __cmd__unstar_account_articles,
    __tauri_command_name_count_old_unread_articles, __tauri_command_name_mark_account_read,
    __tauri_command_name_mark_account_starred_read, __tauri_command_name_mark_old_unread_read,
    __tauri_command_name_unstar_account_articles, count_old_unread_articles, mark_account_read,
    mark_account_starred_read, mark_old_unread_read, unstar_account_articles,
};
pub use single::{
    __cmd__clear_article_view_history, __cmd__mark_article_read, __cmd__mark_articles_read,
    __cmd__mark_feed_read, __cmd__mark_folder_read, __cmd__record_article_view,
    __cmd__toggle_article_star, __tauri_command_name_clear_article_view_history,
    __tauri_command_name_mark_article_read, __tauri_command_name_mark_articles_read,
    __tauri_command_name_mark_feed_read, __tauri_command_name_mark_folder_read,
    __tauri_command_name_record_article_view, __tauri_command_name_toggle_article_star,
    clear_article_view_history, mark_article_read, mark_articles_read, mark_feed_read,
    mark_folder_read, record_article_view, toggle_article_star,
};

#[cfg(test)]
pub(crate) use bulk::{
    bulk_mark_account_read, bulk_mark_account_starred_read, bulk_mark_old_unread_read,
    bulk_unstar_account_articles, collect_old_unread_rows, old_unread_before_from_now,
    recalculate_bulk_feed_unread_counts, validate_older_than_days, OldUnreadScope,
};

#[cfg(test)]
pub(crate) use pending::{
    maybe_queue_mutation, provider_supports_pending_article_mutations, supports_remote_mutations,
    BulkArticleMutationRow,
};

#[cfg(test)]
pub(crate) use single::{
    mark_article_read_with_conn, mark_articles_read_with_conn, mark_feed_read_with_conn,
    mark_folder_read_with_conn, record_article_view_with_conn, toggle_article_star_with_conn,
};
