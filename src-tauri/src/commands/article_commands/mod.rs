mod browser;
mod integrity;
mod mutations;
mod queries;

#[cfg(test)]
mod tests;

pub use browser::{
    __cmd__check_browser_embed_support, __cmd__open_in_browser,
    __tauri_command_name_check_browser_embed_support, __tauri_command_name_open_in_browser,
    check_browser_embed_support, open_in_browser,
};
pub use integrity::{
    __cmd__cleanup_feed_integrity_orphans, __cmd__get_feed_integrity_report,
    __tauri_command_name_cleanup_feed_integrity_orphans,
    __tauri_command_name_get_feed_integrity_report, cleanup_feed_integrity_orphans,
    get_feed_integrity_report,
};
pub use mutations::{
    __cmd__clear_article_view_history, __cmd__count_old_unread_articles, __cmd__mark_account_read,
    __cmd__mark_account_starred_read, __cmd__mark_article_read, __cmd__mark_articles_read,
    __cmd__mark_feed_read, __cmd__mark_folder_read, __cmd__mark_old_unread_read,
    __cmd__record_article_view, __cmd__toggle_article_star, __cmd__unstar_account_articles,
    __tauri_command_name_clear_article_view_history,
    __tauri_command_name_count_old_unread_articles, __tauri_command_name_mark_account_read,
    __tauri_command_name_mark_account_starred_read, __tauri_command_name_mark_article_read,
    __tauri_command_name_mark_articles_read, __tauri_command_name_mark_feed_read,
    __tauri_command_name_mark_folder_read, __tauri_command_name_mark_old_unread_read,
    __tauri_command_name_record_article_view, __tauri_command_name_toggle_article_star,
    __tauri_command_name_unstar_account_articles, clear_article_view_history,
    count_old_unread_articles, mark_account_read, mark_account_starred_read, mark_article_read,
    mark_articles_read, mark_feed_read, mark_folder_read, mark_old_unread_read,
    record_article_view, toggle_article_star, unstar_account_articles,
};
pub use queries::{
    __cmd__count_account_starred_articles, __cmd__count_account_unread_articles,
    __cmd__get_article, __cmd__list_account_articles, __cmd__list_articles,
    __cmd__list_feed_article_summaries, __cmd__list_folder_articles, __cmd__list_recent_articles,
    __cmd__list_starred_articles, __cmd__search_articles,
    __tauri_command_name_count_account_starred_articles,
    __tauri_command_name_count_account_unread_articles, __tauri_command_name_get_article,
    __tauri_command_name_list_account_articles, __tauri_command_name_list_articles,
    __tauri_command_name_list_feed_article_summaries, __tauri_command_name_list_folder_articles,
    __tauri_command_name_list_recent_articles, __tauri_command_name_list_starred_articles,
    __tauri_command_name_search_articles, count_account_starred_articles,
    count_account_unread_articles, get_article, list_account_articles, list_articles,
    list_feed_article_summaries, list_folder_articles, list_recent_articles, list_starred_articles,
    search_articles,
};

pub(crate) use queries::{article_command_pagination, DEFAULT_ARTICLE_LIST_LIMIT};

#[cfg(test)]
pub(crate) use queries::{MAX_ARTICLE_COMMAND_LIST_LIMIT, MAX_ARTICLE_COMMAND_LIST_OFFSET};

#[cfg(test)]
use browser::{
    acquire_browser_open_queue_guard_from, background_browser_open_failure_message,
    background_browser_open_status_failure_message, check_browser_embed_support_for_url,
    has_blocking_frame_ancestors, has_blocking_x_frame_options,
    native_browser_open_failure_message, open_browser_in_background_with_command,
    should_use_background_browser_open, validate_browser_embed_redirect, BrowserOpenQueueKey,
    BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT, DOWNGRADE_REDIRECT_VALIDATION_MESSAGE,
};

#[cfg(test)]
use integrity::{cleanup_feed_integrity_orphans_inner, get_feed_integrity_report_inner};

#[cfg(test)]
use mutations::{
    bulk_mark_account_read, bulk_mark_account_starred_read, bulk_mark_old_unread_read,
    bulk_unstar_account_articles, collect_old_unread_rows, mark_article_read_impl,
    mark_article_read_with_conn, mark_articles_read_with_conn, mark_feed_read_with_conn,
    mark_folder_read_with_conn, old_unread_before_from_now,
    provider_supports_pending_article_mutations, recalculate_bulk_feed_unread_counts,
    record_article_view_with_conn, supports_remote_mutations, toggle_article_star_with_conn,
    validate_older_than_days, BulkArticleMutationRow, OldUnreadScope,
};

#[cfg(test)]
use mutations::maybe_queue_mutation;

#[cfg(test)]
use queries::{
    normalize_backend_article_search_query, parse_article_list_mode,
    repair_outdated_articles_for_render, validate_feed_article_filters,
    ARTICLE_SEARCH_QUERY_MAX_CHARS, DEFAULT_RECENT_ARTICLE_LIST_LIMIT,
};
