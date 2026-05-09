import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { calculateArticleNavigationScrollTop, getAdjacentArticleId } from "@/lib/articles/article-list";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";
import type { ArticleNavigationDirection } from "@/lib/layout/layout-state.types";
import type { ArticleListBodyProps } from "../../article-list-body";

type UseArticleListNavigationParams = {
  filteredArticles: ArticleDto[];
  selectedArticleId: string | null;
  selectArticle: (articleId: string, options?: { navigationDirection?: ArticleNavigationDirection | null }) => void;
  listRef: ArticleListBodyProps["listRef"];
  viewportRef: ArticleListBodyProps["viewportRef"];
};

export function useArticleListNavigation({
  filteredArticles,
  selectedArticleId,
  selectArticle,
  listRef,
  viewportRef,
}: UseArticleListNavigationParams) {
  const focusRequestGenerationRef = useRef(0);
  const articleIdsSignatureRef = useRef(filteredArticles.map((article) => article.id).join("\0"));

  useEffect(() => {
    const nextArticleIdsSignature = filteredArticles.map((article) => article.id).join("\0");
    if (articleIdsSignatureRef.current === nextArticleIdsSignature) {
      return;
    }

    articleIdsSignatureRef.current = nextArticleIdsSignature;
    focusRequestGenerationRef.current += 1;
  }, [filteredArticles]);

  const focusArticleRow = useCallback(
    (articleId: string, direction: 1 | -1) => {
      const viewport = viewportRef.current;
      const button = listRef.current
        ? queryElementByDataAttribute<HTMLElement>(listRef.current, "data-article-id", articleId)
        : null;

      if (!viewport || !button) {
        return false;
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
      return true;
    },
    [listRef, viewportRef],
  );

  return useCallback(
    (direction: 1 | -1) => {
      const nextArticleId = getAdjacentArticleId(filteredArticles, selectedArticleId, direction);
      if (Result.isFailure(nextArticleId)) {
        return;
      }

      const articleId = Result.unwrap(nextArticleId);
      const focusRequestGeneration = focusRequestGenerationRef.current + 1;
      focusRequestGenerationRef.current = focusRequestGeneration;

      selectArticle(articleId, { navigationDirection: direction });

      if (focusArticleRow(articleId, direction)) {
        return;
      }

      if (typeof window.requestAnimationFrame !== "function") {
        return;
      }

      window.requestAnimationFrame(() => {
        if (focusRequestGenerationRef.current !== focusRequestGeneration) {
          return;
        }

        focusArticleRow(articleId, direction);
      });
    },
    [filteredArticles, focusArticleRow, selectArticle, selectedArticleId],
  );
}
