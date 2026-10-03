import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it } from "vitest";
import type { UseArticleListViewStateParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { useArticleListViewState } from "@/components/reader/hooks/article-list/use-article-list-view-state";

setupBrowserTestDom();

afterEach(() => {
  cleanup();
});

describe("useArticleListViewState", () => {
  it("keeps every footer button visible and locked for the unread smart view", () => {
    const { result } = renderHook(() =>
      useArticleListViewState(
        createParams({
          selection: { type: "smart", kind: "unread" },
        }),
      ),
    );

    expect(result.current.footerModes).toEqual(["unread", "all", "starred"]);
    expect(result.current.footerDisabledModes).toEqual(["unread", "all", "starred"]);
  });

  it("keeps every footer button visible and locked for the starred smart view", () => {
    const { result } = renderHook(() =>
      useArticleListViewState(
        createParams({
          selection: { type: "smart", kind: "starred" },
        }),
      ),
    );

    expect(result.current.footerModes).toEqual(["unread", "all", "starred"]);
    expect(result.current.footerDisabledModes).toEqual(["unread", "all", "starred"]);
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
    expect(loading.result.current.isSearchEmptyState).toBe(false);
    expect(loading.result.current.setupEmptyState).toBe("no-accounts");
    expect(empty.result.current.isSearchLoading).toBe(false);
    expect(empty.result.current.isSearchEmptyState).toBe(true);
    expect(empty.result.current.setupEmptyState).toBe("none");
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
    selectedAccountId: null,
    accountCount: 1,
    feedCount: 1,
    showSearch: false,
    trimmedDebouncedQuery: "",
    searchResults: undefined,
    isSearching: false,
    filteredArticleCount: 1,
    ...overrides,
  };
}
