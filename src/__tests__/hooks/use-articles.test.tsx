import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import {
  normalizeArticleSearchQuery,
  resolveArticleMutationInvalidationQueryKeys,
  resolveArticleSearchQueryOwner,
  useAccountArticles,
  useAccountStarredCount,
  useArticles,
  useClearArticleViewHistory,
  useFolderArticles,
  useMarkOldUnreadRead,
  useRecentArticles,
  useRecordArticleView,
  useSearchArticles,
  useSetRead,
  useToggleStar,
} from "@/hooks/use-articles";
import { queryKeys } from "@/lib/query/query-invalidation";

const sampleFeedsForAccountOne = sampleFeeds.map((feed) => ({
  ...feed,
  account_id: "acc-1",
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("article mutation cache contract", () => {
  it("keeps article mutation invalidation roots aligned with query cache roots", () => {
    expect(resolveArticleMutationInvalidationQueryKeys()).toEqual([
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.feeds.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ]);
  });
});

describe("useToggleStar", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    const queryWrapper = createQueryWrapper({
      queryClientConfig: {
        defaultOptions: {
          mutations: { retry: false },
        },
      },
    });
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    vi.restoreAllMocks();
  });

  it("keeps nullable article queries disabled until their ids are present", async () => {
    const listArticlesSpy = vi.spyOn(tauriCommands, "listArticles").mockResolvedValue(Result.succeed(sampleArticles));
    const listAccountArticlesSpy = vi
      .spyOn(tauriCommands, "listAccountArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const countAccountStarredArticlesSpy = vi
      .spyOn(tauriCommands, "countAccountStarredArticles")
      .mockResolvedValue(Result.succeed(1));
    const searchArticlesSpy = vi
      .spyOn(tauriCommands, "searchArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const initialArticlesProps: { feedId: string | null } = { feedId: null };
    const initialAccountProps: { accountId: string | null } = {
      accountId: null,
    };
    const initialSearchProps: { accountId: string | null; query: string } = {
      accountId: null,
      query: "fresh",
    };

    const articles = renderHook(({ feedId }: { feedId: string | null }) => useArticles(feedId), {
      initialProps: initialArticlesProps,
      wrapper,
    });
    const accountArticles = renderHook(({ accountId }: { accountId: string | null }) => useAccountArticles(accountId), {
      initialProps: initialAccountProps,
      wrapper,
    });
    const starredCount = renderHook(
      ({ accountId }: { accountId: string | null }) => useAccountStarredCount(accountId),
      {
        initialProps: initialAccountProps,
        wrapper,
      },
    );
    const search = renderHook(
      ({ accountId, query }: { accountId: string | null; query: string }) => useSearchArticles(accountId, query),
      {
        initialProps: initialSearchProps,
        wrapper,
      },
    );

    expect(listArticlesSpy).not.toHaveBeenCalled();
    expect(listAccountArticlesSpy).not.toHaveBeenCalled();
    expect(countAccountStarredArticlesSpy).not.toHaveBeenCalled();
    expect(searchArticlesSpy).not.toHaveBeenCalled();

    articles.rerender({ feedId: "feed-1" });
    accountArticles.rerender({ accountId: "acc-1" });
    starredCount.rerender({ accountId: "acc-1" });
    search.rerender({ accountId: "acc-1", query: "fresh" });

    await waitFor(() => {
      expect(listArticlesSpy).toHaveBeenCalledWith("feed-1", false);
      expect(listAccountArticlesSpy).toHaveBeenCalledWith("acc-1", false);
      expect(countAccountStarredArticlesSpy).toHaveBeenCalledWith("acc-1");
      expect(searchArticlesSpy).toHaveBeenCalledWith("acc-1", "fresh");
    });
  });

  it("keeps article search disabled for whitespace-only queries", () => {
    const searchArticlesSpy = vi
      .spyOn(tauriCommands, "searchArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));

    renderHook(() => useSearchArticles("acc-1", "   \n\t  "), { wrapper });

    expect(searchArticlesSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(queryKeys.search.byAccountAndQuery("acc-1", ""))).toBeDefined();
    expect(queryClient.getQueryState(queryKeys.search.byAccountAndQuery("acc-1", "   \n\t  "))).toBeUndefined();
  });

  it("normalizes search account ids before enabling and caching search queries", async () => {
    const searchArticlesSpy = vi
      .spyOn(tauriCommands, "searchArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const initialProps: { accountId: string | null; query: string } = {
      accountId: " \n\t ",
      query: " fresh ",
    };

    const { rerender } = renderHook(
      ({ accountId, query }: { accountId: string | null; query: string }) => useSearchArticles(accountId, query),
      {
        initialProps,
        wrapper,
      },
    );

    expect(searchArticlesSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(queryKeys.search.byAccountAndQuery(null, "fresh"))).toBeDefined();
    expect(queryClient.getQueryState(["search", " \n\t ", "fresh"])).toBeUndefined();

    rerender({ accountId: " acc-1 ", query: " fresh " });

    await waitFor(() => {
      expect(searchArticlesSpy).toHaveBeenCalledWith("acc-1", "fresh");
    });
    expect(queryClient.getQueryData(queryKeys.search.byAccountAndQuery("acc-1", "fresh"))).toEqual(sampleArticles);
    expect(queryClient.getQueryState(["search", " acc-1 ", "fresh"])).toBeUndefined();
  });

  it("normalizes article search query unicode, whitespace, and length without FTS escaping", async () => {
    const searchArticlesSpy = vi
      .spyOn(tauriCommands, "searchArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const longSuffix = "長".repeat(150);
    const query = `　ＦＴＳ "quoted" OR emoji😀\n${longSuffix}`;
    const normalizedQuery = normalizeArticleSearchQuery(query);

    expect(Array.from(normalizedQuery)).toHaveLength(128);
    expect(normalizedQuery).toMatch(/^FTS "quoted" OR emoji😀 長+/u);
    expect(normalizedQuery).not.toContain("　");
    expect(normalizedQuery).not.toContain("\n");

    renderHook(() => useSearchArticles("acc-1", query), { wrapper });

    await waitFor(() => {
      expect(searchArticlesSpy).toHaveBeenCalledWith("acc-1", normalizedQuery);
    });
    expect(queryClient.getQueryData(queryKeys.search.byAccountAndQuery("acc-1", normalizedQuery))).toEqual(
      sampleArticles,
    );
    expect(queryClient.getQueryState(queryKeys.search.byAccountAndQuery("acc-1", query))).toBeUndefined();
  });

  it("resolves article search query owners from the same normalized account and query used by the query key", () => {
    expect(resolveArticleSearchQueryOwner(" acc-1 ", "　ＦＴＳ\nquery  ")).toEqual({
      accountId: "acc-1",
      query: "FTS query",
      key: "acc-1\0FTS query",
    });
    expect(resolveArticleSearchQueryOwner(null, "query")).toBeNull();
    expect(resolveArticleSearchQueryOwner("acc-1", "   ")).toBeNull();
  });

  it("hides placeholder search data while the next search owner is fetching", async () => {
    const firstSearch = createDeferred<Awaited<ReturnType<typeof tauriCommands.searchArticles>>>();
    const secondSearch = createDeferred<Awaited<ReturnType<typeof tauriCommands.searchArticles>>>();
    vi.spyOn(tauriCommands, "searchArticles")
      .mockReturnValueOnce(firstSearch.promise)
      .mockReturnValueOnce(secondSearch.promise);
    const queryWrapper = createQueryWrapper({
      queryClientConfig: {
        defaultOptions: {
          queries: {
            placeholderData: (previousData: unknown) => previousData,
          },
        },
      },
    });

    const { result, rerender } = renderHook(({ query }: { query: string }) => useSearchArticles("acc-1", query), {
      initialProps: { query: "query a" },
      wrapper: queryWrapper.wrapper,
    });

    await act(async () => {
      firstSearch.resolve(Result.succeed(sampleArticles));
      await waitFor(() => {
        expect(result.current.data).toEqual(sampleArticles);
      });
    });

    rerender({ query: "query b" });

    expect(result.current.searchOwner).toEqual({
      accountId: "acc-1",
      query: "query b",
      key: "acc-1\0query b",
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);

    await act(async () => {
      secondSearch.resolve(Result.succeed([sampleArticles[1]]));
      await waitFor(() => {
        expect(result.current.data).toEqual([sampleArticles[1]]);
      });
    });
  });

  it("treats whitespace-only manual article query ids as null-equivalent disabled ids", () => {
    const listArticlesSpy = vi.spyOn(tauriCommands, "listArticles").mockResolvedValue(Result.succeed(sampleArticles));
    const listAccountArticlesSpy = vi
      .spyOn(tauriCommands, "listAccountArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const listFolderArticlesSpy = vi
      .spyOn(tauriCommands, "listFolderArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const listRecentArticlesSpy = vi
      .spyOn(tauriCommands, "listRecentArticles")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const countAccountStarredArticlesSpy = vi
      .spyOn(tauriCommands, "countAccountStarredArticles")
      .mockResolvedValue(Result.succeed(1));

    renderHook(() => useArticles("   "), { wrapper });
    renderHook(() => useAccountArticles("\n\t"), { wrapper });
    renderHook(() => useFolderArticles("   "), { wrapper });
    renderHook(() => useRecentArticles("\n"), { wrapper });
    renderHook(() => useAccountStarredCount("   "), { wrapper });

    expect(listArticlesSpy).not.toHaveBeenCalled();
    expect(listAccountArticlesSpy).not.toHaveBeenCalled();
    expect(listFolderArticlesSpy).not.toHaveBeenCalled();
    expect(listRecentArticlesSpy).not.toHaveBeenCalled();
    expect(countAccountStarredArticlesSpy).not.toHaveBeenCalled();

    expect(queryClient.getQueryState(queryKeys.articles.byFeed(null, "all"))).toBeDefined();
    expect(queryClient.getQueryState(queryKeys.accountArticles.byAccount(null, "all"))).toBeDefined();
    expect(queryClient.getQueryState(queryKeys.folderArticles.byFolder(null, "all"))).toBeDefined();
    expect(queryClient.getQueryState(queryKeys.recentArticles.byAccount(null, "all"))).toBeDefined();
    expect(queryClient.getQueryState(queryKeys.accountStarredCount.byAccount(null))).toBeDefined();

    expect(queryClient.getQueryState(["articles", "   ", { mode: "all" }])).toBeUndefined();
    expect(queryClient.getQueryState(["accountArticles", "\n\t", { mode: "all" }])).toBeUndefined();
    expect(queryClient.getQueryState(["folderArticles", "   ", { mode: "all" }])).toBeUndefined();
    expect(queryClient.getQueryState(["recentArticles", "\n", { mode: "all" }])).toBeUndefined();
    expect(queryClient.getQueryState(["accountStarredCount", "   "])).toBeUndefined();
  });

  it("patches cached account and starred article data immediately when starring an article", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), sampleArticles);
    queryClient.setQueryData(
      queryKeys.starredArticles.byAccount("acc-1"),
      sampleArticles.filter((article) => article.is_starred),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
    });
  });

  it("patches cached account data and removes the article from starred caches when unstarring", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), sampleArticles);
    queryClient.setQueryData(
      queryKeys.starredArticles.byAccount("acc-1"),
      sampleArticles.filter((article) => article.is_starred),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2", is_starred: false })]),
      );
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([]);
    });
  });

  it("injects the updated article into account caches when unstarring a starred-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(
      queryKeys.accountArticles.byAccount("acc-1", "all"),
      sampleArticles.filter((article) => article.id !== "art-2"),
    );
    queryClient.setQueryData(
      queryKeys.accountArticles.byAccount("acc-1", "unread"),
      sampleArticles.filter((article) => !article.is_read),
    );
    queryClient.setQueryData(
      queryKeys.accountArticles.byAccount("acc-1", "starred"),
      sampleArticles.filter((article) => article.is_starred && article.id !== "art-2"),
    );
    queryClient.setQueryData(
      queryKeys.starredArticles.byAccount("acc-1"),
      sampleArticles.filter((article) => article.id === "art-2"),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2", is_starred: false })]),
      );
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"))).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2" })]),
      );
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "starred"))).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2" })]),
      );
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([]);
    });
  });

  it("creates the matching account cache when unstarring from a starred-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), sampleFeedsForAccountOne);
    queryClient.setQueryData(queryKeys.starredArticles.byAccount("acc-1"), [sampleArticles[1]]);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual([
        expect.objectContaining({ id: "art-2", is_starred: false }),
      ]);
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([]);
    });
  });

  it("creates the matching starred cache when starring from an account-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), sampleArticles);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
    });
  });

  it("patches mode-aware account article caches without creating an unscoped cache key", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), sampleFeedsForAccountOne);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), sampleArticles);
    queryClient.setQueryData(
      queryKeys.accountArticles.byAccount("acc-1", "unread"),
      sampleArticles.filter((article) => !article.is_read),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
    });
    expect(queryClient.getQueryData(queryKeys.accountArticles.byAccountPrefix("acc-1"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([
      expect.objectContaining({ id: "art-1", is_starred: true }),
    ]);
  });

  it("patches tag article caches without changing their article order", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), sampleFeedsForAccountOne);
    queryClient.setQueryData(["articlesByTag", "tag-1"], [sampleArticles[1], sampleArticles[0]]);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(["articlesByTag", "tag-1"])).toEqual([
        expect.objectContaining({ id: "art-2" }),
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
    });
  });

  it("associates a cached article with its feed account before invalidating article caches", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    const feedTwoArticle = {
      ...sampleArticles[0],
      id: "art-feed-2",
      feed_id: "feed-2",
      is_starred: false,
    };
    queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), sampleFeedsForAccountOne);
    queryClient.setQueryData(queryKeys.feeds.byAccount("acc-2"), [
      {
        ...sampleFeeds[1],
        account_id: "acc-2",
      },
    ]);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), sampleArticles);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-2", "all"), [feedTwoArticle]);
    queryClient.setQueryData(["articlesByTag", "tag-1", "acc-2", { mode: "all" }], [feedTwoArticle, sampleArticles[1]]);
    queryClient.setQueryData(["tagArticleCounts", "acc-2"], { "tag-1": 1 });

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-feed-2", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-2", "all"))).toEqual([
        expect.objectContaining({ id: "art-feed-2", is_starred: true }),
      ]);
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-2"))).toEqual([
        expect.objectContaining({ id: "art-feed-2", is_starred: true }),
      ]);
    });
    expect(queryClient.getQueryState(["articlesByTag", "tag-1", "acc-2", { mode: "all" }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["tagArticleCounts", "acc-2"])?.isInvalidated).toBe(true);
  });

  it("does not insert a starred article into another account when feed cache is missing", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), [sampleArticles[0]]);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-2", "all"), [
      {
        ...sampleArticles[1],
        id: "acc-2-article",
      },
    ]);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
    });
    expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-2", "all"))).toEqual([
      expect.objectContaining({ id: "acc-2-article" }),
    ]);
    expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-2"))).toBeUndefined();
  });

  it("does not synthesize scoped account caches when a cached article account cannot be inferred", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.articles.byFeed("feed-1", "all"), [sampleArticles[0]]);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-2", "all"), [
      {
        ...sampleArticles[1],
        id: "acc-2-article",
      },
    ]);
    queryClient.setQueryData(queryKeys.starredArticles.byAccount("acc-2"), []);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.articles.byFeed("feed-1", "all"))).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
    });
    expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-2", "all"))).toEqual([
      expect.objectContaining({ id: "acc-2-article" }),
    ]);
    expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-2"))).toEqual([]);
  });

  it("inserts missing account articles only into matching mode caches when the account is known", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), sampleFeedsForAccountOne);
    queryClient.setQueryData(queryKeys.articles.byFeed("feed-1", "all"), [sampleArticles[0]]);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), []);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"), []);
    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "starred"), []);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"))).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "starred"))).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
    });
  });

  it("does not let an older star mutation success overwrite the latest cache patch", async () => {
    const firstToggle = createDeferred<Awaited<ReturnType<typeof tauriCommands.toggleArticleStar>>>();
    const secondToggle = createDeferred<Awaited<ReturnType<typeof tauriCommands.toggleArticleStar>>>();
    vi.spyOn(tauriCommands, "toggleArticleStar")
      .mockReturnValueOnce(firstToggle.promise)
      .mockReturnValueOnce(secondToggle.promise);

    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), sampleArticles);
    queryClient.setQueryData(queryKeys.starredArticles.byAccount("acc-1"), []);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    const firstPromise = result.current.mutateAsync({
      id: "art-1",
      starred: true,
    });
    const secondPromise = result.current.mutateAsync({
      id: "art-1",
      starred: false,
    });

    await act(async () => {
      secondToggle.resolve(Result.succeed(null));
      await secondPromise;
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: false })]),
      );
      expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([]);
    });

    await act(async () => {
      firstToggle.resolve(Result.succeed(null));
      await firstPromise;
    });

    expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: false })]),
    );
    expect(queryClient.getQueryData(queryKeys.starredArticles.byAccount("acc-1"))).toEqual([]);
  });
});

