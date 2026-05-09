import { Result } from "@praha/byethrow";
import { goBackBrowserWebview, goForwardBrowserWebview, reloadBrowserWebview } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import { runManualUpdateCheck } from "@/hooks/use-updater";
import type { AppAction } from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import i18n from "@/lib/i18n";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { focusArticleListTarget, focusSelectedSidebarTarget } from "@/lib/reader-focus";
import { triggerManualSyncWithCooldown } from "@/lib/sync/manual-sync";
import { resolveSyncFeedbackMessage, summarizeSyncResult } from "@/lib/sync/sync-result-feedback";
import { isWindowFullscreen, setWindowFullscreen } from "@/lib/window/windows";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export type { AppAction } from "@/lib/app-actions";
export { isAppAction } from "@/lib/app-actions";

type BufferedBrowserCloseAction = Extract<AppAction, "prev-article" | "next-article" | "prev-feed" | "next-feed">;

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

/** Emit a navigation event with a direction detail. */
function emitNavigationEvent(name: string, direction: 1 | -1): void {
  window.dispatchEvent(new CustomEvent(name, { detail: direction }));
}

function queueBrowserCloseActionIfNeeded(action: BufferedBrowserCloseAction): boolean {
  const store = useUiStore.getState();
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
  requestAnimationFrame(() => {
    focusArticleListTarget(articleId);
  });
}

function focusSidebarSelection(): void {
  useUiStore.getState().setFocusedPane("sidebar");
  requestAnimationFrame(() => {
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
      console.error("Menu webview back failed:", error);
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
      console.error("Menu webview forward failed:", error);
    }),
  );
}

export function flushPendingBrowserCloseAction(): void {
  const store = useUiStore.getState();
  const pendingAction = store.pendingBrowserCloseAction;
  store.setPendingBrowserCloseAction(null);
  store.setBrowserCloseInFlight(false);
  emitDebugInputTrace(`flush ${pendingAction ?? "none"}`);

  if (!pendingAction) {
    return;
  }

  dispatchBufferedBrowserCloseAction(pendingAction);
}

/**
 * Toggle fullscreen mode via the Tauri window API.
 * Silently no-ops in browser (non-Tauri) contexts.
 */
async function toggleFullscreen(): Promise<void> {
  const fullscreenResult = await isWindowFullscreen();
  if (Result.isFailure(fullscreenResult)) {
    return;
  }

  await setWindowFullscreen(!Result.unwrap(fullscreenResult));
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
      toggleFullscreen();
      break;

    // --- Sync ---
    case "sync-all": {
      void triggerManualSyncWithCooldown({
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
          console.error("Menu sync failed:", e);
          store.showToast(i18n.t("sidebar:sync_failed_with_message", { message: e.message }));
        },
      });
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
      if (!import.meta.env.DEV) {
        break;
      }
      // Tauri's native app.restart() detaches a new dev process from `cargo run`,
      // which can leave the relaunched window blank. Keep the dev shortcut scoped
      // to a frontend reload so the active dev session stays attached.
      window.location.reload();
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
      void reloadBrowserWebview().then((result) => {
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Menu webview reload failed:", error);
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
      void runManualUpdateCheck();
      break;
    }

    default: {
      const _exhaustive: never = action;
      console.warn(`[actions] Unknown action: ${_exhaustive}`);
      break;
    }
  }
}
