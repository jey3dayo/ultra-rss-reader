import { Result } from "@praha/byethrow";
import { useEffect, useMemo } from "react";
import {
  closeAccountPaneAndFocusSidebar,
  focusAdjacentAccountPaneTarget,
  normalizePaneNavigationKey,
  selectCurrentAccountPaneTargetAndFocusSidebar,
} from "@/lib/account/account-pane-navigation";
import { executeAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { isGlobalShortcutTextEditingTarget } from "@/lib/keyboard/global-shortcut-targets";
import { buildKeyToActionMap, type keyboardEvents, resolveKeyboardAction } from "@/lib/keyboard/keyboard-shortcuts";
import {
  focusArticleListRowTargetWhenReady,
  focusSelectedSidebarTarget,
  isSidebarPaneTarget,
  resolveReaderFocusReturnAction,
} from "@/lib/reader-focus";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "../stores/ui-store";

function emitKeyboardEvent(name: (typeof keyboardEvents)[keyof typeof keyboardEvents]) {
  window.dispatchEvent(new Event(name));
}

function isGlobalShortcutBlockedByModal(): boolean {
  const state = useUiStore.getState();
  return state.settingsOpen || state.confirmDialog.open || state.shortcutsHelpOpen || state.commandPaletteOpen;
}

export function useKeyboard() {
  const selectedArticleId = useUiStore((state) => state.selectedArticleId);
  const contentMode = useUiStore((state) => state.contentMode);
  const viewMode = useUiStore((state) => state.viewMode);
  const subscriptionsWorkspaceOpen = useUiStore((state) => state.subscriptionsWorkspace !== null);
  const clearArticle = useUiStore((state) => state.clearArticle);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const openSidebar = useUiStore((state) => state.openSidebar);
  const prefs = usePreferencesStore((s) => s.prefs);

  const keyToAction = useMemo(() => buildKeyToActionMap(prefs), [prefs]);

  useEffect(() => {
    const handler = createKeyboardEventListener((e) => {
      if (e.defaultPrevented) {
        return;
      }

      const targetElement = e.target instanceof Element ? e.target : null;
      if (targetElement?.closest('[data-disable-global-shortcuts="true"]')) {
        return;
      }

      if (isGlobalShortcutBlockedByModal()) {
        return;
      }

      const currentStore = useUiStore.getState();
      if (e.key === "Escape" && currentStore.contentMode === "browser" && currentStore.browserUrl) {
        return;
      }

      const normalizedPaneKey = normalizePaneNavigationKey(e.key);
      const targetInAccountPane = targetElement?.closest('[data-account-pane="true"]');
      const targetInSidebarPane = targetElement?.closest('[data-sidebar-pane="true"]');
      const targetInAccountSwitcherMenu = targetElement?.closest('[data-account-switcher-menu="true"]');
      const shouldRouteAccountPaneKey =
        currentStore.accountPaneOpen &&
        currentStore.focusedPane === "sidebar" &&
        !isGlobalShortcutTextEditingTarget(targetElement) &&
        (!targetInSidebarPane || targetInAccountPane || targetInAccountSwitcherMenu);
      if (shouldRouteAccountPaneKey) {
        if (normalizedPaneKey === "ArrowDown" || normalizedPaneKey === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          focusAdjacentAccountPaneTarget(normalizedPaneKey === "ArrowDown" ? 1 : -1);
          emitDebugInputTrace(`window-key ${e.key} -> focus-account-pane`);
          return;
        }

        if (normalizedPaneKey === "ArrowRight" || normalizedPaneKey === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          selectCurrentAccountPaneTargetAndFocusSidebar();
          emitDebugInputTrace(`window-key ${e.key} -> select-account-pane`);
          return;
        }

        if (normalizedPaneKey === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeAccountPaneAndFocusSidebar();
          emitDebugInputTrace(`window-key ${e.key} -> close-account-pane`);
          return;
        }
      }

      const isSidebarArrowKey =
        (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        isSidebarPaneTarget(targetElement);
      if (isSidebarArrowKey) {
        return;
      }

      const readerFocusReturnAction = resolveReaderFocusReturnAction({
        key: e.key,
        focusedPane: currentStore.focusedPane,
        target: targetElement,
        targetIsTextEditing: isGlobalShortcutTextEditingTarget(targetElement),
      });
      if (readerFocusReturnAction === "focus-sidebar") {
        e.preventDefault();
        e.stopPropagation();
        currentStore.openSidebar();
        emitDebugInputTrace("window-key ArrowLeft -> focus-sidebar");
        requestAnimationFrame(() => {
          focusSelectedSidebarTarget();
        });
        return;
      }

      if (readerFocusReturnAction === "focus-list") {
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
        targetIsTextEditing: isGlobalShortcutTextEditingTarget(targetElement),
        selectedArticleId,
        contentMode,
        viewMode,
        subscriptionsWorkspaceOpen,
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
          clearArticle();
          break;
        case "toggle-sidebar":
          toggleSidebar();
          break;
        case "focus-sidebar":
          openSidebar();
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
  }, [
    clearArticle,
    contentMode,
    keyToAction,
    openSidebar,
    selectedArticleId,
    subscriptionsWorkspaceOpen,
    toggleSidebar,
    viewMode,
  ]);
}
