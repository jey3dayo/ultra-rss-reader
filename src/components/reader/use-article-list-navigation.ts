import { Result } from "@praha/byethrow";
import { type RefObject, useCallback } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { calculateArticleNavigationScrollTop, getAdjacentArticleId } from "@/lib/article-list";

type UseArticleListNavigationParams = {
  filteredArticles: ArticleDto[];
  selectedArticleId: string | null;
  selectArticle: (articleId: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
};

export function useArticleListNavigation({
  filteredArticles,
  selectedArticleId,
  selectArticle,
  listRef,
  viewportRef,
}: UseArticleListNavigationParams) {
  return useCallback(
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
    [filteredArticles, listRef, selectArticle, selectedArticleId, viewportRef],
  );
}
