import { useMemo } from "react";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { UseArticleListViewStateParams, UseArticleListViewStateResult } from "./article-list-controller.types";

export function useArticleListViewState({
  selection,
  selectedAccountId,
  accountCount,
  feedCount,
  showSearch,
  trimmedDebouncedQuery,
  isSearching,
  filteredArticleCount,
}: UseArticleListViewStateParams): UseArticleListViewStateResult {
  const footerModes = useMemo<ReadonlyArray<ViewMode>>(() => {
    return ["unread", "all", "starred"];
  }, []);

  const footerDisabledModes = useMemo<ReadonlyArray<ViewMode>>(() => {
    if (selection.type === "smart" && selection.kind === "unread") {
      return ["unread", "all", "starred"];
    }

    if (selection.type === "smart" && selection.kind === "starred") {
      return ["unread", "all", "starred"];
    }

    return [];
  }, [selection]);

  const isSearchLoading = showSearch && trimmedDebouncedQuery.length > 0 && isSearching;
  const isSearchEmptyState =
    showSearch && trimmedDebouncedQuery.length > 0 && !isSearchLoading && filteredArticleCount === 0;
  const setupEmptyState =
    isSearchEmptyState || filteredArticleCount > 0
      ? "none"
      : accountCount === 0
        ? "no-accounts"
        : selectedAccountId !== null && feedCount === 0
          ? "no-feeds"
          : "none";

  return {
    footerModes,
    footerDisabledModes,
    isSearchLoading,
    isSearchEmptyState,
    setupEmptyState,
  };
}
