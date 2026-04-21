import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleListSources } from "@/components/reader/use-article-list-sources";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "../../../tests/helpers/tauri-mocks";

const { useFeedsMock, useArticlesMock, useAccountArticlesMock, useStarredArticlesMock, useArticlesByTagMock } =
  vi.hoisted(() => ({
    useFeedsMock: vi.fn(),
    useArticlesMock: vi.fn(),
    useAccountArticlesMock: vi.fn(),
    useStarredArticlesMock: vi.fn(),
    useArticlesByTagMock: vi.fn(),
  }));

vi.mock("@/hooks/use-feeds", () => ({
  useFeeds: (...args: unknown[]) => useFeedsMock(...args),
}));

vi.mock("@/hooks/use-articles", () => ({
  useArticles: (...args: unknown[]) => useArticlesMock(...args),
  useAccountArticles: (...args: unknown[]) => useAccountArticlesMock(...args),
  useStarredArticles: (...args: unknown[]) => useStarredArticlesMock(...args),
}));

vi.mock("@/hooks/use-tags", () => ({
  useArticlesByTag: (...args: unknown[]) => useArticlesByTagMock(...args),
}));

describe("useArticleListSources", () => {
  beforeEach(() => {
    useFeedsMock.mockReturnValue({ data: sampleFeeds });
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { unreadOnly?: boolean }) => ({
      data: options?.unreadOnly ? sampleArticles.filter((article) => !article.is_read) : sampleArticles,
      isLoading: false,
    }));
    useAccountArticlesMock.mockImplementation((_accountId: string | null, options?: { unreadOnly?: boolean }) => ({
      data: options?.unreadOnly ? sampleArticles.filter((article) => !article.is_read) : sampleArticles,
      isLoading: false,
    }));
    useStarredArticlesMock.mockReturnValue({
      data: sampleArticles.filter((article) => article.is_starred),
      isLoading: false,
    });
    useArticlesByTagMock.mockReturnValue({ data: [], isLoading: false });
  });

  it("requests unread-only feed articles when the feed view is unread", () => {
    renderHook(
      () =>
        useArticleListSources({
          selection: { type: "feed", feedId: "feed-1" },
          selectionContext: { kind: "feed", key: "feed:acc-1:feed-1" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "unread",
        }),
      { wrapper: createWrapper() },
    );

    expect(useArticlesMock).toHaveBeenCalledWith("feed-1", { unreadOnly: true });
  });

  it("requests unread-only account articles for the smart unread view", () => {
    renderHook(
      () =>
        useArticleListSources({
          selection: { type: "smart", kind: "unread" },
          selectionContext: { kind: "account", key: "account:acc-1:smart:unread" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "unread",
        }),
      { wrapper: createWrapper() },
    );

    expect(useAccountArticlesMock).toHaveBeenCalledWith("acc-1", { unreadOnly: true });
  });

  it("keeps a retained selected article in the feed source after unread refetch removes it", () => {
    let currentArticles = [sampleArticles[0]];
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { unreadOnly?: boolean }) => ({
      data: options?.unreadOnly ? currentArticles : [sampleArticles[0]],
      isLoading: false,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "feed", feedId: "feed-1" },
      selectionContext: { kind: "feed", key: "feed:acc-1:feed-1" },
      selectedAccountId: "acc-1",
      selectedArticleId: "art-1",
      retainedArticleIds: new Set(["art-1"]),
      viewMode: "unread",
    };

    const { result, rerender } = renderHook(() => useArticleListSources(props), {
      wrapper: createWrapper(),
    });

    expect(result.current.articles?.map((article) => article.id)).toEqual(["art-1"]);

    currentArticles = [];
    rerender();

    expect(result.current.articles?.map((article) => article.id)).toEqual(["art-1"]);
  });

  it("keeps previously retained feed articles when another retained article remains selected", () => {
    let currentArticles = [sampleArticles[0], { ...sampleArticles[1], id: "art-3", is_read: false, is_starred: false }];
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { unreadOnly?: boolean }) => ({
      data: options?.unreadOnly
        ? currentArticles
        : [sampleArticles[0], { ...sampleArticles[1], id: "art-3", is_read: false, is_starred: false }],
      isLoading: false,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "feed", feedId: "feed-1" },
      selectionContext: { kind: "feed", key: "feed:acc-1:feed-1" },
      selectedAccountId: "acc-1",
      selectedArticleId: "art-3",
      retainedArticleIds: new Set(["art-1", "art-3"]),
      viewMode: "unread",
    };

    const { result, rerender } = renderHook(() => useArticleListSources(props), {
      wrapper: createWrapper(),
    });

    expect(result.current.articles?.map((article) => article.id)).toEqual(["art-1", "art-3"]);

    currentArticles = [{ ...sampleArticles[1], id: "art-3", is_read: false, is_starred: false }];
    rerender();

    expect(result.current.articles?.map((article) => article.id)).toEqual(["art-1", "art-3"]);
  });

  it("keeps a retained selected article in the smart starred source after unstar refetch removes it", () => {
    let currentStarredArticles = [sampleArticles[1]];
    useStarredArticlesMock.mockImplementation(() => ({ data: currentStarredArticles, isLoading: false }));
    useAccountArticlesMock.mockImplementation((_accountId: string | null, options?: { unreadOnly?: boolean }) => ({
      data: options?.unreadOnly ? sampleArticles.filter((article) => !article.is_read) : sampleArticles,
      isLoading: false,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "smart", kind: "starred" },
      selectionContext: { kind: "account", key: "account:acc-1:smart:starred" },
      selectedAccountId: "acc-1",
      selectedArticleId: "art-2",
      retainedArticleIds: new Set(["art-2"]),
      viewMode: "all",
    };

    const { result, rerender } = renderHook(() => useArticleListSources(props), {
      wrapper: createWrapper(),
    });

    expect(result.current.accountArticles?.map((article) => article.id)).toEqual(["art-2"]);

    currentStarredArticles = [];
    rerender();

    expect(result.current.accountArticles?.map((article) => article.id)).toEqual(["art-2"]);
  });
});
