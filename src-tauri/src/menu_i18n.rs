#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolvedMenuLanguage {
    En,
    Ja,
}

#[derive(Debug, Clone, Copy)]
pub struct MenuLabels {
    pub app_submenu_title: &'static str,
    pub edit_menu: &'static str,
    pub view_menu: &'static str,
    pub accounts_menu: &'static str,
    pub subscriptions_menu: &'static str,
    pub item_menu: &'static str,
    pub share_menu: &'static str,
    pub settings: &'static str,
    pub check_for_updates: &'static str,
    pub unread: &'static str,
    pub all: &'static str,
    pub starred: &'static str,
    pub sort_unread_to_top: &'static str,
    pub group_by_feed: &'static str,
    pub full_screen: &'static str,
    pub sync_all: &'static str,
    pub show_accounts: &'static str,
    pub add_account: &'static str,
    pub add_subscription: &'static str,
    pub previous_feed: &'static str,
    pub next_feed: &'static str,
    pub previous_item: &'static str,
    pub next_item: &'static str,
    pub open_web_preview: &'static str,
    pub open_external_browser: &'static str,
    pub toggle_star: &'static str,
    pub mark_as_read_unread: &'static str,
    pub mark_all_as_read: &'static str,
    pub copy_link: &'static str,
    pub add_to_reading_list: &'static str,
}

pub fn resolve_menu_language(
    preference: Option<&str>,
    system_locale: Option<&str>,
) -> ResolvedMenuLanguage {
    match preference {
        Some("ja") => ResolvedMenuLanguage::Ja,
        Some("en") => ResolvedMenuLanguage::En,
        _ => {
            if system_locale
                .unwrap_or_default()
                .to_ascii_lowercase()
                .starts_with("ja")
            {
                ResolvedMenuLanguage::Ja
            } else {
                ResolvedMenuLanguage::En
            }
        }
    }
}

pub fn labels(language: ResolvedMenuLanguage) -> MenuLabels {
    match language {
        ResolvedMenuLanguage::En => MenuLabels {
            app_submenu_title: "Ultra RSS Reader",
            edit_menu: "Edit",
            view_menu: "View",
            accounts_menu: "Accounts",
            subscriptions_menu: "Subscriptions",
            item_menu: "Item",
            share_menu: "Share",
            settings: "Settings...",
            check_for_updates: "Check for Updates...",
            unread: "Unread",
            all: "All",
            starred: "Starred",
            sort_unread_to_top: "Sort Unread to Top",
            group_by_feed: "Group by Feed",
            full_screen: "Full Screen",
            sync_all: "Sync All",
            show_accounts: "Show Accounts",
            add_account: "Add Account...",
            add_subscription: "Add Subscription...",
            previous_feed: "Previous Feed",
            next_feed: "Next Feed",
            previous_item: "Previous",
            next_item: "Next",
            open_web_preview: "Open Web Preview",
            open_external_browser: "Open in External Browser",
            toggle_star: "Toggle Star",
            mark_as_read_unread: "Mark as Read/Unread",
            mark_all_as_read: "Mark All as Read",
            copy_link: "Copy Link",
            add_to_reading_list: "Add to Reading List",
        },
        ResolvedMenuLanguage::Ja => MenuLabels {
            app_submenu_title: "Ultra RSS Reader",
            edit_menu: "編集",
            view_menu: "表示",
            accounts_menu: "アカウント",
            subscriptions_menu: "購読",
            item_menu: "記事",
            share_menu: "共有",
            settings: "設定...",
            check_for_updates: "アップデートを確認...",
            unread: "未読",
            all: "すべて",
            starred: "スター",
            sort_unread_to_top: "未読を上に表示",
            group_by_feed: "フィードごとにグループ化",
            full_screen: "フルスクリーン",
            sync_all: "すべて同期",
            show_accounts: "アカウントを表示",
            add_account: "アカウントを追加...",
            add_subscription: "購読を追加...",
            previous_feed: "前のフィード",
            next_feed: "次のフィード",
            previous_item: "前の記事",
            next_item: "次の記事",
            open_web_preview: "Webプレビューを開く",
            open_external_browser: "外部ブラウザで開く",
            toggle_star: "スターを切り替え",
            mark_as_read_unread: "既読/未読を切り替え",
            mark_all_as_read: "すべて既読にする",
            copy_link: "リンクをコピー",
            add_to_reading_list: "リーディングリストに追加",
        },
    }
}

#[cfg(test)]
mod tests {
    use super::{labels, resolve_menu_language, ResolvedMenuLanguage};

    #[test]
    fn resolves_explicit_japanese() {
        assert_eq!(
            resolve_menu_language(Some("ja"), Some("en-US")),
            ResolvedMenuLanguage::Ja
        );
    }

    #[test]
    fn resolves_explicit_english() {
        assert_eq!(
            resolve_menu_language(Some("en"), Some("ja-JP")),
            ResolvedMenuLanguage::En
        );
    }

    #[test]
    fn resolves_system_japanese_locale() {
        assert_eq!(
            resolve_menu_language(Some("system"), Some("ja-JP")),
            ResolvedMenuLanguage::Ja
        );
    }

    #[test]
    fn resolves_system_non_japanese_locale_to_english() {
        assert_eq!(
            resolve_menu_language(Some("system"), Some("en-US")),
            ResolvedMenuLanguage::En
        );
    }

    #[test]
    fn resolves_missing_preference_to_english_for_non_japanese_locale() {
        assert_eq!(
            resolve_menu_language(None, Some("fr-FR")),
            ResolvedMenuLanguage::En
        );
    }

    #[test]
    fn english_labels_use_preview_and_external_browser_wording() {
        let labels = labels(ResolvedMenuLanguage::En);
        assert_eq!(labels.open_web_preview, "Open Web Preview");
        assert_eq!(labels.open_external_browser, "Open in External Browser");
    }

    #[test]
    fn japanese_labels_use_preview_wording() {
        let labels = labels(ResolvedMenuLanguage::Ja);
        assert_eq!(labels.open_web_preview, "Webプレビューを開く");
        assert_eq!(labels.open_external_browser, "外部ブラウザで開く");
    }
}
