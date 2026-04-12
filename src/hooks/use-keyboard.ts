import { Result } from "@praha/byethrow";
import { useEffect, useMemo } from "react";
import { executeAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
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
      const targetElement = e.target instanceof Element ? e.target : null;
      if (targetElement?.closest('[data-disable-global-shortcuts="true"]')) {
        return;
      }

      const action = resolveKeyboardAction({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        targetTag: targetElement?.tagName,
        selectedArticleId: store.selectedArticleId,
        contentMode: store.contentMode,
        viewMode: store.viewMode,
        keyToAction,
      });

      if (Result.isFailure(action)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const resolvedAction = Result.unwrap(action);
      emitDebugInputTrace(`window-key ${e.key} -> ${resolvedAction.type}`);

      switch (resolvedAction.type) {
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
          emitKeyboardEvent(resolvedAction.eventName);
          break;
        case "set-view-mode":
          executeAction(`set-filter-${resolvedAction.mode}`);
          break;
        case "close-browser":
          executeAction("close-browser");
          break;
        case "clear-article":
          store.clearArticle();
          break;
        case "toggle-sidebar":
          store.toggleSidebar();
          break;
        case "focus-sidebar":
          store.openSidebar();
          break;
        case "navigate-article":
          executeAction(resolvedAction.direction === 1 ? "next-article" : "prev-article");
          break;
        case "navigate-feed":
          executeAction(resolvedAction.direction === 1 ? "next-feed" : "prev-feed");
          break;
        case "reload-webview":
          executeAction("reload-webview");
          break;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [store, keyToAction]);
}
