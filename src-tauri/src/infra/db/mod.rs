pub mod backup;
pub mod connection;
pub mod migration;
pub mod sqlite_account;
pub mod sqlite_article;
pub mod sqlite_feed;
pub mod sqlite_folder;
pub mod sqlite_local_account_sync_settings;
pub mod sqlite_mute_keyword;
pub mod sqlite_pending_mutation;
pub mod sqlite_preference;
pub mod sqlite_sync_state;
pub mod sqlite_tag;

#[cfg(test)]
pub(crate) mod test_fixtures;

#[cfg(test)]
mod tests {
    fn assert_contains(haystack: &str, needle: &str, owner: &str) {
        assert!(
            haystack.contains(needle),
            "{owner} is missing inventory entry: {needle}"
        );
    }

    fn repository_trait_method_names(source: &str) -> Vec<&str> {
        use std::collections::BTreeSet;

        let mut in_trait = false;
        let mut names = BTreeSet::new();

        for line in source.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("pub trait ") {
                in_trait = true;
                continue;
            }
            if in_trait && trimmed == "}" {
                in_trait = false;
                continue;
            }
            if !in_trait || !trimmed.starts_with("fn ") {
                continue;
            }

            let method_name_end = [trimmed.find('('), trimmed.find('<')]
                .into_iter()
                .flatten()
                .min()
                .expect("repository trait method should include params or generics");
            names.insert(&trimmed["fn ".len()..method_name_end]);
        }

