import { Result } from "@praha/byethrow";
import { goBackBrowserWebview, goForwardBrowserWebview, reloadBrowserWebview, restartApp } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import { runManualUpdateCheck } from "@/hooks/use-updater";
import type { AppAction } from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import i18n from "@/lib/i18n";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { focusArticleListTarget, focusSelectedSidebarTarget, scheduleReaderFocusFrame } from "@/lib/reader-focus";
import { logRuntimeDiagnostic, type RuntimeDiagnosticPolicyId } from "@/lib/runtime/diagnostics";
import { triggerManualSyncWithCooldown } from "@/lib/sync/manual-sync";
import { resolveSyncFeedbackMessage, summarizeSyncResult } from "@/lib/sync/sync-result-feedback";
import { classifyRuntimeActionErrorCategory, type RuntimeActionErrorCategory } from "@/lib/ui-errors";
import { isWindowFullscreen, setWindowFullscreen } from "@/lib/window/windows";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export type { AppAction } from "@/lib/app-actions";
export { isAppAction } from "@/lib/app-actions";

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
  return true;
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

export function flushPendingBrowserCloseAction(): void {
  const store = useUiStore.getState();
  const pendingActions = [...store.pendingBrowserCloseActionQueue];
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
      useUiStore.getState().showToast(error.message);
      logRuntimeDiagnostic("app-action-window", "[actions:window] restart-app failed.", error);
    }),
  );
}

function requestApplicationRestart(): void {
  const store = useUiStore.getState();
  const label = i18n.t("reader:command_palette.restart_app");
  store.showConfirm(label, restartApplication, {
    actionLabel: label,
    variant: "warning",
  });
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
      const prefs = usePreferencesStore.getState().prefs;
      const current = prefs.reading_sort ?? prefs.sort_unread ?? "newest_first";
      usePreferencesStore
        .getState()
        .setPref("reading_sort", current === "newest_first" ? "oldest_first" : "newest_first");
      break;
    }
    case "toggle-group-by-feed": {
      const current = usePreferencesStore.getState().prefs.group_by ?? "date";
      usePreferencesStore.getState().setPref("group_by", current === "date" ? "feed" : "date");
      break;
    }
    case "set-theme-light":
      usePreferencesStore.getState().setPref("theme", "light");
      break;
    case "set-theme-dark":
      usePreferencesStore.getState().setPref("theme", "dark");
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
            store.showToast(
              resolveSyncFeedbackMessage(summarizeSyncResult(syncResult), {
                alreadyInProgress: i18n.t("sidebar:sync_already_in_progress"),
                partialFailure: (accounts) => i18n.t("sidebar:sync_partial_failure", { accounts }),
                retryScheduled: (accounts) => i18n.t("sidebar:sync_completed_with_retry_pending", { accounts }),
                retryPending: (accounts) => i18n.t("sidebar:sync_completed_with_retry_pending", { accounts }),
                warnings: (accounts) => i18n.t("sidebar:sync_completed_with_warnings", { accounts }),
                success: i18n.t("sidebar:sync_completed"),
              }),
            );
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
      if (queueBrowserCloseActionIfNeeded("prev-article")) {
        break;
      }
      emitNavigationEvent(APP_EVENTS.navigateArticle, -1);
      break;
    case "next-article":
      if (queueBrowserCloseActionIfNeeded("next-article")) {
        break;
      }
      emitNavigationEvent(APP_EVENTS.navigateArticle, 1);
      break;

    // --- Feed navigation ---
    case "prev-feed":
      if (queueBrowserCloseActionIfNeeded("prev-feed")) {
        break;
      }
      emitNavigationEvent(APP_EVENTS.navigateFeed, -1);
      break;
    case "next-feed":
      if (queueBrowserCloseActionIfNeeded("next-feed")) {
        break;
      }
      emitNavigationEvent(APP_EVENTS.navigateFeed, 1);
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
      if (store.contentMode === "browser") {
        void navigateBrowserBackOrClose();
        break;
      }
      if (store.selectedArticleId) {
        const previousArticleId = store.selectedArticleId;
        store.clearArticle();
        focusArticleListAfterClearingArticle(previousArticleId);
        break;
      }
      if (store.focusedPane === "list") {
        focusSidebarSelection();
      }
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
