import { useEffect } from "react";
import { useUiStore } from "../stores/ui-store";

export function useKeyboard() {
  const store = useUiStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle if input/textarea is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key;
      const shift = e.shiftKey;

      switch (key) {
        case "j": // Next item
          e.preventDefault();
          // TODO: navigate to next article in list
          break;
        case "k": // Previous item
          e.preventDefault();
          // TODO: navigate to previous article in list
          break;
        case "m": // Toggle read
          e.preventDefault();
          // TODO: toggle read on selected article
          break;
        case "s": // Toggle starred
          e.preventDefault();
          // TODO: toggle star on selected article
          break;
        case "v": // View in browser
          e.preventDefault();
          if (store.selectedArticleId) {
            // TODO: get article URL and open browser view
          }
          break;
        case "b": // Open in external browser
          e.preventDefault();
          // TODO: open in system browser
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
          // TODO: mark all as read
          break;
        case "/": // Search
          e.preventDefault();
          // TODO: focus search input
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
