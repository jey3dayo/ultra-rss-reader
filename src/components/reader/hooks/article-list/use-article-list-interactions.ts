import { useMemo, useRef } from "react";
import { useArticleListGlobalEvents } from "@/components/reader/hooks/article-list/use-article-list-global-events";
import { useArticleListKeydownHandler } from "@/components/reader/hooks/article-list/use-article-list-keydown-handler";
import { useArticleListNavigation } from "@/components/reader/hooks/article-list/use-article-list-navigation";
import { buildKeyToActionMap } from "@/lib/keyboard-shortcuts";
import type { UseArticleListInteractionsParams, UseArticleListInteractionsResult } from "../../article-list.types";

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
    selectArticle,
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
