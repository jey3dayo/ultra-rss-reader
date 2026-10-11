import { Result } from "@praha/byethrow";
import {
  type AccountDto,
  type FeedDto,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  listAccounts,
  reloadBrowserWebview,
  restartApp,
} from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import { runManualUpdateCheck } from "@/hooks/use-updater";
import type { AppAction } from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import i18n from "@/lib/i18n";
import { loadI18nResourceNamespace } from "@/lib/i18n-resources";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import { focusArticleListTarget, focusSelectedSidebarTarget, scheduleReaderFocusFrame } from "@/lib/reader-focus";
import { logRuntimeDiagnostic, type RuntimeDiagnosticPolicyId } from "@/lib/runtime/diagnostics";
import { getSettingsDirtyStateSnapshot } from "@/lib/settings/settings-dirty-state-registry";
import { triggerManualSyncWithCooldown } from "@/lib/sync/manual-sync";
import {
  getSyncWarningDetailTranslationKey,
  resolveSyncFeedbackMessage,
  summarizeSyncResult,
} from "@/lib/sync/sync-result-feedback";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import type { ToastAction } from "@/lib/ui/toast.types";
import { classifyRuntimeActionErrorCategory, type RuntimeActionErrorCategory } from "@/lib/ui-errors";
import { isWindowFullscreen, setWindowFullscreen } from "@/lib/window/tauri-window";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export type { AppAction } from "@/lib/app-actions";
export { isAppAction } from "@/lib/app-actions";

let fetchErrorsNavigationGeneration = 0;

export function createFetchErrorsToastAction(accountId: string, label: string): ToastAction | null {
  const account = getFetchErrorsAccount(accountId);
  if (!isLocalFetchErrorsAccount(account)) {
    return null;
  }
  return {
    label,
    onClick: () => {
      const generation = ++fetchErrorsNavigationGeneration;
      const screen = createFetchErrorsNavigationScreenGuard();
      void openFetchErrorsWorkspace(accountId, generation, screen)
        .catch((error: unknown) => reportFetchErrorsNavigationFailure(error, generation, screen))
        .catch((error: unknown) => {
          logRuntimeDiagnostic(
            actionDiagnosticPolicyByCategory.sync,
            "[actions:sync] Failed to report an error while opening feed errors.",
            error,
          );
        })
        .finally(screen.stop);
    },
  };
}

function getFetchErrorsAccount(accountId: string): AccountDto | undefined {
  return queryClient.getQueryData<AccountDto[]>(queryKeys.accounts.root)?.find((account) => account.id === accountId);
}

function isLocalFetchErrorsAccount(account: AccountDto | undefined): boolean {
  return account?.kind.toLowerCase() === "local";
}

const fetchErrorsNavigationScreenKeys = [
  "selectedAccountId",
  "selection",
  "selectedArticleId",
  "contentMode",
  "browserUrl",
  "viewMode",
  "searchQuery",
  "focusedPane",
  "accountPaneOpen",
  "settingsOpen",
  "settingsCategory",
  "settingsAccountId",
  "settingsAddAccount",
  "settingsAddAccountInitialKind",
  "subscriptionsWorkspace",
  "commandPaletteOpen",
  "shortcutsHelpOpen",
  "isAddFeedDialogOpen",
] as const satisfies readonly (keyof ReturnType<typeof useUiStore.getState>)[];

type FetchErrorsNavigationScreenKey = (typeof fetchErrorsNavigationScreenKeys)[number];
type FetchErrorsNavigationScreenState = Pick<ReturnType<typeof useUiStore.getState>, FetchErrorsNavigationScreenKey> & {
  confirmDialogOpen: boolean;
};

type FetchErrorsNavigationScreenGuard = {
  isUnchanged: () => boolean;
  stop: () => void;
};

function captureFetchErrorsNavigationScreen(
  state: ReturnType<typeof useUiStore.getState>,
): FetchErrorsNavigationScreenState {
  return {
    selectedAccountId: state.selectedAccountId,
    selection: state.selection,
    selectedArticleId: state.selectedArticleId,
    contentMode: state.contentMode,
    browserUrl: state.browserUrl,
    viewMode: state.viewMode,
    searchQuery: state.searchQuery,
    focusedPane: state.focusedPane,
    accountPaneOpen: state.accountPaneOpen,
    settingsOpen: state.settingsOpen,
    settingsCategory: state.settingsCategory,
    settingsAccountId: state.settingsAccountId,
    settingsAddAccount: state.settingsAddAccount,
    settingsAddAccountInitialKind: state.settingsAddAccountInitialKind,
    subscriptionsWorkspace: state.subscriptionsWorkspace,
    commandPaletteOpen: state.commandPaletteOpen,
    shortcutsHelpOpen: state.shortcutsHelpOpen,
    isAddFeedDialogOpen: state.isAddFeedDialogOpen,
    confirmDialogOpen: state.confirmDialog.open,
  };
}

