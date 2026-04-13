import { Result } from "@praha/byethrow";
import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback, useEffect } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import { executeAction } from "@/lib/actions";
import { calculateArticleNavigationScrollTop, getAdjacentArticleId } from "@/lib/article-list";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { type buildKeyToActionMap, keyboardEvents, resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

type UseArticleListInteractionsParams = {
  filteredArticles: ArticleDto[];
  selectedArticleId: string | null;
  selectArticle: (articleId: string) => void;
  clearArticle: () => void;
  openSidebar: () => void;
  toggleSidebar: () => void;
  openSearch: () => void;
  handleMarkAllRead: () => void;
  keyToAction: ReturnType<typeof buildKeyToActionMap>;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
};

type UseArticleListInteractionsResult = {
  handleListKeyDownCapture: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export function useArticleListInteractions({
  filteredArticles,
  selectedArticleId,
  selectArticle,
  clearArticle,
  openSidebar,
  toggleSidebar,
  openSearch,
  handleMarkAllRead,
  keyToAction,
  listRef,
  viewportRef,
}: UseArticleListInteractionsParams): UseArticleListInteractionsResult {
  const navigateArticle = useCallback(
    (direction: 1 | -1) => {
      const nextArticleId = getAdjacentArticleId(filteredArticles, selectedArticleId, direction);
      if (Result.isFailure(nextArticleId)) {
        return;
      }

      const articleId = Result.unwrap(nextArticleId);
      const viewport = viewportRef.current;
      const button = listRef.current?.querySelector<HTMLElement>(`[data-article-id="${articleId}"]`);

      selectArticle(articleId);

      if (!viewport || !button) {
        return;
      }

      const stickyHeaderHeight =
        listRef.current?.querySelector<HTMLElement>("[data-group-header]")?.getBoundingClientRect().height ?? 0;
      const viewportRect = viewport.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const nextScrollTop = calculateArticleNavigationScrollTop({
        currentScrollTop: viewport.scrollTop,
        viewportTop: viewportRect.top,
        viewportHeight: viewport.clientHeight,
        itemTop: buttonRect.top,
        itemHeight: buttonRect.height,
        direction,
        stickyTopOffset: stickyHeaderHeight,
        maxScrollTop: viewport.scrollHeight - viewport.clientHeight,
      });

      if (nextScrollTop !== null) {
        viewport.scrollTop = nextScrollTop;
      }

      button.focus({ preventScroll: true });
    },
    [filteredArticles, listRef, selectedArticleId, selectArticle, viewportRef],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const direction = (event as CustomEvent<1 | -1>).detail;
      navigateArticle(direction);
    };

    window.addEventListener(APP_EVENTS.navigateArticle, handler);
    return () => {
      window.removeEventListener(APP_EVENTS.navigateArticle, handler);
    };
  }, [navigateArticle]);

  useEffect(() => {
    const handleFocusSearch = () => {
      openSearch();
    };
    const handleMarkAllReadEvent = () => {
      handleMarkAllRead();
    };

    window.addEventListener(keyboardEvents.focusSearch, handleFocusSearch);
    window.addEventListener(keyboardEvents.markAllRead, handleMarkAllReadEvent);
    return () => {
      window.removeEventListener(keyboardEvents.focusSearch, handleFocusSearch);
      window.removeEventListener(keyboardEvents.markAllRead, handleMarkAllReadEvent);
    };
  }, [handleMarkAllRead, openSearch]);

  const handleListKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[role="option"]')) {
        return;
      }

      const action = resolveKeyboardAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        targetTag: target.tagName,
        selectedArticleId,
        contentMode: useUiStore.getState().contentMode,
        viewMode: useUiStore.getState().viewMode,
        keyToAction,
      });

      if (Result.isFailure(action)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const resolvedAction = Result.unwrap(action);
      emitDebugInputTrace(`list-key ${event.key} -> ${resolvedAction.type}`);
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
          window.dispatchEvent(new Event(resolvedAction.eventName));
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
        case "noop":
          break;
      }
    },
    [clearArticle, keyToAction, openSidebar, selectedArticleId, toggleSidebar],
  );

  return {
    handleListKeyDownCapture,
  };
}
