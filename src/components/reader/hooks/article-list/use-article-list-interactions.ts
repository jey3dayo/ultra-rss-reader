import { useEffect, useMemo, useRef } from "react";
import { useArticleListGlobalEvents } from "@/components/reader/hooks/article-list/use-article-list-global-events";
import { useArticleListKeydownHandler } from "@/components/reader/hooks/article-list/use-article-list-keydown-handler";
import { useArticleListNavigation } from "@/components/reader/hooks/article-list/use-article-list-navigation";
import { resolveArticleCursor } from "@/lib/articles/article-list";
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
  // publishes whether a next article exists via `resolveArticleCursor`, which applies the same
  // `getAdjacentArticleId` clamp rule that `useArticleListNavigation` checks (that hook still calls
  // `getAdjacentArticleId` directly because boundary hits re-select the current article there,
  // which the cursor's null-on-boundary shape does not express). The content pane renders its
  // next-article control from this published value instead of re-deriving it from its own
  // source-agnostic list, because that list is built without search applied (see
  // `useArticleViewSelection`). Unmounting this pane also drops the `navigateArticle` listener, so
  // publishing "no next" on cleanup stays accurate for as long as this pane is the one mounted;
  // when this pane never mounts at all (e.g. content-only layout before the list pane is visited),
  // the published value is not corrected — see docs/reader-article-scope-matrix.md.
  useEffect(() => {
    const cursor = resolveArticleCursor(filteredArticles, selectedArticleId);
    setHasNextArticle(cursor.hasNext);

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
