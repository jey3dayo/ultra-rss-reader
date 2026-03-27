import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { type keyboardEvents, resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "../stores/ui-store";

function emitKeyboardEvent(name: (typeof keyboardEvents)[keyof typeof keyboardEvents]) {
  window.dispatchEvent(new Event(name));
}

export function useKeyboard() {
  const store = useUiStore();

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
      });

      if (Result.isFailure(action)) {
        return;
      }

      e.preventDefault();
      const resolvedAction = Result.unwrap(action);

      switch (resolvedAction.type) {
        case "open-settings":
          store.openSettings();
          break;
        case "emit":
          emitKeyboardEvent(resolvedAction.eventName);
          break;
        case "set-view-mode":
          store.setViewMode(resolvedAction.mode);
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
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);
}
