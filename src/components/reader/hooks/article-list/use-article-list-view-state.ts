import { useMemo } from "react";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import { classifyAppRecoveryCategory } from "@/lib/ui-errors";
import type { UseArticleListViewStateParams, UseArticleListViewStateResult } from "./article-list-controller.types";
import type { ArticleListSetupState } from "./use-article-list-body-props";

function resolveSetupEmptyState({
  isSearchEmptyState,
  filteredArticleCount,
  failureState,
  accountCount,
  selectedAccountId,
  feedCount,
}: Pick<UseArticleListViewStateParams, "filteredArticleCount" | "accountCount" | "selectedAccountId" | "feedCount"> & {
  isSearchEmptyState: boolean;
  failureState: ArticleListSetupState | null;
}): ArticleListSetupState {
  if (isSearchEmptyState || filteredArticleCount > 0) return "none";
  if (failureState) return failureState;
  if (accountCount === 0) return "no-accounts";
  if (selectedAccountId !== null && feedCount === 0) return "no-feeds";
  return "none";
}

export function useArticleListViewState({
  selection,
  selectedAccountId,
  accountCount,
  feedCount,
  showSearch,
  trimmedDebouncedQuery,
  isSearching,
  filteredArticleCount,
  isArticlesError,
  articlesError,
  isSearchError,
  searchError,
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

  const isActiveSearch = showSearch && trimmedDebouncedQuery.length > 0;
  const isActiveQueryError = isActiveSearch ? isSearchError : isArticlesError;
  const activeQueryError = isActiveSearch ? searchError : articlesError;
  const recoveryCategory = activeQueryError ? classifyAppRecoveryCategory(activeQueryError) : "unknown";
  const failureState = recoveryCategory === "storage" ? "unknown" : recoveryCategory;
  const isSearchLoading = isActiveSearch && isSearching;
  const isSearchEmptyState = isActiveSearch && !isSearchLoading && !isActiveQueryError && filteredArticleCount === 0;
  const setupEmptyState = resolveSetupEmptyState({
    isSearchEmptyState,
    filteredArticleCount,
    failureState: isActiveQueryError ? failureState : null,
    accountCount,
    selectedAccountId,
    feedCount,
  });

  return {
    footerModes,
    footerDisabledModes,
    isSearchLoading,
    isSearchEmptyState,
    setupEmptyState,
  };
}
