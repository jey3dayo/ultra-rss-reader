import type { ViewMode } from "@/lib/reader/view-mode.types";

/** All valid action identifiers dispatched via executeAction. */
type FilterAction = `set-filter-${ViewMode}`;

export const APP_ACTION_REGISTRY = {
  viewFilters: ["set-filter-unread", "set-filter-all", "set-filter-starred"] as const satisfies readonly FilterAction[],
  preferences: ["toggle-sort-unread", "toggle-group-by-feed", "set-theme-light", "set-theme-dark"],
  window: ["toggle-fullscreen"],
  sync: ["sync-all"],
  settings: [
    "open-settings",
    "open-current-account-settings",
    "open-settings-accounts",
    "open-settings-accounts-add",
    "open-settings-accounts-add-freshrss",
  ],
  dialogs: ["open-add-feed"],
  navigation: [
    "open-subscriptions-index",
    "open-command-palette",
    "restart-app",
    "prev-article",
    "next-article",
    "prev-feed",
    "next-feed",
  ],
  browser: ["reload-webview", "close-browser", "mouse-back", "mouse-forward", "open-in-reader", "open-in-browser"],
  article: [
    "toggle-star",
    "toggle-read",
    "mark-all-read",
    "copy-link",
    "open-in-default-browser",
    "add-to-reading-list",
  ],
  updates: ["check-for-updates"],
} as const;

export type AppAction = (typeof APP_ACTION_REGISTRY)[keyof typeof APP_ACTION_REGISTRY][number];

/** All concrete action strings accepted at runtime boundaries. */
export const APP_ACTIONS = [
  ...APP_ACTION_REGISTRY.viewFilters,
  ...APP_ACTION_REGISTRY.preferences,
  ...APP_ACTION_REGISTRY.window,
  ...APP_ACTION_REGISTRY.sync,
  ...APP_ACTION_REGISTRY.settings,
  ...APP_ACTION_REGISTRY.dialogs,
  ...APP_ACTION_REGISTRY.navigation,
  ...APP_ACTION_REGISTRY.browser,
  ...APP_ACTION_REGISTRY.article,
  ...APP_ACTION_REGISTRY.updates,
] as const satisfies readonly AppAction[];

/** Set of all valid action strings, used for runtime validation at IPC boundaries. */
const appActions: ReadonlySet<string> = new Set(APP_ACTIONS);

/** Runtime type guard for validating action strings from external sources (e.g. Tauri IPC). */
export function isAppAction(value: unknown): value is AppAction {
  return typeof value === "string" && appActions.has(value);
}
