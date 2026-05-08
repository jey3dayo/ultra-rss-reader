import { renderHook } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import { useArticleListSources } from "@/components/reader/hooks/article-list/use-article-list-sources";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { UiSelection } from "@/lib/ui-state.types";

const {
  useFeedsMock,
  useArticlesMock,
  useAccountArticlesMock,
  useFeedStarredArticlesMock,
  useFolderArticlesMock,
  useStarredArticlesMock,
  useRecentArticlesMock,
  useArticlesByTagMock,
} = vi.hoisted(() => ({
  useFeedsMock: vi.fn(),
  useArticlesMock: vi.fn(),
  useAccountArticlesMock: vi.fn(),
  useFeedStarredArticlesMock: vi.fn(),
  useFolderArticlesMock: vi.fn(),
  useStarredArticlesMock: vi.fn(),
  useRecentArticlesMock: vi.fn(),
  useArticlesByTagMock: vi.fn(),
}));

vi.mock("@/hooks/use-feeds", () => ({
  useFeeds: (...args: unknown[]) => useFeedsMock(...args),
}));

vi.mock("@/hooks/use-articles", () => ({
  useArticles: (...args: unknown[]) => useArticlesMock(...args),
  useAccountArticles: (...args: unknown[]) => useAccountArticlesMock(...args),
  useFeedStarredArticles: (...args: unknown[]) => useFeedStarredArticlesMock(...args),
  useFolderArticles: (...args: unknown[]) => useFolderArticlesMock(...args),
  useStarredArticles: (...args: unknown[]) => useStarredArticlesMock(...args),
  useRecentArticles: (...args: unknown[]) => useRecentArticlesMock(...args),
}));

vi.mock("@/hooks/use-tags", () => ({
  useArticlesByTag: (...args: unknown[]) => useArticlesByTagMock(...args),
}));

type MatrixMode = ViewMode;

function matrixArticle(id: string, feedId: string, isRead: boolean, isStarred: boolean): ArticleDto {
  return {
    id,
    feed_id: feedId,
    title: id,
    content_sanitized: `<p>${id}</p>`,
    summary: null,
    url: `https://example.com/${id}`,
    author: null,
    published_at: `2026-03-2${id.slice(-1)}T10:00:00Z`,
    thumbnail: null,
    is_read: isRead,
    is_starred: isStarred,
  };
}

function filterMatrixMode(articles: ArticleDto[], mode: MatrixMode): ArticleDto[] {
  if (mode === "unread") {
    return articles.filter((article) => !article.is_read);
  }

  if (mode === "starred") {
    return articles.filter((article) => article.is_starred);
  }

  return articles;
}