describe("useSetRead", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    const queryWrapper = createQueryWrapper({
      queryClientConfig: {
        defaultOptions: {
          mutations: { retry: false },
        },
      },
    });
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    vi.restoreAllMocks();
  });

  it("marks filtered article caches read while preserving optimistic membership", async () => {
    vi.spyOn(tauriCommands, "markArticleRead").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(
      queryKeys.accountArticles.byAccount("acc-1", "unread"),
      sampleArticles.filter((article) => !article.is_read),
    );
    queryClient.setQueryData(
      queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "unread"),
      sampleArticles.filter((article) => !article.is_read),
    );
    queryClient.setQueryData(
      queryKeys.recentArticles.byAccount("acc-1", "unread"),
      sampleArticles.filter((article) => !article.is_read),
    );
    queryClient.setQueryData(queryKeys.search.byAccountAndQuery("acc-1", "fresh"), [
      sampleArticles[0],
      sampleArticles[1],
    ]);

    const { result } = renderHook(() => useSetRead(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", read: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"))).toEqual([
        expect.objectContaining({ id: "art-1", is_read: true }),
      ]);
      expect(queryClient.getQueryData(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "unread"))).toEqual([
        expect.objectContaining({ id: "art-1", is_read: true }),
      ]);
      expect(queryClient.getQueryData(queryKeys.recentArticles.byAccount("acc-1", "unread"))).toEqual([
        expect.objectContaining({ id: "art-1", is_read: true }),
      ]);
      expect(queryClient.getQueryData(queryKeys.search.byAccountAndQuery("acc-1", "fresh"))).toEqual([
        expect.objectContaining({ id: "art-1", is_read: true }),
        expect.objectContaining({ id: "art-2", is_read: true }),
      ]);
    });
  });

  it("marks tag article counts stale after changing article read state", async () => {
    vi.spyOn(tauriCommands, "markArticleRead").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["articlesByTag", "tag-1", "acc-1", { mode: "all" }], sampleArticles);
    queryClient.setQueryData(["tagArticleCounts", "acc-1"], { "tag-1": 1 });

    const { result } = renderHook(() => useSetRead(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", read: true });

    expect(queryClient.getQueryState(["articlesByTag", "tag-1", "acc-1", { mode: "all" }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["tagArticleCounts", "acc-1"])?.isInvalidated).toBe(true);
  });

  it("marks visible article, search, tag count, and unread count caches stale after old-unread mutations", async () => {
    vi.spyOn(tauriCommands, "markOldUnreadRead").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(queryKeys.folderArticles.byFolder("folder-1", "unread"), sampleArticles);
    queryClient.setQueryData(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "unread"), sampleArticles);
    queryClient.setQueryData(queryKeys.search.byAccountAndQuery("acc-1", "fresh"), sampleArticles);
    queryClient.setQueryData(queryKeys.accountUnreadCount.byAccount("acc-1"), 2);
    queryClient.setQueryData(queryKeys.tagArticleCounts.byAccount("acc-1"), { "tag-1": 2 });

    const { result } = renderHook(() => useMarkOldUnreadRead(), { wrapper });

    await result.current.mutateAsync({
      scopeKind: "folder",
      targetId: "folder-1",
      olderThanDays: 30,
    });

    expect(queryClient.getQueryState(queryKeys.folderArticles.byFolder("folder-1", "unread"))?.isInvalidated).toBe(
      true,
    );
    expect(
      queryClient.getQueryState(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "unread"))?.isInvalidated,
    ).toBe(true);
    expect(queryClient.getQueryState(queryKeys.search.byAccountAndQuery("acc-1", "fresh"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.accountUnreadCount.byAccount("acc-1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.tagArticleCounts.byAccount("acc-1"))?.isInvalidated).toBe(true);
  });

  it("does not let an older read mutation success overwrite the latest cache patch", async () => {
    const firstRead = createDeferred<Awaited<ReturnType<typeof tauriCommands.markArticleRead>>>();
    const secondRead = createDeferred<Awaited<ReturnType<typeof tauriCommands.markArticleRead>>>();
    vi.spyOn(tauriCommands, "markArticleRead")
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);

    queryClient.setQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"), sampleArticles);

    const { result } = renderHook(() => useSetRead(), { wrapper });

    const firstPromise = result.current.mutateAsync({
      id: "art-1",
      read: true,
    });
    const secondPromise = result.current.mutateAsync({
      id: "art-1",
      read: false,
    });

    await act(async () => {
      secondRead.resolve(Result.succeed(null));
      await secondPromise;
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_read: false })]),
      );
    });

    await act(async () => {
      firstRead.resolve(Result.succeed(null));
      await firstPromise;
    });

    expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "all"))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "art-1", is_read: false })]),
    );
  });
});

