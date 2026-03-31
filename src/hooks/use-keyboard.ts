import { Result } from "@praha/byethrow";
import { useEffect, useMemo } from "react";
import { APP_EVENTS } from "@/constants/events";
import { executeAction } from "@/lib/actions";
import { buildKeyToActionMap, type keyboardEvents, resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "../stores/ui-store";

function emitKeyboardEvent(name: (typeof keyboardEvents)[keyof typeof keyboardEvents]) {
  window.dispatchEvent(new Event(name));
}

export function useKeyboard() {
  const store = useUiStore();
  const prefs = usePreferencesStore((s) => s.prefs);

  const keyToAction = useMemo(() => buildKeyToActionMap(prefs), [prefs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const action = resolveKeyboardAction({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        targetTag: (e.target as HTMLElement | null)?.tagName,
        selectedArticleId: store.selectedArticleId,
        contentMode: store.contentMode,
        viewMode: store.viewMode,
        keyToAction,
      });

      if (Result.isFailure(action)) {
        return;
      }

      e.preventDefault();
      const resolvedAction = Result.unwrap(action);

      switch (resolvedAction.type) {
        case "open-settings":
          executeAction("open-settings");
          break;
        case "open-command-palette":
          executeAction("open-command-palette");
          break;
        case "emit":
          emitKeyboardEvent(resolvedAction.eventName);
          break;
        case "set-view-mode":
          executeAction(`set-filter-${resolvedAction.mode}`);
          break;
        case "close-browser":
          store.closeBrowser();
          break;
        case "clear-article":
          store.clearArticle();
          break;
        case "focus-sidebar":
          store.setFocusedPane("sidebar");
          break;
        case "navigate-article":
          window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: resolvedAction.direction }));
          break;
        case "navigate-feed":
          executeAction(resolvedAction.direction === 1 ? "next-feed" : "prev-feed");
          break;
        case "reload-webview":
          executeAction("reload-webview");
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, keyToAction]);
}
