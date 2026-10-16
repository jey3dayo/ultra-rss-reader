import { Result } from "@praha/byethrow";
import {
  type FeedDto,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  reloadBrowserWebview,
  restartApp,
} from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import { runManualUpdateCheck } from "@/hooks/use-updater";
import type { AppAction } from "@/lib/app-actions";
import i18n from "@/lib/i18n";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import { focusArticleListTarget, focusSelectedSidebarTarget, scheduleReaderFocusFrame } from "@/lib/reader-focus";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { triggerManualSyncWithCooldown } from "@/lib/sync/manual-sync";
import {
  getSyncWarningDetailTranslationKey,
  resolveSyncFeedbackMessage,
  summarizeSyncResult,
} from "@/lib/sync/sync-result-feedback";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { classifyRuntimeActionErrorCategory, type RuntimeActionErrorCategory } from "@/lib/ui-errors";
import { isWindowFullscreen, setWindowFullscreen } from "@/lib/window/tauri-window";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import type { BufferedBrowserCloseAction } from "./browser-close-action-buffer";
import { emitNavigationEvent, queueBrowserCloseActionIfNeeded } from "./browser-close-action-buffer";
import type { GlobalActionDiagnosticCategory } from "./fetch-errors-navigation";
import { actionDiagnosticPolicyByCategory, createFetchErrorsToastAction } from "./fetch-errors-navigation";

export type { AppAction } from "@/lib/app-actions";
export { isAppAction } from "@/lib/app-actions";
export { flushPendingBrowserCloseAction } from "./browser-close-action-buffer";
export { createFetchErrorsToastAction } from "./fetch-errors-navigation";

type GlobalActionRuntimeError = {
  type: "UserVisible";
  message: string;
  category: RuntimeActionErrorCategory;
  localeKey: `app_actions.errors.${RuntimeActionErrorCategory}`;
};

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

  if (
    runViewPreferenceAction(action, store) ||
    runSystemAction(action, store) ||
    runSettingsDialogAction(action, store) ||
    runNavigationBrowserAction(action, store) ||
    runArticleAction(action)
  ) {
    return;
  }

  console.warn(`[actions] Unknown action: ${action}`);
}

type UiStoreState = ReturnType<typeof useUiStore.getState>;

function runViewPreferenceAction(action: AppAction, store: UiStoreState): boolean {
  switch (action) {
    // --- View filters ---
    case "set-filter-unread":
      store.setViewMode("unread");
      return true;
    case "set-filter-all":
      store.setViewMode("all");
      return true;
    case "set-filter-starred":
      store.setViewMode("starred");
      return true;

    // --- Preference toggles ---
    case "toggle-sort-unread": {
      const current = resolvePreferenceValue(usePreferencesStore.getState().prefs, "reading_sort");
      usePreferencesStore
        .getState()
        .setPref("reading_sort", current === "newest_first" ? "oldest_first" : "newest_first");
      return true;
    }
    case "toggle-group-by-feed": {
      const current = resolvePreferenceValue(usePreferencesStore.getState().prefs, "group_by");
      usePreferencesStore.getState().setPref("group_by", current === "date" ? "feed" : "date");
      return true;
    }
    case "set-theme-light":
      usePreferencesStore.getState().setPref("theme", "light");
      return true;
    case "set-theme-dark":
      usePreferencesStore.getState().setPref("theme", "dark");
      return true;
    case "set-theme-system":
      usePreferencesStore.getState().setPref("theme", "system");
      return true;
    default:
      return false;
  }
}

function runSyncAllAction(action: AppAction, store: UiStoreState): void {
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
}

function runSystemAction(action: AppAction, store: UiStoreState): boolean {
  switch (action) {
    // --- Window ---
    case "toggle-fullscreen":
      runGlobalActionBoundary(action, "window", toggleFullscreen);
      return true;

    // --- Sync ---
    case "sync-all":
      runSyncAllAction(action, store);
      return true;

    // --- Updater ---
    case "check-for-updates":
      runGlobalActionBoundary(action, "updates", runManualUpdateCheck);
      return true;
    case "restart-app":
      requestApplicationRestart();
      return true;
    default:
      return false;
  }
}

function runSettingsDialogAction(action: AppAction, store: UiStoreState): boolean {
  switch (action) {
    // --- Settings & dialogs ---
    case "open-settings":
      store.openSettings();
      return true;
    case "open-current-account-settings":
      if (store.selectedAccountId) {
        store.openSettingsAccount(store.selectedAccountId);
      } else {
        store.openSettings("accounts");
      }
      return true;
    case "open-settings-accounts":
      store.openSettings("accounts");
      return true;
    case "open-settings-accounts-add":
      store.openSettingsAddAccount();
      return true;
    case "open-settings-accounts-add-freshrss":
      store.openSettingsAddAccount("FreshRss");
      return true;
    case "open-add-feed":
      store.openAddFeedDialog();
      return true;
    case "open-subscriptions-index":
      store.openSubscriptionsIndex();
      return true;
    case "open-command-palette":
      store.toggleCommandPalette();
      return true;
    default:
      return false;
  }
}

function runNavigationBrowserAction(action: AppAction, store: UiStoreState): boolean {
  switch (action) {
    // --- Article navigation ---
    case "prev-article":
      navigateUnlessBrowserCloseQueued("prev-article", APP_EVENTS.navigateArticle, -1);
      return true;
    case "next-article":
      navigateUnlessBrowserCloseQueued("next-article", APP_EVENTS.navigateArticle, 1);
      return true;

    // --- Feed navigation ---
    case "prev-feed":
      navigateUnlessBrowserCloseQueued("prev-feed", APP_EVENTS.navigateFeed, -1);
      return true;
    case "next-feed":
      navigateUnlessBrowserCloseQueued("next-feed", APP_EVENTS.navigateFeed, 1);
      return true;

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
      return true;
    case "close-browser":
      if (store.selectedArticleId && store.contentMode === "browser") {
        emitEvent(keyboardEvents.closeBrowserOverlay);
      } else {
        store.closeBrowser();
      }
      return true;
    case "mouse-back":
      handleMouseBack(store);
      return true;
    case "mouse-forward":
      if (store.contentMode === "browser") {
        void navigateBrowserForward();
      }
      return true;
    default:
      return false;
  }
}

function runArticleAction(action: AppAction): boolean {
  switch (action) {
    // --- Article actions (reuse existing keyboard event system) ---
    case "open-in-reader":
      emitEvent(keyboardEvents.openInAppBrowser);
      return true;
    case "open-in-browser":
      emitEvent(keyboardEvents.openExternalBrowser);
      return true;
    case "toggle-star":
      emitEvent(keyboardEvents.toggleStar);
      return true;
    case "toggle-read":
      emitEvent(keyboardEvents.toggleRead);
      return true;
    case "mark-all-read":
      emitEvent(keyboardEvents.markAllRead);
      return true;

    // --- Share actions ---
    case "copy-link":
      emitArticleShareEvent(keyboardEvents.copyLink);
      return true;
    case "open-in-default-browser":
      emitArticleShareEvent(keyboardEvents.openExternalBrowser);
      return true;
    case "add-to-reading-list":
      emitArticleShareEvent(keyboardEvents.addToReadingList);
      return true;
    default:
      return false;
  }
}
