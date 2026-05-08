import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import {
  useAccountArticles,
  useAccountStarredCount,
  useArticles,
  useSearchArticles,
  useToggleStar,
} from "@/hooks/use-articles";

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
    const initialAccountProps: { accountId: string | null } = { accountId: null };
    const initialSearchProps: { accountId: string | null; query: string } = { accountId: null, query: "fresh" };

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

  it("patches cached account and starred article data immediately when starring an article", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["accountArticles", "acc-1"], sampleArticles);
    queryClient.setQueryData(
      ["starredArticles", "acc-1"],
      sampleArticles.filter((article) => article.is_starred),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
    });
  });

  it("patches cached account data and removes the article from starred caches when unstarring", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["accountArticles", "acc-1"], sampleArticles);
    queryClient.setQueryData(
      ["starredArticles", "acc-1"],
      sampleArticles.filter((article) => article.is_starred),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2", is_starred: false })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([]);
    });
  });

  it("injects the updated article into account caches when unstarring a starred-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(
      ["accountArticles", "acc-1"],
      sampleArticles.filter((article) => article.id !== "art-2"),
    );
    queryClient.setQueryData(
      ["starredArticles", "acc-1"],
      sampleArticles.filter((article) => article.id === "art-2"),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2", is_starred: false })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([]);
    });
  });

  it("creates the matching account cache when unstarring from a starred-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["feeds", "acc-1"], sampleFeeds);
    queryClient.setQueryData(["starredArticles", "acc-1"], [sampleArticles[1]]);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual([
        expect.objectContaining({ id: "art-2", is_starred: false }),
      ]);
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([]);
    });
  });

  it("creates the matching starred cache when starring from an account-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["feeds", "acc-1"], sampleFeeds);
    queryClient.setQueryData(["accountArticles", "acc-1"], sampleArticles);

    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
    });
  });
});
