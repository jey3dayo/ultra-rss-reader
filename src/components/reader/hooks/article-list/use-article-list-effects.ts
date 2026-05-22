import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";
import type { FocusedPane } from "@/lib/layout/layout-state.types";
import { scheduleReaderFocusFrame } from "@/lib/reader-focus";
import type { ArticleListSelection } from "./article-list-controller.types";

type UseArticleListEffectsParams = {
  selection: ArticleListSelection;
  scrollToTopOnChange: string;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  filteredArticles: ArticleDto[];
  focusedPane: FocusedPane;
  selectedArticleId: string | null;
  isPrimarySourceLoading: boolean;
  isSearchLoading: boolean;
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
  isSearchLoading,
  clearArticle,
}: UseArticleListEffectsParams) {
  const selectedArticleClearGenerationRef = useRef(0);
  const isListDataLoading = isPrimarySourceLoading || isSearchLoading;

  useEffect(() => {
    selectedArticleClearGenerationRef.current += 1;
    const selectedArticleClearGeneration = selectedArticleClearGenerationRef.current;

    if (!selectedArticleId || isListDataLoading) {
      return;
    }

    const isSelectedArticleVisible = filteredArticles.some((article) => article.id === selectedArticleId);
    if (!isSelectedArticleVisible) {
      return scheduleReaderFocusFrame(() => {
        if (selectedArticleClearGenerationRef.current !== selectedArticleClearGeneration) {
          return;
        }

        const currentSelectedArticleId = selectedArticleId;
        const selectedArticleStillMissing = !filteredArticles.some(
          (article) => article.id === currentSelectedArticleId,
        );
        if (!isListDataLoading && selectedArticleStillMissing) {
          clearArticle();
        }
      });
    }
  }, [clearArticle, filteredArticles, isListDataLoading, selectedArticleId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top when selection changes
  useEffect(() => {
    if (scrollToTopOnChange === "true" && viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [selection, scrollToTopOnChange]);

  useEffect(() => {
    if (focusedPane !== "list" || isListDataLoading) {
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

    const cleanupFocusTargetRow = scheduleReaderFocusFrame(() => {
      const currentTargetRow = listRef.current
        ? queryElementByDataAttribute<HTMLElement>(listRef.current, "data-article-id", targetArticleId)
        : null;
      if (!currentTargetRow || currentTargetRow !== targetRow) {
        return;
      }

      currentTargetRow.focus({ preventScroll: true });
      currentTargetRow.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });

    return cleanupFocusTargetRow;
  }, [filteredArticles, focusedPane, isListDataLoading, listRef, selectedArticleId]);
}
