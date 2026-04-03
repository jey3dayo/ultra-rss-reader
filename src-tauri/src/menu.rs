use std::collections::HashMap;

use tauri::menu::{
    AboutMetadataBuilder, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem,
    SubmenuBuilder,
};
use tauri::{menu::Menu, AppHandle, Emitter, Manager};

use crate::menu_i18n;

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
    let settings_item = MenuItemBuilder::with_id("settings", labels.settings)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let check_updates_item =
        MenuItemBuilder::with_id("check-for-updates", labels.check_for_updates).build(app)?;

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
    let view_unread = MenuItemBuilder::with_id("view-unread", labels.unread)
        .accelerator("CmdOrCtrl+1")
        .build(app)?;
    let view_all = MenuItemBuilder::with_id("view-all", labels.all)
        .accelerator("CmdOrCtrl+2")
        .build(app)?;
    let view_starred = MenuItemBuilder::with_id("view-starred", labels.starred)
        .accelerator("CmdOrCtrl+3")
        .build(app)?;
    let sort_unread_checked = prefs
        .get("sort_unread")
        .is_some_and(|v| v != "newest_first");
    let group_by_feed_checked = prefs.get("group_by").is_some_and(|v| v == "feed");
    let view_sort_unread =
        CheckMenuItemBuilder::with_id("view-sort-unread", labels.sort_unread_to_top)
            .checked(sort_unread_checked)
            .build(app)?;
    let view_group_by_feed =
        CheckMenuItemBuilder::with_id("view-group-by-feed", labels.group_by_feed)
            .checked(group_by_feed_checked)
            .build(app)?;
    let view_fullscreen = MenuItemBuilder::with_id("view-fullscreen", labels.full_screen)
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
    let accounts_sync = MenuItemBuilder::with_id("accounts-sync", labels.sync_all)
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let accounts_show =
        MenuItemBuilder::with_id("accounts-show", labels.show_accounts).build(app)?;
    let accounts_add = MenuItemBuilder::with_id("accounts-add", labels.add_account).build(app)?;

    let accounts_submenu = SubmenuBuilder::new(app, labels.accounts_menu)
        .item(&accounts_sync)
        .separator()
        .item(&accounts_show)
        .item(&accounts_add)
        .build()?;

    // --- Subscriptions submenu ---
    let subs_add = MenuItemBuilder::with_id("subs-add", labels.add_subscription).build(app)?;
    let subs_prev = MenuItemBuilder::with_id("subs-prev", labels.previous_feed).build(app)?;
    let subs_next = MenuItemBuilder::with_id("subs-next", labels.next_feed).build(app)?;

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
        MenuItemBuilder::with_id("item-prev", format!("{}\tK", labels.previous_item)).build(app)?;
    let item_next =
        MenuItemBuilder::with_id("item-next", format!("{}\tJ", labels.next_item)).build(app)?;
    let item_reader =
        MenuItemBuilder::with_id("item-reader", format!("{}\tV", labels.open_web_preview))
            .build(app)?;
    let item_browser = MenuItemBuilder::with_id(
        "item-browser",
        format!("{}\tB", labels.open_external_browser),
    )
    .build(app)?;
    let item_toggle_star =
        MenuItemBuilder::with_id("item-toggle-star", format!("{}\tS", labels.toggle_star))
            .build(app)?;
    let item_toggle_read = MenuItemBuilder::with_id(
        "item-toggle-read",
        format!("{}\tM", labels.mark_as_read_unread),
    )
    .build(app)?;
    let item_mark_all_read = MenuItemBuilder::with_id(
        "item-mark-all-read",
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
        MenuItemBuilder::with_id("share-copy-link", labels.copy_link).build(app)?;
    let share_open_browser =
        MenuItemBuilder::with_id("share-open-browser", labels.open_external_browser).build(app)?;

    let mut share_builder = SubmenuBuilder::new(app, labels.share_menu)
        .item(&share_copy_link)
        .separator()
        .item(&share_open_browser);

    if cfg!(target_os = "macos") {
        let share_reading_list =
            MenuItemBuilder::with_id("share-reading-list", labels.add_to_reading_list)
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
    let action = match menu_id.as_ref() {
        "view-unread" => "set-filter-unread",
        "view-all" => "set-filter-all",
        "view-starred" => "set-filter-starred",
        "view-sort-unread" => "toggle-sort-unread",
        "view-group-by-feed" => "toggle-group-by-feed",
        "view-fullscreen" => "toggle-fullscreen",
        "accounts-sync" => "sync-all",
        "accounts-show" => "open-settings-accounts",
        "accounts-add" => "open-settings-accounts-add",
        "subs-add" => "open-add-feed",
        "subs-prev" => "prev-feed",
        "subs-next" => "next-feed",
        "item-prev" => "prev-article",
        "item-next" => "next-article",
        "item-reader" => "open-in-reader",
        "item-browser" => "open-in-browser",
        "item-toggle-star" => "toggle-star",
        "item-toggle-read" => "toggle-read",
        "item-mark-all-read" => "mark-all-read",
        "share-copy-link" => "copy-link",
        "share-open-browser" => "open-in-default-browser",
        "share-reading-list" => "add-to-reading-list",
        "check-for-updates" => "check-for-updates",
        "settings" => "open-settings",
        _ => return,
    };

    // Toggle checked state for CheckMenuItem entries
    match menu_id.as_ref() {
        "view-sort-unread" | "view-group-by-feed" => {
            toggle_check_menu_item(app, menu_id.as_ref());
        }
        _ => {}
    }

    if let Err(e) = app.emit("menu-action", action) {
        tracing::error!("Failed to emit menu-action '{}': {}", action, e);
    }
}
