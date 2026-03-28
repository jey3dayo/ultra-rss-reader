import { Result } from "@praha/byethrow";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

/** Custom DOM event names used by the action system. */
export const actionEvents = {
  navigateFeed: "ultra-rss:navigate-feed",
} as const;

/** Emit a keyboard-style DOM event that existing components already listen for. */
function emitEvent(name: string): void {
  window.dispatchEvent(new Event(name));
}

/** Emit a navigation event with a direction detail. */
function emitNavigationEvent(name: string, direction: 1 | -1): void {
  window.dispatchEvent(new CustomEvent(name, { detail: direction }));
}

const NAVIGATE_ARTICLE_EVENT = "ultra-rss:navigate-article";

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
export function executeAction(action: string): void {
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
      import("@/api/tauri-commands").then(({ triggerSync }) => {
        triggerSync().then((result) =>
          Result.pipe(
            result,
            Result.inspect((synced) => {
              store.showToast(synced ? "Sync completed" : "Sync already in progress");
            }),
            Result.inspectError((e) => {
              console.error("Menu sync failed:", e);
              store.showToast(`Sync failed: ${e.message}`);
            }),
          ),
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

    // --- Article navigation ---
    case "prev-article":
      emitNavigationEvent(NAVIGATE_ARTICLE_EVENT, -1);
      break;
    case "next-article":
      emitNavigationEvent(NAVIGATE_ARTICLE_EVENT, 1);
      break;

    // --- Feed navigation ---
    case "prev-feed":
      emitNavigationEvent(actionEvents.navigateFeed, -1);
      break;
    case "next-feed":
      emitNavigationEvent(actionEvents.navigateFeed, 1);
      break;

    // --- Browser ---
    case "reload-webview": {
      const iframe = document.querySelector<HTMLIFrameElement>("iframe");
      if (iframe?.contentWindow) {
        iframe.contentWindow.location.reload();
      } else if (iframe?.src) {
        // Fallback: force reload by re-setting src
        const currentSrc = iframe.src;
        iframe.src = "";
        iframe.src = currentSrc;
      }
      break;
    }

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

    default:
      console.warn(`[actions] Unknown action: ${action}`);
      break;
  }
}