function areFetchErrorsNavigationScreensEqual(
  left: FetchErrorsNavigationScreenState,
  right: FetchErrorsNavigationScreenState,
): boolean {
  if (left.confirmDialogOpen !== right.confirmDialogOpen) {
    return false;
  }

  return fetchErrorsNavigationScreenKeys.every((key) => {
    if (key === "selection") {
      return areReaderSelectionsEqual(left.selection, right.selection);
    }
    return left[key] === right[key];
  });
}

function areReaderSelectionsEqual(
  left: ReturnType<typeof useUiStore.getState>["selection"],
  right: ReturnType<typeof useUiStore.getState>["selection"],
): boolean {
  if (left.type !== right.type) {
    return false;
  }

  return (
    (left.type === "all" && right.type === "all") ||
    (left.type === "feed" && right.type === "feed" && left.feedId === right.feedId) ||
    (left.type === "folder" && right.type === "folder" && left.folderId === right.folderId) ||
    (left.type === "smart" && right.type === "smart" && left.kind === right.kind) ||
    (left.type === "tag" && right.type === "tag" && left.tagId === right.tagId)
  );
}

function createFetchErrorsNavigationScreenGuard(): FetchErrorsNavigationScreenGuard {
  const initialScreen = captureFetchErrorsNavigationScreen(useUiStore.getState());
  let changed = false;
  let stopped = false;
  const unsubscribe = useUiStore.subscribe((state) => {
    if (!areFetchErrorsNavigationScreensEqual(initialScreen, captureFetchErrorsNavigationScreen(state))) {
      changed = true;
    }
  });
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    unsubscribe();
  };

  return {
    isUnchanged: () => {
      if (
        !changed &&
        !stopped &&
        !areFetchErrorsNavigationScreensEqual(initialScreen, captureFetchErrorsNavigationScreen(useUiStore.getState()))
      ) {
        changed = true;
      }
      return !changed;
    },
    stop,
  };
}

function isFetchErrorsNavigationCurrent(generation: number, screen: FetchErrorsNavigationScreenGuard): boolean {
  return generation === fetchErrorsNavigationGeneration && screen.isUnchanged();
}

async function openFetchErrorsWorkspace(
  accountId: string,
  generation: number,
  screen: FetchErrorsNavigationScreenGuard,
): Promise<void> {
  const accounts = await queryClient.fetchQuery({
    queryKey: queryKeys.accounts.root,
    queryFn: () => listAccounts().then(Result.unwrap()),
    staleTime: 0,
  });
  if (
    !isFetchErrorsNavigationCurrent(generation, screen) ||
    !accounts.some((account) => account.id === accountId && isLocalFetchErrorsAccount(account))
  ) {
    return;
  }
  const store = useUiStore.getState();
  const currentReturnState =
    store.subscriptionsWorkspace?.kind === "index" && store.subscriptionsWorkspace.returnState?.accountId === accountId
      ? store.subscriptionsWorkspace.returnState
      : undefined;
  if (store.settingsOpen) {
    const dirtyState = getSettingsDirtyStateSnapshot();
    if (dirtyState.dirty || dirtyState.pending) {
      return;
    }
  }
  if (!isFetchErrorsNavigationCurrent(generation, screen)) {
    return;
  }

  screen.stop();
  if (generation !== fetchErrorsNavigationGeneration) {
    return;
  }
  if (store.settingsOpen) {
    store.closeSettings();
  }
  const stateAfterSettingsClose = useUiStore.getState();
  if (generation !== fetchErrorsNavigationGeneration || stateAfterSettingsClose.settingsOpen) {
    return;
  }
  if (stateAfterSettingsClose.selectedAccountId !== accountId) {
    stateAfterSettingsClose.selectAccount(accountId);
  }
  if (generation !== fetchErrorsNavigationGeneration) {
    return;
  }
  useUiStore.getState().openSubscriptionsIndex(currentReturnState, { accountId, summaryFilter: "fetch_errors" });
}