        names.into_iter().collect()
    }

    #[test]
    fn production_only_startup_paths_have_contract_inventory() {
        let lib_rs = include_str!("../../lib.rs");
        let sync_scheduler_rs = include_str!("../../service/sync_scheduler.rs");

        let production_only_startup_paths = [
            (
                "Tauri runtime imports",
                "#[cfg(not(test))]\nuse tauri::Manager;",
            ),
            (
                "startup focus restore async path",
                "#[cfg(not(test))]\nfn focus_main_webview_on_startup",
            ),
            (
                "startup focus restore cancellation state",
                "fn mark_startup_focus_restore_stopped",
            ),
            (
                "Tauri app builder and plugin setup",
                "#[cfg(not(test))]\npub fn run()",
            ),
            (
                "background scheduler startup",
                "service::sync_scheduler::start_sync_scheduler",
            ),
            (
                "release log cleanup owner",
                "cleanup_old_logs(&log_dir, RELEASE_LOG_RETENTION_DAYS)",
            ),
        ];

        for (owner, needle) in production_only_startup_paths {
            assert_contains(lib_rs, needle, owner);
        }

        let unit_contract_owners = [
            (
                "startup focus restore decision contract",
                "fn startup_focus_restore_runs_only_when_app_window_and_webview_are_available",
            ),
            (
                "startup focus restore diagnostics contract",
                "fn startup_focus_restore_failures_are_diagnostics_only",
            ),
            (
                "release log cleanup contract",
                "fn cleanup_old_logs_read_dir_failure_keeps_cleanup_non_fatal",
            ),
            (
                "scheduler load failure contract",
                "fn scheduler_load_failure_warning_serializes_to_sync_warning_contract",
            ),
        ];

        for (owner, needle) in unit_contract_owners {
            let source = if needle.contains("scheduler_") {
                sync_scheduler_rs
            } else {
                lib_rs
            };
            assert_contains(source, needle, owner);
        }
    }

    #[test]
    fn repository_method_names_are_inventoried_by_sql_operation_kind() {
        let repository_sources = [
            include_str!("../../repository/account.rs"),
            include_str!("../../repository/article.rs"),
            include_str!("../../repository/feed.rs"),
            include_str!("../../repository/folder.rs"),
            include_str!("../../repository/mute_keyword.rs"),
            include_str!("../../repository/pending_mutation.rs"),
            include_str!("../../repository/preference.rs"),
            include_str!("../../repository/sync_state.rs"),
            include_str!("../../repository/tag.rs"),
        ]
        .join("\n");

        let read_methods = [
            "find_all",
            "find_by_id",
            "find_by_feed",
            "find_unread_by_feed",
            "find_starred_by_feed",
            "find_by_account",
            "find_unread_by_account",
            "find_by_folder",
            "find_unread_by_folder",
            "find_starred_by_folder",
            "find_starred_by_account",
            "find_recently_viewed_by_account",
            "find_by_sanitizer_version_below",
            "find_by_remote_id",
            "find_by_url",
            "find_by_name",
            "find_or_create",
            "find_tags_for_article",
            "find_articles_by_tag",
            "list_articles_by_tag",
            "list_by_account",
            "list_by_feed",
            "list_by_folder",
            "list_recently_viewed_by_account",
            "count_unread_by_account",
            "count_starred_by_account",
            "count_articles_per_tag",
            "get_all",
            "get",
            "has_any",
            "search",
            "search_list",
        ];
        let write_methods = [
            "save",
            "set",
            "create",
            "update_sync_settings",
            "update_credentials",
            "update_connection_verification",
            "update_unread_count",
            "update_folder",
            "update_display_settings",
            "update_scope",
            "update_sanitized",
            "rename",
            "delete",
            "delete_by_account_remote_entry_ids_and_axis",
            "upsert",
            "record_view",
            "clear_view_history",
            "mark_as_read",
            "mark_many_as_read",
            "mark_muted_unread_as_read",
            "mark_feed_as_read",
            "mark_folder_as_read",
            "mark_as_starred",
            "purge_old_read",
            "apply_remote_state",
            "tag_article",
            "untag_article",
        ];
        let maintenance_methods = ["recalculate_unread_count", "recalculate_unread_counts"];
        let mut expected_methods = read_methods
            .into_iter()
            .chain(write_methods)
            .chain(maintenance_methods)
            .collect::<Vec<_>>();
        expected_methods.sort_unstable();

        assert_eq!(
            repository_trait_method_names(&repository_sources),
            expected_methods,
            "repository method SQL operation kind inventory must list every trait method"
        );

        for method in expected_methods {
            assert_contains(
                &repository_sources,
                &format!("fn {method}"),
                "repository method operation inventory",
            );
        }
    }

    #[test]
    fn fixture_domain_migration_inventory_keeps_reserved_domains_visible() {
        let reserved_fixture_owners = [
            (
                "tests/helpers/reader-fixtures.ts",
                include_str!("../../../../tests/helpers/reader-fixtures.ts"),
            ),
            (
                "tests/helpers/settings-fixtures.ts",
                include_str!("../../../../tests/helpers/settings-fixtures.ts"),
            ),
            (
                "tests/helpers/tauri-mocks.ts",
                include_str!("../../../../tests/helpers/tauri-mocks.ts"),
            ),
            ("sqlite_account.rs", include_str!("sqlite_account.rs")),
            ("sqlite_article.rs", include_str!("sqlite_article.rs")),
            ("sqlite_feed.rs", include_str!("sqlite_feed.rs")),
            (
                "sqlite_mute_keyword.rs",
                include_str!("sqlite_mute_keyword.rs"),
            ),
            ("sqlite_sync_state.rs", include_str!("sqlite_sync_state.rs")),
        ];

        for (owner, source) in reserved_fixture_owners {
            assert!(
                source.contains("example.com") || source.contains(".example"),
                "{owner} should keep RFC reserved fixture domains visible before broad rename"
            );
        }

        let migration_candidates = [
            ("sqlite_feed.rs", "rust.com"),
            ("sqlite_feed.rs", "f.com"),
            ("sqlite_article.rs", "test.com"),
            ("sqlite_folder.rs", "f.com"),
            ("sqlite_tag.rs", "f.com"),
        ];

        for (owner, candidate) in migration_candidates {
            let source = match owner {
                "sqlite_feed.rs" => include_str!("sqlite_feed.rs"),
                "sqlite_article.rs" => include_str!("sqlite_article.rs"),
                "sqlite_folder.rs" => include_str!("sqlite_folder.rs"),
                "sqlite_tag.rs" => include_str!("sqlite_tag.rs"),
                _ => unreachable!("fixture inventory owner should be covered"),
            };
            assert_contains(source, candidate, owner);
        }
    }
}
