import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleListSearch } from "@/components/reader/hooks/article-list/use-article-list-search";
import { ARTICLE_SEARCH_DEBOUNCE_MS } from "@/constants/reader";

const { useSearchArticlesMock } = vi.hoisted(() => ({
  useSearchArticlesMock: vi.fn(),
}));

vi.mock("@/hooks/use-articles", () => ({
  useSearchArticles: (...args: unknown[]) => useSearchArticlesMock(...args),
}));

describe("useArticleListSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    useSearchArticlesMock.mockImplementation((_accountId: string | null, query: string) => ({
      data: query ? [{ id: "search-result" }] : undefined,
      isFetching: false,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resets open search state and debounced query when the selected account changes", () => {
    const { result, rerender } = renderHook(
      ({ selectedAccountId }: { selectedAccountId: string | null }) => useArticleListSearch({ selectedAccountId }),
      {
        initialProps: { selectedAccountId: "acc-1" },
      },
    );

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery("  urgent  ");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.showSearch).toBe(true);
    expect(result.current.searchQuery).toBe("  urgent  ");
    expect(result.current.trimmedDebouncedQuery).toBe("urgent");
    expect(result.current.searchResults).toEqual([{ id: "search-result" }]);

    rerender({ selectedAccountId: "acc-2" });

    expect(result.current.showSearch).toBe(false);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.trimmedDebouncedQuery).toBe("");
    expect(result.current.searchResults).toBeUndefined();
    expect(useSearchArticlesMock).toHaveBeenLastCalledWith("acc-2", "");
  });

  it("opens search without changing the debounced query until the debounce delay", () => {
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery("  urgent  ");
    });

    expect(result.current.showSearch).toBe(true);
    expect(result.current.searchQuery).toBe("  urgent  ");
    expect(result.current.trimmedDebouncedQuery).toBe("");
    expect(useSearchArticlesMock).toHaveBeenLastCalledWith("acc-1", "");

    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS - 1);
    });

    expect(result.current.trimmedDebouncedQuery).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.trimmedDebouncedQuery).toBe("urgent");
    expect(useSearchArticlesMock).toHaveBeenLastCalledWith("acc-1", "urgent");
  });

  it("toggles search open and keeps it open on repeated toggle", () => {
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.handleToggleSearch();
    });

    expect(result.current.showSearch).toBe(true);

    act(() => {
      result.current.handleToggleSearch();
    });

    expect(result.current.showSearch).toBe(true);
  });

  it("closes search and clears the debounced query immediately", () => {
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery("  urgent  ");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.showSearch).toBe(true);
    expect(result.current.searchQuery).toBe("  urgent  ");
    expect(result.current.trimmedDebouncedQuery).toBe("urgent");

    act(() => {
      result.current.handleCloseSearch();
    });

    expect(result.current.showSearch).toBe(false);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.trimmedDebouncedQuery).toBe("");
    expect(useSearchArticlesMock).toHaveBeenLastCalledWith("acc-1", "");
  });

  it("does not pass stale debounced query to search while the search UI is closed", () => {
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery("  urgent  ");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(useSearchArticlesMock).toHaveBeenLastCalledWith("acc-1", "urgent");

    act(() => {
      result.current.handleCloseSearch();
    });
    act(() => {
      result.current.setSearchQuery("stale");
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.showSearch).toBe(false);
    expect(result.current.trimmedDebouncedQuery).toBe("");
    expect(useSearchArticlesMock).toHaveBeenLastCalledWith("acc-1", "");
  });

  it("does not revive a stale query when search is reopened before the old debounce timer flushes", () => {
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery("  urgent  ");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS - 1);
    });

    expect(result.current.trimmedDebouncedQuery).toBe("");

    act(() => {
      result.current.handleCloseSearch();
      result.current.openSearch();
      vi.advanceTimersByTime(1);
    });

    expect(result.current.showSearch).toBe(true);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.trimmedDebouncedQuery).toBe("");
    expect(useSearchArticlesMock).toHaveBeenLastCalledWith("acc-1", "");
  });
});
