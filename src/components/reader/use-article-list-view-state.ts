import type { TFunction } from "i18next";
import { useMemo } from "react";
import type { UiSelection } from "@/stores/ui-store";

export type UseArticleListViewStateParams = {
  selection: UiSelection;
  t: TFunction<"reader">;
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
  showSearch: boolean;
  trimmedDebouncedQuery: string;
  searchResults: unknown[] | undefined;
  isSearching: boolean;
  filteredArticleCount: number;
};

export type UseArticleListViewStateResult = {
  contextStripContext: {
    primaryLabel: string | null;
    secondaryLabel: string | null;
    tone: "unread" | "starred" | null;
  };
  footerModes: ReadonlyArray<"all" | "unread" | "starred">;
  isPrimarySourceLoading: boolean;
  isSearchLoading: boolean;
  isSearchEmptyState: boolean;
};

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
      return [];
    }

    return ["unread", "all"];
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
    isPrimarySourceLoading,
    isSearchLoading,
    isSearchEmptyState,
  };
}