async function reportFetchErrorsNavigationFailure(
  error: unknown,
  generation: number,
  screen: FetchErrorsNavigationScreenGuard,
): Promise<void> {
  if (!isFetchErrorsNavigationCurrent(generation, screen)) {
    return;
  }

  logRuntimeDiagnostic(
    actionDiagnosticPolicyByCategory.sync,
    "[actions:sync] Failed to verify the account before opening feed errors.",
    error,
  );

  let message: string;
  try {
    await loadI18nResourceNamespace(i18n, "subscriptions");
    if (!isFetchErrorsNavigationCurrent(generation, screen)) {
      return;
    }
    message = i18n.t("subscriptions:fetch_error_navigation_failed");
  } catch (namespaceError: unknown) {
    if (!isFetchErrorsNavigationCurrent(generation, screen)) {
      return;
    }
    logRuntimeDiagnostic(
      actionDiagnosticPolicyByCategory.sync,
      "[actions:sync] Failed to load the feed errors message translation.",
      namespaceError,
    );
    message = i18n.t("sidebar:sync_failed");
  }

  if (!isFetchErrorsNavigationCurrent(generation, screen)) {
    return;
  }
  useUiStore.getState().showToast({ message, severity: "error" });
}

type BufferedBrowserCloseAction = Extract<AppAction, "prev-article" | "next-article" | "prev-feed" | "next-feed">;
type GlobalActionDiagnosticCategory = "window" | "sync" | "browser" | "updates";
type GlobalActionRuntimeError = {
  type: "UserVisible";
  message: string;
  category: RuntimeActionErrorCategory;
  localeKey: `app_actions.errors.${RuntimeActionErrorCategory}`;
};

const actionDiagnosticPolicyByCategory = {
  window: "app-action-window",
  sync: "app-action-sync",
  browser: "app-action-browser",
  updates: "app-action-updates",
} as const satisfies Record<GlobalActionDiagnosticCategory, RuntimeDiagnosticPolicyId>;

let browserCloseStuckRecoveryScheduled = false;

/** Emit a keyboard-style DOM event that existing components already listen for. */
function emitEvent(name: string): void {
  window.dispatchEvent(new Event(name));
}

function emitArticleShareEvent(
  name:
    | typeof keyboardEvents.copyLink
    | typeof keyboardEvents.openExternalBrowser
    | typeof keyboardEvents.addToReadingList,
): void {
  emitEvent(name);
}

function logGlobalActionFailure(action: AppAction, category: GlobalActionDiagnosticCategory, error: unknown): void {
  logRuntimeDiagnostic(actionDiagnosticPolicyByCategory[category], `[actions:${category}] ${action} failed.`, error);
}

function toGlobalActionRuntimeError(error: unknown): GlobalActionRuntimeError {
  const message = error instanceof Error ? error.message : String(error);
  const category = classifyRuntimeActionErrorCategory(message);
  return {
    type: "UserVisible",
    message,
    category,
    localeKey: `app_actions.errors.${category}`,
  };
}

function runGlobalActionBoundary(
  action: AppAction,
  category: GlobalActionDiagnosticCategory,
  operation: () => Promise<void>,
): void {
  void Promise.resolve(operation()).catch((error: unknown) => {
    const actionError = toGlobalActionRuntimeError(error);
    logGlobalActionFailure(action, category, actionError);
    useUiStore.getState().showToast(actionError.message);
  });
}

/** Emit a navigation event with a direction detail. */
function emitNavigationEvent(name: string, direction: 1 | -1): void {
  window.dispatchEvent(new CustomEvent(name, { detail: direction }));
}

function queueBrowserCloseActionIfNeeded(action: BufferedBrowserCloseAction): boolean {
  const store = useUiStore.getState();
  if (store.subscriptionsWorkspace !== null) {
    return true;
  }
  if (!store.browserCloseInFlight) {
    return false;
  }

  store.setPendingBrowserCloseAction(action);
  emitDebugInputTrace(`queue ${action}`);
  scheduleBrowserCloseStuckRecovery();
  return true;
}

function scheduleBrowserCloseStuckRecovery(): void {
  const store = useUiStore.getState();
  if (browserCloseStuckRecoveryScheduled || store.contentMode !== "browser") {
    return;
  }

  browserCloseStuckRecoveryScheduled = true;
  window.setTimeout(() => {
    browserCloseStuckRecoveryScheduled = false;
    const latestStore = useUiStore.getState();
    if (!latestStore.browserCloseInFlight || latestStore.contentMode !== "browser") {
      return;
    }

    const selectedArticleId = latestStore.selectedArticleId;
    const pendingActions = [...latestStore.pendingBrowserCloseActionQueue];
    emitDebugInputTrace("recover browser-close pending");
    latestStore.closeBrowser();
    latestStore.setFocusedPane("list");
    focusArticleListTarget(selectedArticleId);
    flushPendingBrowserCloseAction(pendingActions);
  }, 0);
}

