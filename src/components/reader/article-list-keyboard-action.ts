import { executeAction } from "@/lib/actions";
import type { KeyboardAction } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

type HandleArticleListKeyboardActionParams = {
  action: KeyboardAction;
  clearArticle: () => void;
  toggleSidebar: () => void;
  openSidebar: () => void;
};

export function handleArticleListKeyboardAction({
  action,
  clearArticle,
  toggleSidebar,
  openSidebar,
}: HandleArticleListKeyboardActionParams) {
  switch (action.type) {
    case "open-settings":
      executeAction("open-settings");
      break;
    case "open-command-palette":
      executeAction("open-command-palette");
      break;
    case "open-shortcuts-help":
      useUiStore.getState().openShortcutsHelp();
      break;
    case "emit":
      window.dispatchEvent(new Event(action.eventName));
      break;
    case "set-view-mode":
      executeAction(`set-filter-${action.mode}`);
      break;
    case "close-browser":
      executeAction("close-browser");
      break;
    case "clear-article":
      clearArticle();
      break;
    case "toggle-sidebar":
      toggleSidebar();
      break;
    case "focus-sidebar":
      openSidebar();
      break;
    case "navigate-article":
      executeAction(action.direction === 1 ? "next-article" : "prev-article");
      break;
    case "navigate-feed":
      executeAction(action.direction === 1 ? "next-feed" : "prev-feed");
      break;
    case "reload-webview":
      executeAction("reload-webview");
      break;
    case "noop":
      break;
  }
}
