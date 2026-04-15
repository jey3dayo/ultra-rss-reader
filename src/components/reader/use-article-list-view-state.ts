import { useMemo } from "react";
import type { UseArticleListViewStateParams, UseArticleListViewStateResult } from "./article-list.types";

export function useArticleListViewState({
  selection,
  t,
  feedId,
  tagId,
  accountListScopeId,
  isLoading,
  isLoadingAccountArticles,
  isLoadingTagArticles,
  showSearch,
  trimmedDebouncedQuery,
  searchResults,
  isSearching,
  filteredArticleCount,
}: UseArticleListViewStateParams): UseArticleListViewStateResult {
  const contextStripContext = useMemo(() => {
    if (selection.type !== "smart") {
      return { primaryLabel: null, secondaryLabel: null, tone: null };
    }

    if (selection.kind === "unread") {
      return { primaryLabel: t("unread"), secondaryLabel: null, tone: "unread" as const };
    }

    return {
      primaryLabel: t("starred"),
      secondaryLabel: null,
      tone: "starred" as const,
    };
  }, [selection, t]);

  const footerModes = useMemo<ReadonlyArray<"all" | "unread" | "starred">>(() => {
    if (selection.type !== "smart") {
      return ["unread", "all", "starred"];
    }

    if (selection.kind === "unread") {
      return ["unread"];
    }

    return ["unread", "all"];
  }, [selection]);

  const footerDisabledModes = useMemo<ReadonlyArray<"all" | "unread" | "starred">>(() => {
    if (selection.type === "smart" && selection.kind === "unread") {
      return ["unread"];
    }

    return [];
  }, [selection]);

  const isPrimarySourceLoading = feedId
    ? isLoading
    : tagId
      ? isLoadingTagArticles
      : accountListScopeId != null && isLoadingAccountArticles;

  const isSearchLoading = showSearch && trimmedDebouncedQuery.length > 0 && searchResults === undefined && isSearching;
  const isSearchEmptyState =
    showSearch && trimmedDebouncedQuery.length > 0 && !isSearchLoading && filteredArticleCount === 0;

  return {
    contextStripContext,
    footerModes,
    footerDisabledModes,
    isPrimarySourceLoading,
    isSearchLoading,
    isSearchEmptyState,
  };
}