describe("useArticleListSources", () => {
  beforeEach(() => {
    useFeedsMock.mockReturnValue({ data: sampleFeeds });
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { mode?: ViewMode }) => ({
      data:
        options?.mode === "unread"
          ? sampleArticles.filter((article) => !article.is_read)
          : options?.mode === "starred"
            ? sampleArticles.filter((article) => article.is_starred)
            : sampleArticles,
      isLoading: false,
    }));
    useAccountArticlesMock.mockImplementation((_accountId: string | null, options?: { mode?: ViewMode }) => ({
      data:
        options?.mode === "unread"
          ? sampleArticles.filter((article) => !article.is_read)
          : options?.mode === "starred"
            ? sampleArticles.filter((article) => article.is_starred)
            : sampleArticles,
      isLoading: false,
    }));
    useArticlesByTagMock.mockImplementation(
      (_tagId: string | null, _accountId: string | null, options?: { mode?: ViewMode }) => ({
        data:
          options?.mode === "unread"
            ? sampleArticles.filter((article) => !article.is_read)
            : options?.mode === "starred"
              ? sampleArticles.filter((article) => article.is_starred)
              : [],
        isLoading: false,
      }),
    );
    useFeedStarredArticlesMock.mockReturnValue({
      data: sampleArticles.filter((article) => article.is_starred),
      isLoading: false,
    });
    useFolderArticlesMock.mockReturnValue({ data: undefined, isLoading: false });
    useStarredArticlesMock.mockReturnValue({
      data: sampleArticles.filter((article) => article.is_starred),
      isLoading: false,
    });
    useRecentArticlesMock.mockReturnValue({ data: [sampleArticles[1], sampleArticles[0]], isLoading: false });
  });

  it("requests unread-only feed articles when the feed view is unread", () => {
    renderHook(
      () =>
        useArticleListSources({
          selection: { type: "feed", feedId: "feed-1" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "unread",
        }),
      { wrapper: createWrapper() },
    );

    expect(useArticlesMock).toHaveBeenCalledWith("feed-1", { mode: "unread" });
  });

  it("requests starred feed articles through the article mode when the feed view is starred", () => {
    renderHook(
      () =>
        useArticleListSources({
          selection: { type: "feed", feedId: "feed-1" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "starred",
        }),
      { wrapper: createWrapper() },
    );

    expect(useArticlesMock).toHaveBeenCalledWith("feed-1", { mode: "starred" });
  });

  it("requests unread-only account articles for the smart unread view", () => {
    renderHook(
      () =>
        useArticleListSources({
          selection: { type: "smart", kind: "unread" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "unread",
        }),
      { wrapper: createWrapper() },
    );

    expect(useAccountArticlesMock).toHaveBeenCalledWith("acc-1", { mode: "unread" });
  });

  it("requests recent articles for the smart recent view", () => {
    const { result } = renderHook(
      () =>
        useArticleListSources({
          selection: { type: "smart", kind: "recent" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "all",
        }),
      { wrapper: createWrapper() },
    );

    expect(useRecentArticlesMock).toHaveBeenCalledWith("acc-1", { mode: "all" });
    expect(result.current.accountArticles?.map((article) => article.id)).toEqual(["art-2", "art-1"]);
  });

  it("requests mode-filtered recent articles for recent footer filters", () => {
    renderHook(
      () =>
        useArticleListSources({
          selection: { type: "smart", kind: "recent" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "starred",
        }),
      { wrapper: createWrapper() },
    );

    expect(useRecentArticlesMock).toHaveBeenCalledWith("acc-1", { mode: "starred" });
  });

  it("requests starred tag articles through the tag mode when the tag view is starred", () => {
    renderHook(
      () =>
        useArticleListSources({
          selection: { type: "tag", tagId: "tag-1" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "starred",
        }),
      { wrapper: createWrapper() },
    );

    expect(useArticlesByTagMock).toHaveBeenCalledWith("tag-1", "acc-1", { mode: "starred" });
  });

  it("matches docs/reader-article-scope-matrix.md counts for source, scope, and filter combinations", () => {
    const accountArticles = [
      matrixArticle("matrix-1", "feed-1", false, false),
      matrixArticle("matrix-2", "feed-1", true, true),
      matrixArticle("matrix-3", "feed-1", false, true),
      matrixArticle("matrix-4", "feed-2", false, true),
      matrixArticle("matrix-5", "feed-2", true, false),
      matrixArticle("matrix-6", "feed-3", true, true),
    ];
    const feedArticles = accountArticles.filter((article) => article.feed_id === "feed-1");
    const folderArticles = accountArticles.filter(
      (article) => article.feed_id === "feed-2" || article.feed_id === "feed-3",
    );
    const tagArticles = accountArticles.filter((article) =>
      ["matrix-1", "matrix-2", "matrix-3", "matrix-4"].includes(article.id),
    );
    const recentArticles = ["matrix-6", "matrix-5", "matrix-4", "matrix-3", "matrix-2"]
      .map((id) => accountArticles.find((article) => article.id === id))
      .filter((article): article is ArticleDto => article !== undefined);

    useAccountArticlesMock.mockImplementation((accountId: string | null, options?: { mode?: MatrixMode }) => ({
      data: accountId ? filterMatrixMode(accountArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));
    useArticlesMock.mockImplementation((feedId: string | null, options?: { mode?: MatrixMode }) => ({
      data: feedId ? filterMatrixMode(feedArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));
    useFolderArticlesMock.mockImplementation((folderId: string | null, options?: { mode?: MatrixMode }) => ({
      data: folderId ? filterMatrixMode(folderArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));
    useArticlesByTagMock.mockImplementation(
      (tagId: string | null, _accountId: string | null, options?: { mode?: MatrixMode }) => ({
        data: tagId ? filterMatrixMode(tagArticles, options?.mode ?? "all") : undefined,
        isLoading: false,
      }),
    );
    useRecentArticlesMock.mockImplementation((accountId: string | null, options?: { mode?: MatrixMode }) => ({
      data: accountId ? filterMatrixMode(recentArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));

    const cases: Array<{
      name: string;
      selection: UiSelection;
      viewMode: MatrixMode;
      expectedCount: number;
      expectedHook: ReturnType<typeof vi.fn>;
      expectedArgs: unknown[];
      resultKey: "accountArticles" | "articles" | "tagArticles";
      expectedSourceKind: "account" | "folder" | "feed" | "tag" | "recent";
      expectedSourceKey: string;
    }> = [
      {
        name: "unread smart view",
        selection: { type: "smart", kind: "unread" },
        viewMode: "all",
        expectedCount: 3,
        expectedHook: useAccountArticlesMock,
        expectedArgs: ["acc-1", { mode: "unread" }],
        resultKey: "accountArticles",
        expectedSourceKind: "account",
        expectedSourceKey: "account:acc-1:articles:unread",
      },
      {
        name: "starred smart view",
        selection: { type: "smart", kind: "starred" },
        viewMode: "all",
        expectedCount: 4,
        expectedHook: useAccountArticlesMock,
        expectedArgs: ["acc-1", { mode: "starred" }],
        resultKey: "accountArticles",
        expectedSourceKind: "account",
        expectedSourceKey: "account:acc-1:articles:starred",
      },
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `selection all ${mode}`,
        selection: { type: "all" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(accountArticles, mode).length,
        expectedHook: useAccountArticlesMock,
        expectedArgs: ["acc-1", { mode }],
        resultKey: "accountArticles" as const,
        expectedSourceKind: "account" as const,
        expectedSourceKey: `account:acc-1:articles:${mode}`,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `folder ${mode}`,
        selection: { type: "folder", folderId: "folder-1" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(folderArticles, mode).length,
        expectedHook: useFolderArticlesMock,
        expectedArgs: ["folder-1", { mode }],
        resultKey: "accountArticles" as const,
        expectedSourceKind: "folder" as const,
        expectedSourceKey: `folder:folder-1:${mode}`,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `feed ${mode}`,
        selection: { type: "feed", feedId: "feed-1" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(feedArticles, mode).length,
        expectedHook: useArticlesMock,
        expectedArgs: ["feed-1", { mode }],
        resultKey: "articles" as const,
        expectedSourceKind: "feed" as const,
        expectedSourceKey: `feed:feed-1:${mode}`,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `tag ${mode}`,
        selection: { type: "tag", tagId: "tag-1" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(tagArticles, mode).length,
        expectedHook: useArticlesByTagMock,
        expectedArgs: ["tag-1", "acc-1", { mode }],
        resultKey: "tagArticles" as const,
        expectedSourceKind: "tag" as const,
        expectedSourceKey: `tag:tag-1:${mode}`,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `recent ${mode}`,
        selection: { type: "smart", kind: "recent" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(recentArticles, mode).length,
        expectedHook: useRecentArticlesMock,
        expectedArgs: ["acc-1", { mode }],
        resultKey: "accountArticles" as const,
        expectedSourceKind: "recent" as const,
        expectedSourceKey: `recent:acc-1:${mode}`,
      })),
    ];

    for (const testCase of cases) {
      vi.clearAllMocks();

      const { result, unmount } = renderHook(
        () =>
          useArticleListSources({
            selection: testCase.selection,
            selectedAccountId: "acc-1",
            selectedArticleId: null,
            retainedArticleIds: new Set(),
            viewMode: testCase.viewMode,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current[testCase.resultKey]?.length, testCase.name).toBe(testCase.expectedCount);
      expect(result.current.sourcePlan.sourceKind, testCase.name).toBe(testCase.expectedSourceKind);
      expect(result.current.sourcePlan.sourceKey, testCase.name).toBe(testCase.expectedSourceKey);
      expect(testCase.expectedHook, testCase.name).toHaveBeenCalledWith(...testCase.expectedArgs);
      unmount();
    }
  });

  it("keeps a retained selected article in the feed source after unread refetch removes it", () => {
    let currentArticles = [sampleArticles[0]];
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { mode?: ViewMode }) => ({
      data: options?.mode === "unread" ? currentArticles : [sampleArticles[0]],
      isLoading: false,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "feed", feedId: "feed-1" },
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
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { mode?: ViewMode }) => ({
      data:
        options?.mode === "unread"
          ? currentArticles
          : [sampleArticles[0], { ...sampleArticles[1], id: "art-3", is_read: false, is_starred: false }],
      isLoading: false,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "feed", feedId: "feed-1" },
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
    useAccountArticlesMock.mockImplementation((_accountId: string | null, options?: { mode?: ViewMode }) => ({
      data:
        options?.mode === "starred"
          ? currentStarredArticles
          : options?.mode === "unread"
            ? sampleArticles.filter((article) => !article.is_read)
            : sampleArticles,
      isLoading: false,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "smart", kind: "starred" },
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
