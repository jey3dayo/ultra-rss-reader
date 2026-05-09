import type { RefObject } from "react";
import { useEffect } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";
import type { FocusedPane } from "@/lib/layout/layout-state.types";
import type { ReaderSelection } from "@/lib/reader/reader-selection.types";

type UseArticleListEffectsParams = {
  selection: ReaderSelection;
  scrollToTopOnChange: string;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  filteredArticles: ArticleDto[];
  focusedPane: FocusedPane;
  selectedArticleId: string | null;
  isPrimarySourceLoading: boolean;
  clearArticle: () => void;
};

export function useArticleListEffects({
  selection,
  scrollToTopOnChange,
  listRef,
  viewportRef,
  filteredArticles,
  focusedPane,
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

  useEffect(() => {
    if (focusedPane !== "list" || isPrimarySourceLoading) {
      return;
    }

    const targetArticleId = selectedArticleId ?? filteredArticles[0]?.id;
    if (!targetArticleId) {
      return;
    }

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.isContentEditable)
    ) {
      return;
    }

    const targetRow = listRef.current
      ? queryElementByDataAttribute<HTMLElement>(listRef.current, "data-article-id", targetArticleId)
      : null;
    if (!targetRow || targetRow === activeElement) {
      return;
    }

    const focusTargetRow = requestAnimationFrame(() => {
      targetRow.focus({ preventScroll: true });
      targetRow.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });

    return () => {
      cancelAnimationFrame(focusTargetRow);
    };
  }, [filteredArticles, focusedPane, isPrimarySourceLoading, listRef, selectedArticleId]);
}