describe("recent article history mutations", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    const queryWrapper = createQueryWrapper({
      queryClientConfig: {
        defaultOptions: {
          mutations: { retry: false },
        },
      },
    });
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    vi.restoreAllMocks();
    setupTauriMocks();
  });

  it("invalidates recent articles only after recording an article view", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRecordArticleView(), { wrapper });

    await result.current.mutateAsync({
      accountId: "acc-1",
      articleId: "art-1",
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.recentArticles.root,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.articles.root,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.accountArticles.root,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ["accountUnreadCount"],
    });
  });

  it("treats blank article view ids as no-op success without invalidating recent articles", async () => {
    const recordArticleViewSpy = vi.spyOn(tauriCommands, "recordArticleView");
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRecordArticleView(), { wrapper });

    await expect(
      result.current.mutateAsync({
        accountId: "   ",
        articleId: "art-1",
      }),
    ).resolves.toBeNull();
    await expect(
      result.current.mutateAsync({
        accountId: "acc-1",
        articleId: "\n\t",
      }),
    ).resolves.toBeNull();

    expect(recordArticleViewSpy).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.recentArticles.root,
    });
  });

  it("invalidates recent articles only after clearing article view history", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useClearArticleViewHistory(), {
      wrapper,
    });

    await result.current.mutateAsync("acc-1");

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.recentArticles.root,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.articles.root,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.accountArticles.root,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ["accountUnreadCount"],
    });
  });
});
