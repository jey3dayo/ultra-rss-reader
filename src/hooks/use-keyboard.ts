import { Result } from "@praha/byethrow";
import { useEffect, useMemo } from "react";
import { executeAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { buildKeyToActionMap, type keyboardEvents, resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { focusArticleListRowTargetWhenReady, focusSelectedSidebarTarget } from "@/lib/reader-focus";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window-events";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "../stores/ui-store";

function emitKeyboardEvent(name: (typeof keyboardEvents)[keyof typeof keyboardEvents]) {
  window.dispatchEvent(new Event(name));
}

function isTextEditingTarget(target: Element | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

export function useKeyboard() {
  const store = useUiStore();
  const prefs = usePreferencesStore((s) => s.prefs);

  const keyToAction = useMemo(() => buildKeyToActionMap(prefs), [prefs]);

  useEffect(() => {
    const handler = createKeyboardEventListener((e) => {
      const targetElement = e.target instanceof Element ? e.target : null;
      if (targetElement?.closest('[data-disable-global-shortcuts="true"]')) {
        return;
      }

      const currentStore = useUiStore.getState();
      const isSidebarArrowKey =
        (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        targetElement?.closest('[data-sidebar-pane="true"]');
      if (isSidebarArrowKey) {
        return;
      }

      const articleListOptionTarget = targetElement?.closest('[role="option"][data-article-id]');
      const articleListPaneTarget = targetElement?.closest('[data-article-list-pane="true"]');
      if (
        e.key === "ArrowLeft" &&
        currentStore.focusedPane === "content" &&
        articleListPaneTarget &&
        !isTextEditingTarget(targetElement)
      ) {
        e.preventDefault();
        e.stopPropagation();
        currentStore.openSidebar();
        emitDebugInputTrace("window-key ArrowLeft -> focus-sidebar");
        requestAnimationFrame(() => {
          focusSelectedSidebarTarget();
        });
        return;
      }

      if (
        e.key === "ArrowLeft" &&
        currentStore.focusedPane === "content" &&
        !articleListOptionTarget &&
        !isTextEditingTarget(targetElement)
      ) {
        e.preventDefault();
        e.stopPropagation();
        currentStore.setFocusedPane("list");
        emitDebugInputTrace("window-key ArrowLeft -> focus-list");
        focusArticleListRowTargetWhenReady(currentStore.selectedArticleId);
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
        subscriptionsWorkspaceOpen: store.subscriptionsWorkspace !== null,
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
        case "restart-app":
          executeAction("restart-app");
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
    });

    return bindWindowEvents([{ type: "keydown", listener: handler, options: true }]);
  }, [store, keyToAction]);
}
