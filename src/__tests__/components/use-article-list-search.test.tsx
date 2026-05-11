import { act, render, renderHook, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListHeaderSearch } from "@/components/reader/article-list-header-search";
import { useArticleListSearch } from "@/components/reader/hooks/article-list/use-article-list-search";
import { ARTICLE_SEARCH_DEBOUNCE_MS } from "@/constants/reader";

const { useSearchArticlesMock } = vi.hoisted(() => ({
  useSearchArticlesMock: vi.fn(),
}));

vi.mock("@/hooks/use-articles", () => ({
  resolveArticleSearchQueryOwner: (accountId: string | null, query: string) => {
    const normalizedAccountId = accountId?.trim() || null;
    const normalizedQuery = query.normalize("NFKC").replace(/\s+/gu, " ").trim();
    return normalizedAccountId && normalizedQuery
      ? {
          accountId: normalizedAccountId,
          query: normalizedQuery,
          key: `${normalizedAccountId}\0${normalizedQuery}`,
        }
      : null;
  },
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
      isPlaceholderData: false,
      searchOwner:
        _accountId && query
          ? {
              accountId: _accountId,
              query,
              key: `${_accountId}\0${query}`,
            }
          : null,
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

  it("opens search when retry focus runtime APIs are unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.spyOn(window, "setTimeout").mockImplementation(undefined as never);
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    expect(() => {
      act(() => {
        result.current.openSearch();
      });
    }).not.toThrow();

    expect(result.current.showSearch).toBe(true);
  });

  it("keeps search open when requestAnimationFrame throws during focus retry scheduling", () => {
    const requestError = new Error("frame unavailable");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("requestAnimationFrame", () => {
      throw requestError;
    });
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    expect(() => {
      act(() => {
        result.current.openSearch();
      });
    }).not.toThrow();

    expect(warn).toHaveBeenCalledWith("Failed to schedule reader focus frame.", requestError);
    expect(result.current.showSearch).toBe(true);
  });

  it("keeps search open when a stale search input focus throws", () => {
    const focus = vi.fn(() => {
      throw new Error("focus failed");
    });
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));
    const input = document.createElement("input");
    input.focus = focus;
    result.current.searchInputRef.current = input;

    expect(() => {
      act(() => {
        result.current.openSearch();
        vi.advanceTimersByTime(0);
      });
    }).not.toThrow();

    expect(result.current.showSearch).toBe(true);
  });

  it("does not throw when search opens before the input is mounted", () => {
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    expect(result.current.searchInputRef.current).toBeNull();
    expect(() => {
      act(() => {
        result.current.openSearch();
      });
    }).not.toThrow();

    expect(result.current.showSearch).toBe(true);
  });

  it("cancels stale focus retries after rapid close and unmount", () => {
    const focus = vi.fn();
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { result, unmount } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));
    const input = document.createElement("input");
    input.focus = focus;
    result.current.searchInputRef.current = input;

    act(() => {
      result.current.openSearch();
      result.current.handleCloseSearch();
    });
    unmount();
    act(() => {
      callbacks.forEach((callback) => {
        callback(0);
      });
      vi.advanceTimersByTime(0);
    });

    expect(focus).toHaveBeenCalledTimes(1);
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

  it("does not retain a query set while closed when search is reopened", () => {
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.setSearchQuery("stale");
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.showSearch).toBe(false);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.trimmedDebouncedQuery).toBe("");

    act(() => {
      result.current.openSearch();
    });

    expect(result.current.showSearch).toBe(true);
    expect(result.current.searchQuery).toBe("");
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

  it("does not expose stale placeholder results as current search results while the next owner is fetching", () => {
    useSearchArticlesMock.mockImplementation((_accountId: string | null, query: string) => ({
      data: query === "query b" ? [{ id: "query-a-result" }] : [{ id: "query-a-result" }],
      isFetching: query === "query b",
      isPlaceholderData: query === "query b",
      searchOwner:
        _accountId && query
          ? {
              accountId: _accountId,
              query,
              key: `${_accountId}\0${query}`,
            }
          : null,
    }));
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery("query a");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.trimmedDebouncedQuery).toBe("query a");
    expect(result.current.searchResults).toEqual([{ id: "query-a-result" }]);

    act(() => {
      result.current.setSearchQuery("query b");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.trimmedDebouncedQuery).toBe("query b");
    expect(result.current.searchResults).toBeUndefined();
    expect(result.current.isSearching).toBe(true);
  });

  it("does not expose stale owner results as current search results after the query changes", () => {
    useSearchArticlesMock.mockImplementation((_accountId: string | null, query: string) => ({
      data: [{ id: "query-a-result" }],
      isFetching: query === "query b",
      isPlaceholderData: false,
      searchOwner:
        _accountId && query
          ? {
              accountId: _accountId,
              query: "query a",
              key: `${_accountId}\0query a`,
            }
          : null,
    }));
    const { result } = renderHook(() => useArticleListSearch({ selectedAccountId: "acc-1" }));

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery("query a");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.searchResults).toEqual([{ id: "query-a-result" }]);

    act(() => {
      result.current.setSearchQuery("query b");
    });
    act(() => {
      vi.advanceTimersByTime(ARTICLE_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.trimmedDebouncedQuery).toBe("query b");
    expect(result.current.searchResults).toBeUndefined();
    expect(result.current.isSearching).toBe(false);
  });

  it("exposes literal-search syntax copy on the search input", () => {
    const inputRef = createRef<HTMLInputElement>();

    render(
      <ArticleListHeaderSearch
        searchInputRef={inputRef}
        searchQuery=""
        searchArticlesLabel="Search articles"
        searchArticlesPlaceholder="Search literal words..."
        searchArticlesDescription="Words are searched literally in titles and article text. Quotes, OR, NEAR, and * are not search operators."
        onSearchQueryChange={vi.fn()}
        onCloseSearch={vi.fn()}
        onRestoreSearchToggleFocus={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Search articles" });
    expect(input).toHaveAttribute("placeholder", "Search literal words...");
    expect(input).toHaveAttribute(
      "aria-description",
      "Words are searched literally in titles and article text. Quotes, OR, NEAR, and * are not search operators.",
    );
  });
});
