import { useEffect } from "react";
import type { UseArticleListEffectsParams } from "./article-list.types";

export function useArticleListEffects({
  selection,
  scrollToTopOnChange,
  viewportRef,
  filteredArticles,
  selectedArticleId,
  isPrimarySourceLoading,
  clearArticle,
}: UseArticleListEffectsParams) {
  useEffect(() => {
    if (!selectedArticleId || isPrimarySourceLoading) {
      return;
    }

    const isSelectedArticleVisible = filteredArticles.some((article) => article.id === selectedArticleId);
    if (!isSelectedArticleVisible) {
      clearArticle();
    }
  }, [clearArticle, filteredArticles, isPrimarySourceLoading, selectedArticleId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top when selection changes
  useEffect(() => {
    if (scrollToTopOnChange === "true" && viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [selection, scrollToTopOnChange]);
}
