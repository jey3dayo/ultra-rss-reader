import type { ContentMode } from "@/lib/layout/layout-state.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";

/** All valid action identifiers dispatched via executeAction. */
type FilterAction = `set-filter-${ViewMode}`;

export const APP_ACTION_REGISTRY = {
  viewFilters: ["set-filter-unread", "set-filter-all", "set-filter-starred"] as const satisfies readonly FilterAction[],
  preferences: ["toggle-sort-unread", "toggle-group-by-feed", "set-theme-light", "set-theme-dark", "set-theme-system"],
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

export type AppActionSurface = "commandPalette" | "nativeMenu" | "keyboardShortcut" | "dispatcher";

export type AppActionAvailabilityContext = {
  selectedAccountId: string | null;
  selectedArticleId: string | null;
  contentMode: ContentMode;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  shortcutsHelpOpen: boolean;
  isAddFeedDialogOpen: boolean;
  /** Counted as a modal for `nativeMenu` only; other surfaces ignore it. */
  confirmDialogOpen?: boolean;
};

type AppActionUnavailableReason = "modal-open" | "requires-article" | "unavailable";

type AppActionAvailabilityRule = {
  surfaces: readonly AppActionSurface[];
  requiresAccount?: boolean;
  requiresArticle?: boolean;
  requiresBrowser?: boolean;
};

const accountScopedActions = ["sync-all", "open-add-feed", "mark-all-read"] as const satisfies readonly AppAction[];
const accountScopedActionSet: ReadonlySet<AppAction> = new Set(accountScopedActions);
const articleScopedActions = [
  "open-in-reader",
  "open-in-browser",
  "toggle-star",
  "toggle-read",
  "copy-link",
  "open-in-default-browser",
  "add-to-reading-list",
] as const satisfies readonly AppAction[];
const articleScopedActionSet: ReadonlySet<AppAction> = new Set(articleScopedActions);

const allSurfaces = ["commandPalette", "nativeMenu", "keyboardShortcut", "dispatcher"] as const;

const modalAllowedActions: ReadonlySet<AppAction> = new Set([
  "open-settings",
  "open-command-palette",
  "check-for-updates",
]);
// Native check menu items flip their mark on click, so blocking these would leave the mark out of sync with prefs.
const nativeMenuModalAllowedActions: ReadonlySet<AppAction> = new Set([
  "check-for-updates",
  "sync-all",
  "toggle-fullscreen",
  "toggle-sort-unread",
  "toggle-group-by-feed",
]);

const APP_ACTION_CAPABILITY_MATRIX: ReadonlyMap<AppAction, AppActionAvailabilityRule> = new Map(
  APP_ACTIONS.map((action) => [
    action,
    {
      surfaces: allSurfaces,
      requiresAccount: accountScopedActionSet.has(action),
      requiresArticle: articleScopedActionSet.has(action),
      requiresBrowser: action === "reload-webview" || action === "close-browser",
    },
  ]),
);

export function getAppActionUnavailableReason(
  action: AppAction,
  surface: AppActionSurface,
  context: AppActionAvailabilityContext,
): AppActionUnavailableReason | null {
  const rule = APP_ACTION_CAPABILITY_MATRIX.get(action);
  if (!rule?.surfaces.includes(surface)) {
    return "unavailable";
  }
  const isNativeMenu = surface === "nativeMenu";
  const modalOpen =
    context.settingsOpen ||
    context.shortcutsHelpOpen ||
    context.isAddFeedDialogOpen ||
    (isNativeMenu && context.confirmDialogOpen === true) ||
    (surface !== "commandPalette" && context.commandPaletteOpen);
  if (modalOpen && !(isNativeMenu ? nativeMenuModalAllowedActions : modalAllowedActions).has(action)) {
    return "modal-open";
  }
  if (rule.requiresArticle && context.selectedArticleId === null) {
    return "requires-article";
  }
  if (
    (rule.requiresAccount && context.selectedAccountId === null) ||
    (rule.requiresBrowser && context.contentMode !== "browser")
  ) {
    return "unavailable";
  }
  return null;
}

export function isAppActionAvailable(
  action: AppAction,
  surface: AppActionSurface,
  context: AppActionAvailabilityContext,
): boolean {
  return getAppActionUnavailableReason(action, surface, context) === null;
}

/** Set of all valid action strings, used for runtime validation at IPC boundaries. */
const appActions: ReadonlySet<string> = new Set(APP_ACTIONS);

/** Runtime type guard for validating action strings from external sources (e.g. Tauri IPC). */
export function isAppAction(value: unknown): value is AppAction {
  return typeof value === "string" && appActions.has(value);
}
