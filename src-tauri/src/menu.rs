use std::collections::HashMap;

use tauri::menu::{
    AboutMetadataBuilder, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem,
    SubmenuBuilder,
};
use tauri::{menu::Menu, AppHandle, Emitter, Manager};

use crate::menu_i18n;

pub(crate) const MENU_ACTION_EVENT: &str = "menu-action";

const SETTINGS_MENU_ID: &str = "settings";
const CHECK_FOR_UPDATES_MENU_ID: &str = "check-for-updates";
const VIEW_UNREAD_MENU_ID: &str = "view-unread";
const VIEW_ALL_MENU_ID: &str = "view-all";
const VIEW_STARRED_MENU_ID: &str = "view-starred";
const VIEW_SORT_UNREAD_MENU_ID: &str = "view-sort-unread";
const VIEW_GROUP_BY_FEED_MENU_ID: &str = "view-group-by-feed";
const VIEW_FULLSCREEN_MENU_ID: &str = "view-fullscreen";
const ACCOUNTS_SYNC_MENU_ID: &str = "accounts-sync";
const ACCOUNTS_SHOW_MENU_ID: &str = "accounts-show";
const ACCOUNTS_ADD_MENU_ID: &str = "accounts-add";
const SUBS_ADD_MENU_ID: &str = "subs-add";
const SUBS_PREV_MENU_ID: &str = "subs-prev";
const SUBS_NEXT_MENU_ID: &str = "subs-next";
const ITEM_PREV_MENU_ID: &str = "item-prev";
const ITEM_NEXT_MENU_ID: &str = "item-next";
const ITEM_READER_MENU_ID: &str = "item-reader";
const ITEM_BROWSER_MENU_ID: &str = "item-browser";
const ITEM_TOGGLE_STAR_MENU_ID: &str = "item-toggle-star";
const ITEM_TOGGLE_READ_MENU_ID: &str = "item-toggle-read";
const ITEM_MARK_ALL_READ_MENU_ID: &str = "item-mark-all-read";
const SHARE_COPY_LINK_MENU_ID: &str = "share-copy-link";
const SHARE_OPEN_BROWSER_MENU_ID: &str = "share-open-browser";
const SHARE_READING_LIST_MENU_ID: &str = "share-reading-list";

fn resolve_menu_action(menu_id: &str) -> Option<&'static str> {
    match menu_id {
        VIEW_UNREAD_MENU_ID => Some("set-filter-unread"),
        VIEW_ALL_MENU_ID => Some("set-filter-all"),
        VIEW_STARRED_MENU_ID => Some("set-filter-starred"),
        VIEW_SORT_UNREAD_MENU_ID => Some("toggle-sort-unread"),
        VIEW_GROUP_BY_FEED_MENU_ID => Some("toggle-group-by-feed"),
        VIEW_FULLSCREEN_MENU_ID => Some("toggle-fullscreen"),
        ACCOUNTS_SYNC_MENU_ID => Some("sync-all"),
        ACCOUNTS_SHOW_MENU_ID => Some("open-settings-accounts"),
        ACCOUNTS_ADD_MENU_ID => Some("open-settings-accounts-add"),
        SUBS_ADD_MENU_ID => Some("open-add-feed"),
        SUBS_PREV_MENU_ID => Some("prev-feed"),
        SUBS_NEXT_MENU_ID => Some("next-feed"),
        ITEM_PREV_MENU_ID => Some("prev-article"),
        ITEM_NEXT_MENU_ID => Some("next-article"),
        ITEM_READER_MENU_ID => Some("open-in-reader"),
        ITEM_BROWSER_MENU_ID => Some("open-in-browser"),
        ITEM_TOGGLE_STAR_MENU_ID => Some("toggle-star"),
        ITEM_TOGGLE_READ_MENU_ID => Some("toggle-read"),
        ITEM_MARK_ALL_READ_MENU_ID => Some("mark-all-read"),
        SHARE_COPY_LINK_MENU_ID => Some("copy-link"),
        SHARE_OPEN_BROWSER_MENU_ID => Some("open-in-default-browser"),
        SHARE_READING_LIST_MENU_ID => Some("add-to-reading-list"),
        CHECK_FOR_UPDATES_MENU_ID => Some("check-for-updates"),
        SETTINGS_MENU_ID => Some("open-settings"),
        _ => None,
    }
}

fn is_toggle_check_menu_item(menu_id: &str) -> bool {
    matches!(
        menu_id,
        VIEW_SORT_UNREAD_MENU_ID | VIEW_GROUP_BY_FEED_MENU_ID
    )
}