function dispatchBufferedBrowserCloseAction(action: BufferedBrowserCloseAction): void {
  switch (action) {
    case "prev-article":
      emitNavigationEvent(APP_EVENTS.navigateArticle, -1);
      break;
    case "next-article":
      emitNavigationEvent(APP_EVENTS.navigateArticle, 1);
      break;
    case "prev-feed":
      emitNavigationEvent(APP_EVENTS.navigateFeed, -1);
      break;
    case "next-feed":
      emitNavigationEvent(APP_EVENTS.navigateFeed, 1);
      break;
  }
}

function focusArticleListAfterClearingArticle(articleId: string | null): void {
  useUiStore.getState().setFocusedPane("list");
  scheduleReaderFocusFrame(() => {
    focusArticleListTarget(articleId);
  });
}

function focusSidebarSelection(): void {
  useUiStore.getState().setFocusedPane("sidebar");
  scheduleReaderFocusFrame(() => {
    focusSelectedSidebarTarget();
  });
}

function getFeedFolderId(feedId: string, accountId: string | null): string | null {
  const feeds = queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount(accountId));
  return feeds?.find((feed) => feed.id === feedId)?.folder_id ?? null;
}

async function navigateBrowserBackOrClose(): Promise<void> {
  const store = useUiStore.getState();
  if (!store.browserNavigationState?.canGoBack) {
    executeAction("close-browser");
    return;
  }

  Result.pipe(
    await goBackBrowserWebview(),
    Result.inspect((state) => {
      store.setBrowserNavigationState({
        canGoBack: state.can_go_back,
        canGoForward: state.can_go_forward,
      });
      if (!state.can_go_back) {
        executeAction("close-browser");
      }
    }),
    Result.inspectError((error) => {
      logGlobalActionFailure("mouse-back", "browser", error);
    }),
  );
}

async function navigateBrowserForward(): Promise<void> {
  if (!useUiStore.getState().browserNavigationState?.canGoForward) {
    return;
  }

  Result.pipe(
    await goForwardBrowserWebview(),
    Result.inspect((state) => {
      useUiStore.getState().setBrowserNavigationState({
        canGoBack: state.can_go_back,
        canGoForward: state.can_go_forward,
      });
    }),
    Result.inspectError((error) => {
      logGlobalActionFailure("mouse-forward", "browser", error);
    }),
  );
}

export function flushPendingBrowserCloseAction(pendingActionsOverride?: BufferedBrowserCloseAction[]): void {
  const store = useUiStore.getState();
  const pendingActions = pendingActionsOverride ?? [...store.pendingBrowserCloseActionQueue];
  store.setPendingBrowserCloseAction(null);
  store.setBrowserCloseInFlight(false);
  emitDebugInputTrace(`flush ${pendingActions.length === 0 ? "none" : pendingActions.join(",")}`);

  if (pendingActions.length === 0) {
    return;
  }

  for (const pendingAction of pendingActions) {
    dispatchBufferedBrowserCloseAction(pendingAction);
  }
}

/**
 * Toggle fullscreen mode via the Tauri window API.
 * Silently no-ops in browser (non-Tauri) contexts.
 */
async function toggleFullscreen(): Promise<void> {
  const fullscreenResult = await isWindowFullscreen();
  if (Result.isFailure(fullscreenResult)) {
    logRuntimeDiagnostic(
      "window-runtime-error",
      "Failed to read fullscreen state.",
      Result.unwrapError(fullscreenResult),
    );
    return;
  }

  const setFullscreenResult = await setWindowFullscreen(!Result.unwrap(fullscreenResult));
  if (Result.isFailure(setFullscreenResult)) {
    logRuntimeDiagnostic(
      "window-runtime-error",
      "Failed to update fullscreen state.",
      Result.unwrapError(setFullscreenResult),
    );
  }
}

