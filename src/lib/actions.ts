import { Result } from "@praha/byethrow";
import { reloadBrowserWebview, triggerSync } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import { runManualUpdateCheck } from "@/hooks/use-updater";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import i18n from "@/lib/i18n";
import { keyboardEvents, type ViewMode } from "@/lib/keyboard-shortcuts";
import { resolveSyncFeedbackMessage, summarizeSyncResult } from "@/lib/sync-result-feedback";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

/** All valid action identifiers dispatched via executeAction. */
export type AppAction =
  | `set-filter-${ViewMode}`
  | "toggle-sort-unread"
  | "toggle-group-by-feed"
  | "toggle-fullscreen"
  | "sync-all"
  | "open-settings"
  | "open-settings-accounts"
  | "open-settings-accounts-add"
  | "open-add-feed"
  | "open-feed-cleanup"
  | "open-command-palette"
  | "prev-article"
  | "next-article"
  | "prev-feed"
  | "next-feed"
  | "reload-webview"
  | "close-browser"
  | "open-in-reader"
  | "open-in-browser"
  | "toggle-star"
  | "toggle-read"
  | "mark-all-read"
  | "copy-link"
  | "open-in-default-browser"
  | "add-to-reading-list"
  | "check-for-updates";

/** Set of all valid action strings, used for runtime validation at IPC boundaries. */
const appActions = new Set<string>([
  "set-filter-unread",
  "set-filter-all",
  "set-filter-starred",
  "toggle-sort-unread",
  "toggle-group-by-feed",
  "toggle-fullscreen",
  "sync-all",
  "open-settings",
  "open-settings-accounts",
  "open-settings-accounts-add",
  "open-add-feed",
  "open-feed-cleanup",
  "open-command-palette",
  "prev-article",
  "next-article",
  "prev-feed",
  "next-feed",
  "reload-webview",
  "close-browser",
  "open-in-reader",
  "open-in-browser",
  "toggle-star",
  "toggle-read",
  "mark-all-read",
  "copy-link",
  "open-in-default-browser",
  "add-to-reading-list",
  "check-for-updates",
]);

type BufferedBrowserCloseAction = Extract<AppAction, "prev-article" | "next-article" | "prev-feed" | "next-feed">;

/** Runtime type guard for validating action strings from external sources (e.g. Tauri IPC). */
export function isAppAction(value: string): value is AppAction {
  return appActions.has(value);
}

/** Emit a keyboard-style DOM event that existing components already listen for. */
function emitEvent(name: string): void {
  window.dispatchEvent(new Event(name));
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
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    const isFullscreen = await win.isFullscreen();
    await win.setFullscreen(!isFullscreen);
  } catch {
    // Non-Tauri context (browser dev mode) — no-op
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
      const current = usePreferencesStore.getState().prefs.sort_unread ?? "newest_first";
      usePreferencesStore
        .getState()
        .setPref("sort_unread", current === "newest_first" ? "oldest_first" : "newest_first");
      break;
    }
    case "toggle-group-by-feed": {
      const current = usePreferencesStore.getState().prefs.group_by ?? "date";
      usePreferencesStore.getState().setPref("group_by", current === "date" ? "feed" : "date");
      break;
    }

    // --- Window ---
    case "toggle-fullscreen":
      toggleFullscreen();
      break;

    // --- Sync ---
    case "sync-all": {
      store.setAppLoading(true);
      triggerSync().then((result) => {
        store.setAppLoading(false);
        Result.pipe(
          result,
          Result.inspect((syncResult) => {
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
          }),
          Result.inspectError((e) => {
            console.error("Menu sync failed:", e);
            store.showToast(i18n.t("sidebar:sync_failed_with_message", { message: e.message }));
          }),
        );
      });
      break;
    }

    // --- Settings & dialogs ---
    case "open-settings":
      store.openSettings();
      break;
    case "open-settings-accounts":
      store.openSettings("accounts");
      break;
    case "open-settings-accounts-add":
      store.openSettings("accounts");
      store.setSettingsAddAccount(true);
      break;
    case "open-add-feed":
      store.openAddFeedDialog();
      break;
    case "open-feed-cleanup":
      store.openFeedCleanup();
      break;
    case "open-command-palette":
      store.toggleCommandPalette();
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
      emitEvent(keyboardEvents.copyLink);
      break;
    case "open-in-default-browser":
      emitEvent(keyboardEvents.openExternalBrowser);
      break;
    case "add-to-reading-list":
      emitEvent(keyboardEvents.addToReadingList);
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