/// Build the full application menu bar.
/// `prefs` is used to set initial CheckMenuItem states from persisted preferences.
pub fn build(app: &AppHandle, prefs: &HashMap<String, String>) -> tauri::Result<Menu<tauri::Wry>> {
    let system_locale = sys_locale::get_locale();
    let labels = menu_i18n::labels(menu_i18n::resolve_menu_language(
        prefs.get("language").map(String::as_str),
        system_locale.as_deref(),
    ));

    // --- App submenu ---
    let about_metadata = AboutMetadataBuilder::new()
        .name(Some("Ultra RSS Reader"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .copyright(Some("Copyright © 2026 jey3dayo"))
        .build();
    let about_item = PredefinedMenuItem::about(app, None, Some(about_metadata))?;
    let settings_item = MenuItemBuilder::with_id(SETTINGS_MENU_ID, labels.settings)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let check_updates_item =
        MenuItemBuilder::with_id(CHECK_FOR_UPDATES_MENU_ID, labels.check_for_updates).build(app)?;

    let app_submenu = SubmenuBuilder::new(app, labels.app_submenu_title)
        .item(&about_item)
        .separator()
        .item(&settings_item)
        .item(&check_updates_item)
        .separator()
        .quit()
        .build()?;

    // --- Edit submenu ---
    let edit_submenu = SubmenuBuilder::new(app, labels.edit_menu)
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // --- View submenu ---
    let view_unread = MenuItemBuilder::with_id(VIEW_UNREAD_MENU_ID, labels.unread)
        .accelerator("CmdOrCtrl+1")
        .build(app)?;
    let view_all = MenuItemBuilder::with_id(VIEW_ALL_MENU_ID, labels.all)
        .accelerator("CmdOrCtrl+2")
        .build(app)?;
    let view_starred = MenuItemBuilder::with_id(VIEW_STARRED_MENU_ID, labels.starred)
        .accelerator("CmdOrCtrl+3")
        .build(app)?;
    let sort_unread_checked = prefs
        .get("sort_unread")
        .is_some_and(|v| v != "newest_first");
    let group_by_feed_checked = prefs.get("group_by").is_some_and(|v| v == "feed");
    let view_sort_unread =
        CheckMenuItemBuilder::with_id(VIEW_SORT_UNREAD_MENU_ID, labels.sort_unread_to_top)
            .checked(sort_unread_checked)
            .build(app)?;
    let view_group_by_feed =
        CheckMenuItemBuilder::with_id(VIEW_GROUP_BY_FEED_MENU_ID, labels.group_by_feed)
            .checked(group_by_feed_checked)
            .build(app)?;
    let view_fullscreen = MenuItemBuilder::with_id(VIEW_FULLSCREEN_MENU_ID, labels.full_screen)
        .accelerator("Ctrl+CmdOrCtrl+F")
        .build(app)?;

    let view_submenu = SubmenuBuilder::new(app, labels.view_menu)
        .item(&view_unread)
        .item(&view_all)
        .item(&view_starred)
        .separator()
        .item(&view_sort_unread)
        .item(&view_group_by_feed)
        .separator()
        .item(&view_fullscreen)
        .build()?;

    // --- Accounts submenu ---
    let accounts_sync = MenuItemBuilder::with_id(ACCOUNTS_SYNC_MENU_ID, labels.sync_all)
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let accounts_show =
        MenuItemBuilder::with_id(ACCOUNTS_SHOW_MENU_ID, labels.show_accounts).build(app)?;
    let accounts_add =
        MenuItemBuilder::with_id(ACCOUNTS_ADD_MENU_ID, labels.add_account).build(app)?;

    let accounts_submenu = SubmenuBuilder::new(app, labels.accounts_menu)
        .item(&accounts_sync)
        .separator()
        .item(&accounts_show)
        .item(&accounts_add)
        .build()?;

    // --- Subscriptions submenu ---
    let subs_add =
        MenuItemBuilder::with_id(SUBS_ADD_MENU_ID, labels.add_subscription).build(app)?;
    let subs_prev = MenuItemBuilder::with_id(SUBS_PREV_MENU_ID, labels.previous_feed).build(app)?;
    let subs_next = MenuItemBuilder::with_id(SUBS_NEXT_MENU_ID, labels.next_feed).build(app)?;

    let subs_submenu = SubmenuBuilder::new(app, labels.subscriptions_menu)
        .item(&subs_add)
        .separator()
        .item(&subs_prev)
        .item(&subs_next)
        .build()?;

    // --- Item submenu ---
    // \t in labels displays key hints on the right side WITHOUT registering accelerators.
    // These keys are handled by the frontend.
    let item_prev =
        MenuItemBuilder::with_id(ITEM_PREV_MENU_ID, format!("{}\tK", labels.previous_item))
            .build(app)?;
    let item_next = MenuItemBuilder::with_id(ITEM_NEXT_MENU_ID, format!("{}\tJ", labels.next_item))
        .build(app)?;
    let item_reader = MenuItemBuilder::with_id(
        ITEM_READER_MENU_ID,
        format!("{}\tV", labels.open_web_preview),
    )
    .build(app)?;
    let item_browser = MenuItemBuilder::with_id(
        ITEM_BROWSER_MENU_ID,
        format!("{}\tB", labels.open_external_browser),
    )
    .build(app)?;
    let item_toggle_star = MenuItemBuilder::with_id(
        ITEM_TOGGLE_STAR_MENU_ID,
        format!("{}\tS", labels.toggle_star),
    )
    .build(app)?;
    let item_toggle_read = MenuItemBuilder::with_id(
        ITEM_TOGGLE_READ_MENU_ID,
        format!("{}\tM", labels.mark_as_read_unread),
    )
    .build(app)?;
    let item_mark_all_read = MenuItemBuilder::with_id(
        ITEM_MARK_ALL_READ_MENU_ID,
        format!("{}\tA", labels.mark_all_as_read),
    )
    .build(app)?;

    let item_submenu = SubmenuBuilder::new(app, labels.item_menu)
        .item(&item_prev)
        .item(&item_next)
        .separator()
        .item(&item_reader)
        .item(&item_browser)
        .separator()
        .item(&item_toggle_star)
        .item(&item_toggle_read)
        .item(&item_mark_all_read)
        .build()?;

    // --- Share submenu ---
    let share_copy_link =
        MenuItemBuilder::with_id(SHARE_COPY_LINK_MENU_ID, labels.copy_link).build(app)?;
    let share_open_browser =
        MenuItemBuilder::with_id(SHARE_OPEN_BROWSER_MENU_ID, labels.open_external_browser)
            .build(app)?;

    let mut share_builder = SubmenuBuilder::new(app, labels.share_menu)
        .item(&share_copy_link)
        .separator()
        .item(&share_open_browser);

    if cfg!(target_os = "macos") {
        let share_reading_list =
            MenuItemBuilder::with_id(SHARE_READING_LIST_MENU_ID, labels.add_to_reading_list)
                .build(app)?;
        share_builder = share_builder.item(&share_reading_list);
    }

    let share_submenu = share_builder.build()?;

    // --- Build full menu bar ---
    MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&accounts_submenu)
        .item(&subs_submenu)
        .item(&item_submenu)
        .item(&share_submenu)
        .build()
}

pub fn rebuild(app: &AppHandle, prefs: &HashMap<String, String>) -> tauri::Result<()> {
    app.set_menu(build(app, prefs)?)?;
    Ok(())
}

/// Toggle the checked state of a `CheckMenuItem` identified by `menu_id`.
fn toggle_check_menu_item(app: &AppHandle, menu_id: &str) {
    let Some(window) = app.get_webview_window("main") else {
        tracing::warn!("Cannot toggle menu item '{menu_id}': main window not found");
        return;
    };
    let Some(menu) = window.menu() else {
        tracing::warn!("Cannot toggle menu item '{menu_id}': no menu on main window");
        return;
    };
    if let Some(item) = menu.get(menu_id) {
        if let Some(check_item) = item.as_check_menuitem() {
            match check_item.is_checked() {
                Ok(checked) => {
                    if let Err(e) = check_item.set_checked(!checked) {
                        tracing::warn!("Failed to set_checked for '{menu_id}': {e}");
                    }
                }
                Err(e) => tracing::warn!("Failed to read checked state for '{menu_id}': {e}"),
            }
        }
    }
}

/// Handle menu events by emitting a `menu-action` event to the frontend.
pub fn handle_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let menu_id = event.id();
    let Some(action) = resolve_menu_action(menu_id.as_ref()) else {
        return;
    };

    // Toggle checked state for CheckMenuItem entries
    if is_toggle_check_menu_item(menu_id.as_ref()) {
        toggle_check_menu_item(app, menu_id.as_ref());
    }

    if let Err(e) = app.emit(MENU_ACTION_EVENT, action) {
        tracing::error!("Failed to emit {} '{}': {}", MENU_ACTION_EVENT, action, e);
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_menu_action;

    #[test]
    fn resolves_menu_actions_for_known_ids() {
        assert_eq!(
            resolve_menu_action("view-unread"),
            Some("set-filter-unread")
        );
        assert_eq!(
            resolve_menu_action("accounts-add"),
            Some("open-settings-accounts-add")
        );
        assert_eq!(
            resolve_menu_action("check-for-updates"),
            Some("check-for-updates")
        );
    }

    #[test]
    fn returns_none_for_unknown_menu_ids() {
        assert_eq!(resolve_menu_action("unknown-menu-id"), None);
    }
}
