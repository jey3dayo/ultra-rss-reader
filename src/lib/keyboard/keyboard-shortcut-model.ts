import type { ViewMode } from "@/lib/reader/view-mode.types";

export const keyboardEvents = {
  toggleRead: "ultra-rss:toggle-read",
  toggleStar: "ultra-rss:toggle-star",
  openInAppBrowser: "ultra-rss:open-in-app-browser",
  openExternalBrowser: "ultra-rss:open-external-browser",
  closeBrowserOverlay: "ultra-rss:close-browser-overlay",
  markAllRead: "ultra-rss:mark-all-read",
  focusSearch: "ultra-rss:focus-search",
  copyLink: "ultra-rss:copy-link",
  addToReadingList: "ultra-rss:add-to-reading-list",
} as const;

export type KeyboardAction =
  | { type: "open-settings" }
  | { type: "open-command-palette" }
  | { type: "open-shortcuts-help" }
  | { type: "restart-app" }
  | {
      type: "emit";
      eventName: (typeof keyboardEvents)[keyof typeof keyboardEvents];
    }
  | { type: "set-view-mode"; mode: ViewMode }
  | { type: "toggle-sidebar" }
  | { type: "close-browser" }
  | { type: "clear-article" }
  | { type: "focus-sidebar" }
  | { type: "navigate-article"; direction: 1 | -1 }
  | { type: "navigate-feed"; direction: 1 | -1 }
  | { type: "scroll-article"; direction: 1 | -1 }
  | { type: "reload-webview" }
  | { type: "noop" };

export type KeyboardActionSkipReason = "ignored_input" | "missing_selected_article" | "no_action";

/** All customizable shortcut action identifiers. */
export type ShortcutActionId =
  | "next_article"
  | "prev_article"
  | "scroll_article_down"
  | "scroll_article_up"
  | "next_feed"
  | "prev_feed"
  | "reload_webview"
  | "focus_sidebar"
  | "toggle_sidebar"
  | "toggle_read"
  | "toggle_star"
  | "open_in_app_browser"
  | "open_external_browser"
  | "mark_all_read"
  | "show_unread"
  | "show_all"
  | "show_starred"
  | "cycle_filter"
  | "search"
  | "close_or_clear"
  | "open_command_palette"
  | "open_settings";

export type ShortcutPreferenceKey = `shortcut_${ShortcutActionId}`;

export type ShortcutModifierEvent = {
  metaKey: boolean;
  ctrlKey: boolean;
};

export type ShortcutKeyEvent = ShortcutModifierEvent & {
  key: string;
  shiftKey: boolean;
};

export type ShortcutLabelKey =
  | "shortcuts.next_article"
  | "shortcuts.prev_article"
  | "shortcuts.scroll_article_down"
  | "shortcuts.scroll_article_up"
  | "shortcuts.next_feed"
  | "shortcuts.prev_feed"
  | "shortcuts.reload_webview"
  | "shortcuts.focus_sidebar"
  | "shortcuts.toggle_sidebar"
  | "shortcuts.toggle_read"
  | "shortcuts.toggle_star"
  | "shortcuts.view_in_browser"
  | "shortcuts.open_external_browser"
  | "shortcuts.mark_all_read"
  | "shortcuts.show_unread"
  | "shortcuts.show_all"
  | "shortcuts.show_starred"
  | "shortcuts.cycle_filter"
  | "shortcuts.search"
  | "shortcuts.close_or_clear"
  | "shortcuts.open_command_palette"
  | "shortcuts.open_settings";

export type ShortcutCategoryKey =
  | "shortcuts.category_navigation"
  | "shortcuts.category_actions"
  | "shortcuts.category_global";

export type ShortcutDefinition = {
  id: ShortcutActionId;
  labelKey: ShortcutLabelKey;
  categoryKey: ShortcutCategoryKey;
  defaultKey: string;
};

export type KeyToActionMap = Map<string, ShortcutActionId>;
