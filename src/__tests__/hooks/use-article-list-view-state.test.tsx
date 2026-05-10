import { renderHook } from "@testing-library/react";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { UseArticleListViewStateParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { useArticleListViewState } from "@/components/reader/hooks/article-list/use-article-list-view-state";

describe("useArticleListViewState", () => {
  it("derives unread smart-view labels and locks the unread footer mode", () => {
    const { result } = renderHook(() =>
      useArticleListViewState(
        createParams({
          selection: { type: "smart", kind: "unread" },
          isLoadingRecentArticles: true,
        }),
      ),
    );

    expect(result.current.contextStripContext).toEqual({
      primaryLabel: "reader:unread",
      secondaryLabel: null,
      tone: "unread",
    });
    expect(result.current.footerModes).toEqual(["unread"]);
    expect(result.current.footerDisabledModes).toEqual(["unread"]);
    expect(result.current.isPrimarySourceLoading).toBe(false);
  });

  it("uses the selected source loading flag before setup empty states", () => {
    const { result } = renderHook(() =>
      useArticleListViewState(
        createParams({
          selection: { type: "folder", folderId: "folder-1" },
          selectedAccountId: "account-1",
          accountListScopeId: "account-1",
          accountCount: 0,
          feedCount: 0,
          filteredArticleCount: 0,
          isLoadingAccountArticles: true,
          isLoadingFolderArticles: true,
        }),
      ),
    );

    expect(result.current.contextStripContext).toEqual({
      primaryLabel: null,
      secondaryLabel: null,
      tone: null,
    });
    expect(result.current.footerModes).toEqual(["unread", "all", "starred"]);
    expect(result.current.footerDisabledModes).toEqual([]);
    expect(result.current.isPrimarySourceLoading).toBe(true);
    expect(result.current.setupEmptyState).toBe("no-accounts");
  });

  it("keeps search loading and empty states independent from setup empty states", () => {
    const loading = renderHook(() =>
      useArticleListViewState(
        createParams({
          showSearch: true,
          trimmedDebouncedQuery: "rss",
          searchResults: undefined,
          isSearching: true,
          filteredArticleCount: 0,
          accountCount: 0,
        }),
      ),
    );
    const empty = renderHook(() =>
      useArticleListViewState(
        createParams({
          showSearch: true,
          trimmedDebouncedQuery: "rss",
          searchResults: [],
          isSearching: false,
          filteredArticleCount: 0,
          accountCount: 0,
        }),
      ),
    );

    expect(loading.result.current.isSearchLoading).toBe(true);
    expect(loading.result.current.isPrimarySourceLoading).toBe(false);
    expect(loading.result.current.isSearchEmptyState).toBe(false);
    expect(loading.result.current.setupEmptyState).toBe("no-accounts");
    expect(empty.result.current.isSearchLoading).toBe(false);
    expect(empty.result.current.isSearchEmptyState).toBe(true);
    expect(empty.result.current.setupEmptyState).toBe("none");
  });

  it("keeps primary source loading separate from search fetching", () => {
    const { result } = renderHook(() =>
      useArticleListViewState(
        createParams({
          selection: { type: "folder", folderId: "folder-1" },
          showSearch: true,
          trimmedDebouncedQuery: "rss",
          searchResults: undefined,
          isSearching: true,
          isLoadingFolderArticles: true,
          filteredArticleCount: 0,
        }),
      ),
    );

    expect(result.current.isPrimarySourceLoading).toBe(true);
    expect(result.current.isSearchLoading).toBe(true);
    expect(result.current.isSearchEmptyState).toBe(false);
  });

  it("treats current search fetching as loading even when stale results are still present", () => {
    const { result } = renderHook(() =>
      useArticleListViewState(
        createParams({
          showSearch: true,
          trimmedDebouncedQuery: "query b",
          searchResults: [{ id: "query-a-result" }],
          isSearching: true,
          filteredArticleCount: 1,
        }),
      ),
    );

    expect(result.current.isSearchLoading).toBe(true);
    expect(result.current.isSearchEmptyState).toBe(false);
    expect(result.current.setupEmptyState).toBe("none");
  });
});

function createParams(overrides: Partial<UseArticleListViewStateParams> = {}): UseArticleListViewStateParams {
  return {
    selection: { type: "smart", kind: "recent" },
    t: ((key: string) => `reader:${key}`) as TFunction<"reader">,
    selectedAccountId: null,
    feedId: null,
    tagId: null,
    accountListScopeId: null,
    accountCount: 1,
    feedCount: 1,
    isLoadingFeedArticles: false,
    isLoadingAccountArticles: false,
    isLoadingFolderArticles: false,
    isLoadingRecentArticles: false,
    isLoadingTagArticles: false,
    showSearch: false,
    trimmedDebouncedQuery: "",
    searchResults: undefined,
    isSearching: false,
    filteredArticleCount: 1,
    ...overrides,
  };
}
