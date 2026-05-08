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
});
