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
    useArticlesMock.mockReturnValue({ data: sampleArticles, isLoading: false });
    useAccountArticlesMock.mockReturnValue({ data: sampleArticles, isLoading: false });
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
          viewMode: "unread",
        }),
      { wrapper: createWrapper() },
    );

    expect(useAccountArticlesMock).toHaveBeenCalledWith("acc-1", { unreadOnly: true });
  });
});
