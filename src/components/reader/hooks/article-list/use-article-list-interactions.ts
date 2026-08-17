import { Result } from "@praha/byethrow";
import { useEffect, useMemo, useRef } from "react";
import { useArticleListGlobalEvents } from "@/components/reader/hooks/article-list/use-article-list-global-events";
import { useArticleListKeydownHandler } from "@/components/reader/hooks/article-list/use-article-list-keydown-handler";
import { useArticleListNavigation } from "@/components/reader/hooks/article-list/use-article-list-navigation";
import { getAdjacentArticleId } from "@/lib/articles/article-list";
import { buildKeyToActionMap } from "@/lib/keyboard/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";
import type {
  UseArticleListInteractionsParams,
  UseArticleListInteractionsResult,
} from "./article-list-controller.types";

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

  const setHasNextArticle = useUiStore((state) => state.setHasNextArticle);

  // This pane owns the list that `navigateArticle` actually walks (search results included), so it
  // publishes whether a next article exists. The content pane renders its next-article control from
  // this value instead of re-deriving it from its own source-agnostic list. Unmounting this pane
  // also drops the `navigateArticle` listener, so publishing "no next" on cleanup stays accurate.
  useEffect(() => {
    const nextArticleId = getAdjacentArticleId(filteredArticles, selectedArticleId, 1);
    setHasNextArticle(Result.isSuccess(nextArticleId) && Result.unwrap(nextArticleId) !== selectedArticleId);

    return () => {
      setHasNextArticle(false);
    };
  }, [filteredArticles, selectedArticleId, setHasNextArticle]);

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