async function restartApplication(): Promise<void> {
  if (import.meta.env.DEV) {
    // Tauri's native app.restart() detaches a new dev process from `cargo run`,
    // which can leave the relaunched window blank. Keep the dev shortcut scoped
    // to a frontend reload so the active dev session stays attached.
    window.location.reload();
    return;
  }

  const result = await restartApp();
  Result.pipe(
    result,
    Result.inspectError((error) => {
      useUiStore.getState().showToast(localizeUserVisibleAppErrorMessage(error.message));
      logRuntimeDiagnostic("app-action-window", "[actions:window] restart-app failed.", error);
    }),
  );
}

function requestApplicationRestart(): void {
  const store = useUiStore.getState();
  // The dialog title is derived from actionLabel, so the message must be distinct
  // copy; reusing the label rendered it as both the heading and the description.
  store.showConfirm(i18n.t("reader:confirm_restart_app"), restartApplication, {
    actionLabel: i18n.t("reader:command_palette.restart_app"),
    variant: "warning",
  });
}

function navigateUnlessBrowserCloseQueued(
  action: BufferedBrowserCloseAction,
  eventName: string,
  direction: 1 | -1,
): void {
  if (queueBrowserCloseActionIfNeeded(action)) {
    return;
  }
  emitNavigationEvent(eventName, direction);
}

function handleMouseBack(store: ReturnType<typeof useUiStore.getState>): void {
  if (store.contentMode === "browser") {
    void navigateBrowserBackOrClose();
    return;
  }
  if (store.selectedArticleId) {
    const previousArticleId = store.selectedArticleId;
    store.clearArticle();
    focusArticleListAfterClearingArticle(previousArticleId);
    return;
  }
  if (store.selection.type === "feed") {
    const folderId = getFeedFolderId(store.selection.feedId, store.selectedAccountId);
    if (folderId) {
      store.selectFolderFromCurrentContext(folderId);
      focusSidebarSelection();
      return;
    }
  }
  if (store.focusedPane === "list") {
    focusSidebarSelection();
  }
}

/**
 * Central action dispatcher.
 * Both keyboard shortcuts and native menu events call into this function.
 *
 * @param action - The action identifier string (e.g. "open-settings", "sync-all")
 */
