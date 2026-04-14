import { useLayoutEffect, useMemo, useRef } from "react";
import { buildKeyToActionMap } from "@/lib/keyboard-shortcuts";
import type { UseArticleListInteractionsParams, UseArticleListInteractionsResult } from "./article-list.types";
import { useArticleListGlobalEvents } from "./use-article-list-global-events";
import { useArticleListKeydownHandler } from "./use-article-list-keydown-handler";
import { useArticleListNavigation } from "./use-article-list-navigation";

export function useArticleListInteractions({
  filteredArticles,
  selectedArticleId,
  selectArticle,
  clearArticle,
  openSidebar,
  toggleSidebar,
  openSearch,
  handleMarkAllRead,
  keyboardPrefs,
}: UseArticleListInteractionsParams): UseArticleListInteractionsResult {
  const keyToAction = useMemo(() => buildKeyToActionMap(keyboardPrefs), [keyboardPrefs]);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || !selectedArticleId) {
      return;
    }

    let observer: MutationObserver | null = null;

    const restoreFocusToSelectedRow = () => {
      const currentActiveElement = document.activeElement;
      const shouldRestoreFocus =
        !(currentActiveElement instanceof HTMLElement) ||
        !currentActiveElement.isConnected ||
        currentActiveElement === document.body ||
        currentActiveElement === document.documentElement;
      if (!shouldRestoreFocus) {
        return false;
      }

      const selectedRow = listRef.current?.querySelector<HTMLElement>(`[data-article-id="${selectedArticleId}"]`);
      if (!selectedRow || selectedRow.closest('[aria-hidden="true"], [inert]')) {
        return false;
      }

      selectedRow.focus({ preventScroll: true });
      return true;
    };

    const focusId = requestAnimationFrame(() => {
      if (restoreFocusToSelectedRow()) {
        return;
      }

      const listElement = listRef.current;
      if (!listElement) {
        return;
      }

      observer = new MutationObserver(() => {
        if (!restoreFocusToSelectedRow()) {
          return;
        }

        observer?.disconnect();
        observer = null;
      });

      observer.observe(listElement, {
        childList: true,
        subtree: true,
      });

      if (restoreFocusToSelectedRow()) {
        observer.disconnect();
        observer = null;
      }
    });

    return () => {
      cancelAnimationFrame(focusId);
      observer?.disconnect();
    };
  }, [selectedArticleId]);

  const navigateArticle = useArticleListNavigation({
    filteredArticles,
    selectedArticleId,
    selectArticle,
    listRef,
    viewportRef,
  });

  useArticleListGlobalEvents({
    onNavigateArticle: navigateArticle,
    onFocusSearch: openSearch,
    onMarkAllRead: handleMarkAllRead,
  });

  const handleListKeyDownCapture = useArticleListKeydownHandler({
    selectedArticleId,
    clearArticle,
    toggleSidebar,
    openSidebar,
    keyToAction,
  });

  return {
    listRef,
    viewportRef,
    handleListKeyDownCapture,
  };
}
