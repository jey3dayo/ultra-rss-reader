use tauri::menu::{
    AboutMetadataBuilder, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem,
    SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, menu::Menu};

/// Build the full application menu bar.
pub fn build(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    // --- App submenu ---
    let about_metadata = AboutMetadataBuilder::new()
        .name(Some("Ultra RSS Reader"))
        .version(Some("0.1.0"))
        .copyright(Some("Copyright © 2026 jey3dayo"))
        .build();
    let about_item = PredefinedMenuItem::about(app, None, Some(about_metadata))?;
    let settings_item = MenuItemBuilder::with_id("settings", "Settings...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let app_submenu = SubmenuBuilder::new(app, "Ultra RSS Reader")
        .item(&about_item)
        .separator()
        .item(&settings_item)
        .separator()
        .quit()
        .build()?;

    // --- Edit submenu ---
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // --- View submenu ---
    let view_unread = MenuItemBuilder::with_id("view-unread", "Unread")
        .accelerator("CmdOrCtrl+1")
        .build(app)?;
    let view_all = MenuItemBuilder::with_id("view-all", "All")
        .accelerator("CmdOrCtrl+2")
        .build(app)?;
    let view_starred = MenuItemBuilder::with_id("view-starred", "Starred")
        .accelerator("CmdOrCtrl+3")
        .build(app)?;
    let view_sort_unread = CheckMenuItemBuilder::with_id("view-sort-unread", "Sort Unread to Top")
        .checked(false)
        .build(app)?;
    let view_group_by_feed =
        CheckMenuItemBuilder::with_id("view-group-by-feed", "Group by Feed")
            .checked(false)
            .build(app)?;
    let view_fullscreen = MenuItemBuilder::with_id("view-fullscreen", "Full Screen")
        .accelerator("Ctrl+CmdOrCtrl+F")
        .build(app)?;

    let view_submenu = SubmenuBuilder::new(app, "View")
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
    let accounts_sync = MenuItemBuilder::with_id("accounts-sync", "Sync All")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let accounts_show =
        MenuItemBuilder::with_id("accounts-show", "Show Accounts").build(app)?;
    let accounts_add =
        MenuItemBuilder::with_id("accounts-add", "Add Account...").build(app)?;

    let accounts_submenu = SubmenuBuilder::new(app, "Accounts")
        .item(&accounts_sync)
        .separator()
        .item(&accounts_show)
        .item(&accounts_add)
        .build()?;

    // --- Subscriptions submenu ---
    let subs_add =
        MenuItemBuilder::with_id("subs-add", "Add Subscription...").build(app)?;
    let subs_prev =
        MenuItemBuilder::with_id("subs-prev", "Previous Feed").build(app)?;
    let subs_next =
        MenuItemBuilder::with_id("subs-next", "Next Feed").build(app)?;

    let subs_submenu = SubmenuBuilder::new(app, "Subscriptions")
        .item(&subs_add)
        .separator()
        .item(&subs_prev)
        .item(&subs_next)
        .build()?;

    // --- Item submenu ---
    // \t in labels displays key hints on the right side WITHOUT registering accelerators.
    // These keys are handled by the frontend.
    let item_prev =
        MenuItemBuilder::with_id("item-prev", "Previous\tK").build(app)?;
    let item_next =
        MenuItemBuilder::with_id("item-next", "Next\tJ").build(app)?;
    let item_reader =
        MenuItemBuilder::with_id("item-reader", "Open in Reader\tV").build(app)?;
    let item_browser =
        MenuItemBuilder::with_id("item-browser", "Open in Browser\tB").build(app)?;
    let item_toggle_star =
        MenuItemBuilder::with_id("item-toggle-star", "Toggle Star\tS").build(app)?;
    let item_toggle_read =
        MenuItemBuilder::with_id("item-toggle-read", "Mark as Read/Unread\tM").build(app)?;
    let item_mark_all_read =
        MenuItemBuilder::with_id("item-mark-all-read", "Mark All as Read\tA").build(app)?;

    let item_submenu = SubmenuBuilder::new(app, "Item")
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
        MenuItemBuilder::with_id("share-copy-link", "Copy Link").build(app)?;
    let share_open_browser =
        MenuItemBuilder::with_id("share-open-browser", "Open in Browser").build(app)?;

    let mut share_builder = SubmenuBuilder::new(app, "Share")
        .item(&share_copy_link)
        .separator()
        .item(&share_open_browser);

    if cfg!(target_os = "macos") {
        let share_reading_list =
            MenuItemBuilder::with_id("share-reading-list", "Add to Reading List").build(app)?;
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

/// Handle menu events by emitting a `menu-action` event to the frontend.
pub fn handle_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let action = match event.id().as_ref() {
        "view-unread" => "set-filter-unread",
        "view-all" => "set-filter-all",
        "view-starred" => "set-filter-starred",
        "view-sort-unread" => "toggle-sort-unread",
        "view-group-by-feed" => "toggle-group-by-feed",
        "view-fullscreen" => "toggle-fullscreen",
        "accounts-sync" => "sync-all",
        "accounts-show" => "open-settings-accounts",
        "accounts-add" => "open-settings-accounts",
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
        "settings" => "open-settings",
        _ => return,
    };
    if let Err(e) = app.emit("menu-action", action) {
        tracing::error!("Failed to emit menu-action '{}': {}", action, e);
    }
}
