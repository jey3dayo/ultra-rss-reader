import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  closeAccountPaneAndFocusSidebar,
  focusAdjacentAccountPaneTarget,
  normalizePaneNavigationKey,
  selectCurrentAccountPaneTargetAndFocusSidebar,
} from "@/lib/account/account-pane-navigation";
import { executeAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import {
  isGlobalShortcutTextEditingTarget,
  shouldIgnoreGlobalShortcutKeyboardEvent,
} from "@/lib/keyboard/global-shortcut-targets";
import { buildKeyToActionMap, type keyboardEvents, resolveKeyboardAction } from "@/lib/keyboard/keyboard-shortcuts";
import {
  focusArticleListRowTargetWhenReady,
  focusSelectedSidebarTarget,
  isSidebarPaneTarget,
  resolveReaderFocusReturnAction,
  scheduleReaderFocusFrame,
} from "@/lib/reader-focus";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "../stores/ui-store";

function emitKeyboardEvent(name: (typeof keyboardEvents)[keyof typeof keyboardEvents]) {
  window.dispatchEvent(new Event(name));
}

const blockingTopLayerSelector = [
  '[data-slot="dialog-content"][data-stack-layer]',
  "dialog[open]",
  '[role="dialog"][aria-modal="true"]',
].join(", ");

function hasOpenPopoverElement(): boolean {
  const popoverElements = document.querySelectorAll("[popover]");
  for (const element of popoverElements) {
    if (element.matches('[data-state="open"], [data-open]')) {
      return true;
    }

    try {
      if (element.matches(":popover-open")) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

function isGlobalShortcutBlockedByTopLayer(): boolean {
  return document.querySelector(blockingTopLayerSelector) !== null || hasOpenPopoverElement();
}

type RepeatNavigationAction =
  | { type: "navigate-article"; direction: 1 | -1 }
  | { type: "navigate-feed"; direction: 1 | -1 };

function isRepeatNavigationAction(action: { type: string }): action is RepeatNavigationAction {
  return action.type === "navigate-article" || action.type === "navigate-feed";
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
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const pendingRepeatNavigationRef = useRef<RepeatNavigationAction | null>(null);
  const repeatNavigationCleanupRef = useRef<(() => void) | null>(null);

  const keyToAction = useMemo(() => buildKeyToActionMap(prefs), [prefs]);
  const cancelRepeatNavigation = useCallback(() => {
    repeatNavigationCleanupRef.current?.();
    repeatNavigationCleanupRef.current = null;
    pendingRepeatNavigationRef.current = null;
  }, []);

  const flushRepeatNavigation = useCallback(() => {
    const pendingAction = pendingRepeatNavigationRef.current;
    pendingRepeatNavigationRef.current = null;
    repeatNavigationCleanupRef.current = null;

    if (!pendingAction) {
      return;
    }

    if (pendingAction.type === "navigate-article") {
      executeAction(pendingAction.direction === 1 ? "next-article" : "prev-article");
      return;
    }

    executeAction(pendingAction.direction === 1 ? "next-feed" : "prev-feed");
  }, []);

  const queueRepeatNavigation = useCallback(
    (action: RepeatNavigationAction) => {
      pendingRepeatNavigationRef.current = action;
      if (repeatNavigationCleanupRef.current !== null) {
        return;
      }

      repeatNavigationCleanupRef.current = scheduleReaderFocusFrame(flushRepeatNavigation);
    },
    [flushRepeatNavigation],
  );

  useEffect(() => {
    return () => {
      cancelRepeatNavigation();
    };
  }, [cancelRepeatNavigation]);

  useEffect(() => {
    const handler = createKeyboardEventListener((e) => {
      if (e.defaultPrevented) {
        return;
      }

      const targetElement = e.target instanceof Element ? e.target : null;
      if (targetElement?.closest('[data-disable-global-shortcuts="true"]')) {
        return;
      }

      if (isGlobalShortcutBlockedByTopLayer()) {
        return;
      }

      if (shouldIgnoreGlobalShortcutKeyboardEvent(e)) {
        return;
      }

      const currentStore = useUiStore.getState();

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
        focusSelectedSidebarTarget();
        scheduleReaderFocusFrame(() => {
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
        altKey: e.altKey,
        isComposing: e.isComposing,
        targetTag: targetElement?.tagName,
        targetIsTextEditing: isGlobalShortcutTextEditingTarget(targetElement),
        selectedArticleId,
        contentMode,
        viewMode,
        subscriptionsWorkspaceOpen,
        keyToAction,
        platformKind,
      });

      if (Result.isFailure(action)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const resolvedAction = Result.unwrap(action);
      emitDebugInputTrace(`window-key ${e.key} -> ${resolvedAction.type}`);

      if (e.repeat && isRepeatNavigationAction(resolvedAction)) {
        queueRepeatNavigation(resolvedAction);
        return;
      }
      cancelRepeatNavigation();
      if (e.repeat) {
        return;
      }

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
          focusSelectedSidebarTarget();
          scheduleReaderFocusFrame(() => {
            focusSelectedSidebarTarget();
          });
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
    cancelRepeatNavigation,
    keyToAction,
    openSidebar,
    queueRepeatNavigation,
    selectedArticleId,
    subscriptionsWorkspaceOpen,
    toggleSidebar,
    viewMode,
    platformKind,
  ]);
}
