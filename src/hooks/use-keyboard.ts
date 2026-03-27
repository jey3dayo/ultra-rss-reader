import { useEffect } from "react";
import { useUiStore } from "../stores/ui-store";

export const keyboardEvents = {
  toggleRead: "ultra-rss:toggle-read",
  toggleStar: "ultra-rss:toggle-star",
  openInAppBrowser: "ultra-rss:open-in-app-browser",
  openExternalBrowser: "ultra-rss:open-external-browser",
  markAllRead: "ultra-rss:mark-all-read",
  focusSearch: "ultra-rss:focus-search",
} as const;

function emitKeyboardEvent(name: (typeof keyboardEvents)[keyof typeof keyboardEvents]) {
  window.dispatchEvent(new Event(name));
}

export function useKeyboard() {
  const store = useUiStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘, or Ctrl+, to open Settings (works even when input focused)
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        store.openSettings();
        return;
      }

      // Don't handle if input/textarea is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key;
      const shift = e.shiftKey;

      switch (key) {
        case "j": // Next item — handled by ArticleList component
        case "k": // Previous item — handled by ArticleList component
          break;
        case "m": // Toggle read
          e.preventDefault();
          if (store.selectedArticleId) {
            emitKeyboardEvent(keyboardEvents.toggleRead);
          }
          break;
        case "s": // Toggle starred
          e.preventDefault();
          if (store.selectedArticleId) {
            emitKeyboardEvent(keyboardEvents.toggleStar);
          }
          break;
        case "v": // View in browser
          e.preventDefault();
          if (store.selectedArticleId) {
            emitKeyboardEvent(keyboardEvents.openInAppBrowser);
          }
          break;
        case "b": // Open in external browser
          e.preventDefault();
          if (store.selectedArticleId) {
            emitKeyboardEvent(keyboardEvents.openExternalBrowser);
          }
          break;
        case "r":
          if (shift) {
            e.preventDefault();
            // Shift+R: Sync current
          } else {
            e.preventDefault();
            // R: Sync all
          }
          break;
        case "f": {
          // Filter
          e.preventDefault();
          // Cycle filter: all -> unread -> starred -> all
          const modes = ["all", "unread", "starred"] as const;
          const idx = modes.indexOf(store.viewMode);
          store.setViewMode(modes[(idx + 1) % 3]);
          break;
        }
        case "a": // Mark all as read
          e.preventDefault();
          emitKeyboardEvent(keyboardEvents.markAllRead);
          break;
        case "/": // Search
          e.preventDefault();
          emitKeyboardEvent(keyboardEvents.focusSearch);
          break;
        case "Escape":
          e.preventDefault();
          if (store.contentMode === "browser") {
            store.closeBrowser();
          } else if (store.selectedArticleId) {
            store.clearArticle();
          }
          break;
        case "u": // Show accounts
          e.preventDefault();
          store.setFocusedPane("sidebar");
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);
}
