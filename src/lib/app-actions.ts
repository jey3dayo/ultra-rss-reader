import type { ViewMode } from "@/lib/reader/view-mode.types";

/** All valid action identifiers dispatched via executeAction. */
export type AppAction =
  | `set-filter-${ViewMode}`
  | "toggle-sort-unread"
  | "toggle-group-by-feed"
  | "set-theme-light"
  | "set-theme-dark"
  | "toggle-fullscreen"
  | "sync-all"
  | "open-settings"
  | "open-current-account-settings"
  | "open-settings-accounts"
  | "open-settings-accounts-add"
  | "open-settings-accounts-add-freshrss"
  | "open-add-feed"
  | "open-subscriptions-index"
  | "open-command-palette"
  | "restart-app"
  | "prev-article"
  | "next-article"
  | "prev-feed"
  | "next-feed"
  | "reload-webview"
  | "close-browser"
  | "mouse-back"
  | "mouse-forward"
  | "open-in-reader"
  | "open-in-browser"
  | "toggle-star"
  | "toggle-read"
  | "mark-all-read"
  | "copy-link"
  | "open-in-default-browser"
  | "add-to-reading-list"
  | "check-for-updates";

/** All concrete action strings accepted at runtime boundaries. */
export const APP_ACTIONS: readonly AppAction[] = [
  "set-filter-unread",
  "set-filter-all",
  "set-filter-starred",
  "toggle-sort-unread",
  "toggle-group-by-feed",
  "set-theme-light",
  "set-theme-dark",
  "toggle-fullscreen",
  "sync-all",
  "open-settings",
  "open-current-account-settings",
  "open-settings-accounts",
  "open-settings-accounts-add",
  "open-settings-accounts-add-freshrss",
  "open-add-feed",
  "open-subscriptions-index",
  "open-command-palette",
  "restart-app",
  "prev-article",
  "next-article",
  "prev-feed",
  "next-feed",
  "reload-webview",
  "close-browser",
  "mouse-back",
  "mouse-forward",
  "open-in-reader",
  "open-in-browser",
  "toggle-star",
  "toggle-read",
  "mark-all-read",
  "copy-link",
  "open-in-default-browser",
  "add-to-reading-list",
  "check-for-updates",
];

/** Set of all valid action strings, used for runtime validation at IPC boundaries. */
const appActions: ReadonlySet<string> = new Set(APP_ACTIONS);

/** Runtime type guard for validating action strings from external sources (e.g. Tauri IPC). */
export function isAppAction(value: unknown): value is AppAction {
  return typeof value === "string" && appActions.has(value);
}