export function executeAction(action: AppAction): void {
  const store = useUiStore.getState();

  switch (action) {
    // --- View filters ---
    case "set-filter-unread":
      store.setViewMode("unread");
      break;
    case "set-filter-all":
      store.setViewMode("all");
      break;
    case "set-filter-starred":
      store.setViewMode("starred");
      break;

    // --- Preference toggles ---
    case "toggle-sort-unread": {
      const current = resolvePreferenceValue(usePreferencesStore.getState().prefs, "reading_sort");
      usePreferencesStore
        .getState()
        .setPref("reading_sort", current === "newest_first" ? "oldest_first" : "newest_first");
      break;
    }
    case "toggle-group-by-feed": {
      const current = resolvePreferenceValue(usePreferencesStore.getState().prefs, "group_by");
      usePreferencesStore.getState().setPref("group_by", current === "date" ? "feed" : "date");
      break;
    }
    case "set-theme-light":
      usePreferencesStore.getState().setPref("theme", "light");
      break;
    case "set-theme-dark":
      usePreferencesStore.getState().setPref("theme", "dark");
      break;
    case "set-theme-system":
      usePreferencesStore.getState().setPref("theme", "system");
      break;

    // --- Window ---
    case "toggle-fullscreen":
      runGlobalActionBoundary(action, "window", toggleFullscreen);
      break;

    // --- Sync ---
    case "sync-all": {
      runGlobalActionBoundary(action, "sync", () =>
        triggerManualSyncWithCooldown({
          onCooldown: () => {
            store.showToast(i18n.t("sidebar:sync_cooldown_active"));
          },
          onSuccess: (syncResult) => {
            const feedback = summarizeSyncResult(syncResult);
            const message = resolveSyncFeedbackMessage(feedback, {
              alreadyInProgress: i18n.t("sidebar:sync_already_in_progress"),
              partialFailure: (accounts) => i18n.t("sidebar:sync_partial_failure", { accounts }),
              retryScheduled: (accounts) => i18n.t("sidebar:sync_completed_with_retry_pending", { accounts }),
              retryPending: (accounts) => i18n.t("sidebar:sync_completed_with_retry_pending", { accounts }),
              warnings: (accounts) => i18n.t("sidebar:sync_completed_with_warnings", { accounts }),
              localFeedSyncFailures: (count) => i18n.t("sidebar:sync_local_feed_failures", { count }),
              success: i18n.t("sidebar:sync_completed"),
              detailLine: (detail, remainingCount) => {
                const { key, params } = getSyncWarningDetailTranslationKey(detail, (labelType, rawValue) =>
                  i18n.t(`sidebar:sync_warning_detail.${labelType}_labels.${rawValue}`, { defaultValue: rawValue }),
                );
                const detailText = i18n.t(`sidebar:sync_warning_detail.${key}`, params);
                return remainingCount > 0
                  ? `${detailText} ${i18n.t("sidebar:sync_warning_detail_more", { count: remainingCount })}`
                  : detailText;
              },
            });
            const action = feedback.localFeedSyncFailureAccountId
              ? createFetchErrorsToastAction(
                  feedback.localFeedSyncFailureAccountId,
                  i18n.t("sidebar:sync_local_feed_failures_details"),
                )
              : null;
            store.showToast(action ? { message, actions: [action] } : message);
          },
          onError: (e) => {
            logGlobalActionFailure(action, "sync", e);
            store.showToast(i18n.t("sidebar:sync_failed_with_message", { message: e.message }));
          },
        }),
      );
      break;
    }

    // --- Settings & dialogs ---
    case "open-settings":
      store.openSettings();
      break;
    case "open-current-account-settings":
      if (store.selectedAccountId) {
        store.openSettingsAccount(store.selectedAccountId);
      } else {
        store.openSettings("accounts");
      }
      break;
    case "open-settings-accounts":
      store.openSettings("accounts");
      break;
    case "open-settings-accounts-add":
      store.openSettingsAddAccount();
      break;
    case "open-settings-accounts-add-freshrss":
      store.openSettingsAddAccount("FreshRss");
      break;
    case "open-add-feed":
      store.openAddFeedDialog();
      break;
    case "open-subscriptions-index":
      store.openSubscriptionsIndex();
      break;
    case "open-command-palette":
      store.toggleCommandPalette();
      break;
    case "restart-app":
      requestApplicationRestart();
      break;

    // --- Article navigation ---
    case "prev-article":
      navigateUnlessBrowserCloseQueued("prev-article", APP_EVENTS.navigateArticle, -1);
      break;
    case "next-article":
      navigateUnlessBrowserCloseQueued("next-article", APP_EVENTS.navigateArticle, 1);
      break;

    // --- Feed navigation ---
    case "prev-feed":
      navigateUnlessBrowserCloseQueued("prev-feed", APP_EVENTS.navigateFeed, -1);
      break;
    case "next-feed":
      navigateUnlessBrowserCloseQueued("next-feed", APP_EVENTS.navigateFeed, 1);
      break;

    // --- Browser ---
    case "reload-webview":
      runGlobalActionBoundary(action, "browser", async () => {
        const result = await reloadBrowserWebview();
        Result.pipe(
          result,
          Result.inspectError((error) => {
            logGlobalActionFailure(action, "browser", error);
          }),
        );
      });
      break;
    case "close-browser":
      if (store.selectedArticleId && store.contentMode === "browser") {
        emitEvent(keyboardEvents.closeBrowserOverlay);
      } else {
        store.closeBrowser();
      }
      break;
    case "mouse-back":
      handleMouseBack(store);
      break;
    case "mouse-forward":
      if (store.contentMode === "browser") {
        void navigateBrowserForward();
      }
      break;

    // --- Article actions (reuse existing keyboard event system) ---
    case "open-in-reader":
      emitEvent(keyboardEvents.openInAppBrowser);
      break;
    case "open-in-browser":
      emitEvent(keyboardEvents.openExternalBrowser);
      break;
    case "toggle-star":
      emitEvent(keyboardEvents.toggleStar);
      break;
    case "toggle-read":
      emitEvent(keyboardEvents.toggleRead);
      break;
    case "mark-all-read":
      emitEvent(keyboardEvents.markAllRead);
      break;

    // --- Share actions ---
    case "copy-link":
      emitArticleShareEvent(keyboardEvents.copyLink);
      break;
    case "open-in-default-browser":
      emitArticleShareEvent(keyboardEvents.openExternalBrowser);
      break;
    case "add-to-reading-list":
      emitArticleShareEvent(keyboardEvents.addToReadingList);
      break;

    // --- Updater ---
    case "check-for-updates": {
      runGlobalActionBoundary(action, "updates", runManualUpdateCheck);
      break;
    }

    default: {
      const _exhaustive: never = action;
      console.warn(`[actions] Unknown action: ${_exhaustive}`);
      break;
    }
  }
}
