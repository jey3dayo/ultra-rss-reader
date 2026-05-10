import type { ContentMode } from "@/lib/layout/layout-state.types";
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

export type AppActionSurface = "commandPalette" | "nativeMenu" | "keyboardShortcut" | "dispatcher";

export type AppActionAvailabilityContext = {
  selectedAccountId: string | null;
  selectedArticleId: string | null;
  contentMode: ContentMode;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  shortcutsHelpOpen: boolean;
  isAddFeedDialogOpen: boolean;
  isSyncing: boolean;
};

type AppActionAvailabilityRule = {
  surfaces: readonly AppActionSurface[];
  requiresAccount?: boolean;
  requiresArticle?: boolean;
  requiresBrowser?: boolean;
  blocksWhenSyncing?: boolean;
  blocksWhenModalOpen?: boolean;
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

export const APP_ACTION_CAPABILITY_MATRIX: ReadonlyMap<AppAction, AppActionAvailabilityRule> = new Map(
  APP_ACTIONS.map((action) => [
    action,
    {
      surfaces: allSurfaces,
      requiresAccount: accountScopedActionSet.has(action),
      requiresArticle: articleScopedActionSet.has(action),
      requiresBrowser: action === "reload-webview" || action === "close-browser",
      blocksWhenSyncing: action === "sync-all",
      blocksWhenModalOpen:
        action !== "open-settings" && action !== "open-command-palette" && action !== "check-for-updates",
    },
  ]),
);

export function isAppActionAvailable(
  action: AppAction,
  surface: AppActionSurface,
  context: AppActionAvailabilityContext,
): boolean {
  const rule = APP_ACTION_CAPABILITY_MATRIX.get(action);
  if (!rule) {
    return false;
  }
  const modalOpen =
    context.settingsOpen ||
    context.shortcutsHelpOpen ||
    context.isAddFeedDialogOpen ||
    (surface !== "commandPalette" && context.commandPaletteOpen);

  return (
    rule.surfaces.includes(surface) &&
    (!rule.requiresAccount || context.selectedAccountId !== null) &&
    (!rule.requiresArticle || context.selectedArticleId !== null) &&
    (!rule.requiresBrowser || context.contentMode === "browser") &&
    (!rule.blocksWhenSyncing || !context.isSyncing) &&
    (!rule.blocksWhenModalOpen || !modalOpen)
  );
}

/** Set of all valid action strings, used for runtime validation at IPC boundaries. */
const appActions: ReadonlySet<string> = new Set(APP_ACTIONS);

/** Runtime type guard for validating action strings from external sources (e.g. Tauri IPC). */
export function isAppAction(value: unknown): value is AppAction {
  return typeof value === "string" && appActions.has(value);
}
