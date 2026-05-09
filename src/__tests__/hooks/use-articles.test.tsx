import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import {
  resolveArticleMutationInvalidationQueryKeys,
  useAccountArticles,
  useAccountStarredCount,
  useArticles,
  useClearArticleViewHistory,
  useFolderArticles,
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

    expect(queryClient.getQueryState(queryKeys.articles.byFeed("   ", "all"))).toBeUndefined();
    expect(queryClient.getQueryState(queryKeys.accountArticles.byAccount("\n\t", "all"))).toBeUndefined();
    expect(queryClient.getQueryState(queryKeys.folderArticles.byFolder("   ", "all"))).toBeUndefined();
    expect(queryClient.getQueryState(queryKeys.recentArticles.byAccount("\n", "all"))).toBeUndefined();
    expect(queryClient.getQueryState(queryKeys.accountStarredCount.byAccount("   "))).toBeUndefined();
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

  it("marks unread-mode account caches read while preserving optimistic membership", async () => {
    vi.spyOn(tauriCommands, "markArticleRead").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(
      queryKeys.accountArticles.byAccount("acc-1", "unread"),
      sampleArticles.filter((article) => !article.is_read),
    );

    const { result } = renderHook(() => useSetRead(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", read: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountArticles.byAccount("acc-1", "unread"))).toEqual([
        expect.objectContaining({ id: "art-1", is_read: true }),
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
