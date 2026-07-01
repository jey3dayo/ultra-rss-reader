import { renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import type { ArticleListSelection } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { useArticleListSources } from "@/components/reader/hooks/article-list/use-article-list-sources";
import { resolveReaderSourcePlan } from "@/lib/reader/reader-query";
import type { ViewMode } from "@/lib/reader/view-mode.types";

setupBrowserTestDom();

const {
  useFeedsMock,
  useFoldersMock,
  useArticlesMock,
  useAccountArticlesMock,
  useFeedStarredArticlesMock,
  useFolderArticlesMock,
  useStarredArticlesMock,
  useRecentArticlesMock,
  useArticlesByTagMock,
  useTagsMock,
} = vi.hoisted(() => ({
  useFeedsMock: vi.fn(),
  useFoldersMock: vi.fn(),
  useArticlesMock: vi.fn(),
  useAccountArticlesMock: vi.fn(),
  useFeedStarredArticlesMock: vi.fn(),
  useFolderArticlesMock: vi.fn(),
  useStarredArticlesMock: vi.fn(),
  useRecentArticlesMock: vi.fn(),
  useArticlesByTagMock: vi.fn(),
  useTagsMock: vi.fn(),
}));

vi.mock("@/hooks/use-feeds", () => ({
  useFeeds: (...args: unknown[]) => useFeedsMock(...args),
}));

vi.mock("@/hooks/use-folders", () => ({
  useFolders: (...args: unknown[]) => useFoldersMock(...args),
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
  useTags: (...args: unknown[]) => useTagsMock(...args),
}));

type MatrixMode = ViewMode;
type MatrixSources = {
  accountArticles: ArticleDto[];
  feedArticles: ArticleDto[];
  folderArticles: ArticleDto[];
  tagArticles: ArticleDto[];
  recentArticles: ArticleDto[];
  accountFeeds: FeedDto[];
  folderFeedIds: Set<string>;
  unreadCountBySource: {
    account: number;
    feed: number;
    folder: number;
    tag: number;
    recent: number;
  };
};

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

function createMatrixFeeds(): FeedDto[] {
  return [
    {
      ...sampleFeeds[0],
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      unread_count: 2,
    },
    {
      ...sampleFeeds[1],
      id: "feed-2",
      account_id: "acc-1",
      folder_id: "folder-1",
      unread_count: 1,
    },
    {
      ...sampleFeeds[2],
      id: "feed-3",
      account_id: "acc-1",
      folder_id: "folder-1",
      unread_count: 0,
    },
    {
      ...sampleFeeds[0],
      id: "feed-other-account",
      account_id: "acc-2",
      folder_id: null,
      unread_count: 9,
    },
  ];
}

function createMatrixFolders(): FolderDto[] {
  return [
    {
      id: "folder-1",
      account_id: "acc-1",
      name: "Folder 1",
      sort_order: 0,
    },
    {
      id: "folder-2",
      account_id: "acc-1",
      name: "Folder 2",
      sort_order: 1,
    },
  ];
}

function createMatrixSources(): MatrixSources {
  const accountArticles = [
    matrixArticle("matrix-1", "feed-1", false, false),
    matrixArticle("matrix-2", "feed-1", true, true),
    matrixArticle("matrix-3", "feed-1", false, true),
    matrixArticle("matrix-4", "feed-2", false, true),
    matrixArticle("matrix-5", "feed-2", true, false),
    matrixArticle("matrix-6", "feed-3", true, true),
  ];
  const tagArticleIds = new Set(["matrix-1", "matrix-2", "matrix-3", "matrix-4"]);
  const recentArticleIds = ["matrix-6", "matrix-5", "matrix-4", "matrix-3", "matrix-2"];
  const recentOrderById = new Map(recentArticleIds.map((articleId, index) => [articleId, index]));
  const feeds = createMatrixFeeds();
  const accountFeeds: FeedDto[] = [];
  const folderFeedIds = new Set<string>();

  for (const feed of feeds) {
    if (feed.account_id !== "acc-1") {
      continue;
    }

    accountFeeds.push(feed);
    if (feed.folder_id === "folder-1") {
      folderFeedIds.add(feed.id);
    }
  }

  const sources = accountArticles.reduce<{
    feedArticles: ArticleDto[];
    folderArticles: ArticleDto[];
    tagArticles: ArticleDto[];
    recentByOrder: Map<number, ArticleDto>;
    unreadCountBySource: MatrixSources["unreadCountBySource"];
  }>(
    (accumulator, article) => {
      if (article.feed_id === "feed-1") {
        accumulator.feedArticles.push(article);
      }

      if (folderFeedIds.has(article.feed_id)) {
        accumulator.folderArticles.push(article);
      }

      if (tagArticleIds.has(article.id)) {
        accumulator.tagArticles.push(article);
      }

      const recentOrder = recentOrderById.get(article.id);
      if (recentOrder !== undefined) {
        accumulator.recentByOrder.set(recentOrder, article);
      }

      if (!article.is_read) {
        accumulator.unreadCountBySource.account += 1;
        if (article.feed_id === "feed-1") {
          accumulator.unreadCountBySource.feed += 1;
        }
        if (folderFeedIds.has(article.feed_id)) {
          accumulator.unreadCountBySource.folder += 1;
        }
        if (tagArticleIds.has(article.id)) {
          accumulator.unreadCountBySource.tag += 1;
        }
        if (recentOrder !== undefined) {
          accumulator.unreadCountBySource.recent += 1;
        }
      }

      return accumulator;
    },
    {
      feedArticles: [],
      folderArticles: [],
      tagArticles: [],
      recentByOrder: new Map(),
      unreadCountBySource: {
        account: 0,
        feed: 0,
        folder: 0,
        tag: 0,
        recent: 0,
      },
    },
  );

  return {
    accountArticles,
    feedArticles: sources.feedArticles,
    folderArticles: sources.folderArticles,
    tagArticles: sources.tagArticles,
    recentArticles: recentArticleIds.flatMap((_, index) => {
      const article = sources.recentByOrder.get(index);
      return article ? [article] : [];
    }),
    accountFeeds,
    folderFeedIds,
    unreadCountBySource: sources.unreadCountBySource,
  };
}

describe("useArticleListSources", () => {
  beforeEach(() => {
    useFeedsMock.mockReturnValue({ data: sampleFeeds });
    useFoldersMock.mockReturnValue({
      data: [
        {
          id: "folder-1",
          account_id: "acc-1",
          name: "Folder 1",
          sort_order: 0,
        },
        {
          id: "folder-2",
          account_id: "acc-1",
          name: "Folder 2",
          sort_order: 1,
        },
      ],
    });
    useTagsMock.mockReturnValue({
      data: [{ id: "tag-1", name: "Important", color: "#ff0000" }],
    });
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
    useFolderArticlesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    useStarredArticlesMock.mockReturnValue({
      data: sampleArticles.filter((article) => article.is_starred),
      isLoading: false,
    });
    useRecentArticlesMock.mockReturnValue({
      data: [sampleArticles[1], sampleArticles[0]],
      isLoading: false,
    });
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

    expect(useAccountArticlesMock).toHaveBeenCalledWith("acc-1", {
      mode: "unread",
    });
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

    expect(useRecentArticlesMock).toHaveBeenCalledWith("acc-1", {
      mode: "all",
    });
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

    expect(useRecentArticlesMock).toHaveBeenCalledWith("acc-1", {
      mode: "starred",
    });
  });

  it("reports folder source loading separately from account article loading", () => {
    useAccountArticlesMock.mockReturnValue({
      data: sampleArticles,
      isLoading: false,
    });
    useFolderArticlesMock.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(
      () =>
        useArticleListSources({
          selection: { type: "folder", folderId: "folder-1" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "all",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoadingAccountArticles).toBe(false);
    expect(result.current.isLoadingFolderArticles).toBe(true);
  });

  it("reports feed source loading with a feed-specific result name", () => {
    useArticlesMock.mockImplementation((feedId: string | null, options?: { mode?: ViewMode }) => ({
      data: feedId && options?.mode === "all" ? sampleArticles : undefined,
      isLoading: options?.mode === "unread",
    }));

    const { result } = renderHook(
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

    expect(result.current.isLoadingFeedArticles).toBe(true);
    expect(result.current.isLoadingAccountArticles).toBe(false);
  });

  it("reports recent source loading separately from account article loading", () => {
    useAccountArticlesMock.mockReturnValue({
      data: sampleArticles,
      isLoading: false,
    });
    useRecentArticlesMock.mockReturnValue({ data: undefined, isLoading: true });

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

    expect(result.current.isLoadingAccountArticles).toBe(false);
    expect(result.current.isLoadingRecentArticles).toBe(true);
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

    expect(useArticlesByTagMock).toHaveBeenCalledWith("tag-1", "acc-1", {
      mode: "starred",
    });
  });

  it("matches docs/reader-article-scope-matrix.md counts for source, scope, and filter combinations", () => {
    const matrixSources = createMatrixSources();
    useFeedsMock.mockReturnValue({ data: matrixSources.accountFeeds });
    useFoldersMock.mockReturnValue({ data: createMatrixFolders() });

    expect(
      matrixSources.accountFeeds.map((feed) => feed.id),
      "account filtered sources should exclude feeds from other accounts",
    ).toEqual(["feed-1", "feed-2", "feed-3"]);
    expect([...matrixSources.folderFeedIds], "folder grouping should collect only feeds assigned to folder-1").toEqual([
      "feed-2",
      "feed-3",
    ]);
    expect(matrixSources.unreadCountBySource, "unread count fixture should stay explicit by source").toEqual({
      account: 3,
      feed: 2,
      folder: 1,
      tag: 3,
      recent: 2,
    });
    expect(matrixSources.folderArticles.length, "empty source guard: folder-1 should have fixture articles").toBe(3);
    expect(
      matrixSources.recentArticles.map((article) => article.id),
      "sort order should preserve recent source order",
    ).toEqual(["matrix-6", "matrix-5", "matrix-4", "matrix-3", "matrix-2"]);

    useAccountArticlesMock.mockImplementation((accountId: string | null, options?: { mode?: MatrixMode }) => ({
      data: accountId ? filterMatrixMode(matrixSources.accountArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));
    useArticlesMock.mockImplementation((feedId: string | null, options?: { mode?: MatrixMode }) => ({
      data: feedId ? filterMatrixMode(matrixSources.feedArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));
    useFolderArticlesMock.mockImplementation((folderId: string | null, options?: { mode?: MatrixMode }) => ({
      data: folderId ? filterMatrixMode(matrixSources.folderArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));
    useArticlesByTagMock.mockImplementation(
      (tagId: string | null, _accountId: string | null, options?: { mode?: MatrixMode }) => ({
        data: tagId ? filterMatrixMode(matrixSources.tagArticles, options?.mode ?? "all") : undefined,
        isLoading: false,
      }),
    );
    useRecentArticlesMock.mockImplementation((accountId: string | null, options?: { mode?: MatrixMode }) => ({
      data: accountId ? filterMatrixMode(matrixSources.recentArticles, options?.mode ?? "all") : undefined,
      isLoading: false,
    }));

    const cases: Array<{
      name: string;
      selection: ArticleListSelection;
      viewMode: MatrixMode;
      expectedCount: number;
      expectedHook: ReturnType<typeof vi.fn>;
      expectedArgs: unknown[];
      resultKey: "accountArticles" | "articles" | "tagArticles";
    }> = [
      {
        name: "unread smart view",
        selection: { type: "smart", kind: "unread" },
        viewMode: "all",
        expectedCount: 3,
        expectedHook: useAccountArticlesMock,
        expectedArgs: ["acc-1", { mode: "unread" }],
        resultKey: "accountArticles",
      },
      {
        name: "starred smart view",
        selection: { type: "smart", kind: "starred" },
        viewMode: "all",
        expectedCount: 4,
        expectedHook: useAccountArticlesMock,
        expectedArgs: ["acc-1", { mode: "starred" }],
        resultKey: "accountArticles",
      },
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `selection all ${mode}`,
        selection: { type: "all" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(matrixSources.accountArticles, mode).length,
        expectedHook: useAccountArticlesMock,
        expectedArgs: ["acc-1", { mode }],
        resultKey: "accountArticles" as const,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `folder ${mode}`,
        selection: { type: "folder", folderId: "folder-1" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(matrixSources.folderArticles, mode).length,
        expectedHook: useFolderArticlesMock,
        expectedArgs: ["folder-1", { mode }],
        resultKey: "accountArticles" as const,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `feed ${mode}`,
        selection: { type: "feed", feedId: "feed-1" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(matrixSources.feedArticles, mode).length,
        expectedHook: useArticlesMock,
        expectedArgs: ["feed-1", { mode }],
        resultKey: "articles" as const,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `tag ${mode}`,
        selection: { type: "tag", tagId: "tag-1" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(matrixSources.tagArticles, mode).length,
        expectedHook: useArticlesByTagMock,
        expectedArgs: ["tag-1", "acc-1", { mode }],
        resultKey: "tagArticles" as const,
      })),
      ...(["unread", "all", "starred"] as const).map((mode) => ({
        name: `recent ${mode}`,
        selection: { type: "smart", kind: "recent" } as const,
        viewMode: mode,
        expectedCount: filterMatrixMode(matrixSources.recentArticles, mode).length,
        expectedHook: useRecentArticlesMock,
        expectedArgs: ["acc-1", { mode }],
        resultKey: "accountArticles" as const,
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
      const expectedSourcePlan = resolveReaderSourcePlan(testCase.selection, testCase.viewMode, "acc-1");
      expect(result.current.sourcePlan.sourceKind, testCase.name).toBe(expectedSourcePlan.sourceKind);
      expect(result.current.sourcePlan.sourceKey, testCase.name).toBe(expectedSourcePlan.sourceKey);
      expect(testCase.expectedHook, testCase.name).toHaveBeenCalledWith(...testCase.expectedArgs);
      unmount();
    }
  });

  it("does not adopt stale feed articles for a newly selected feed", () => {
    useFeedsMock.mockReturnValue({
      data: createMatrixFeeds().filter((feed) => feed.account_id === "acc-1"),
    });
    useArticlesMock.mockReturnValue({
      data: [matrixArticle("stale-feed-result", "feed-2", false, false)],
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useArticleListSources({
          selection: { type: "feed", feedId: "feed-1" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "all",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.articles).toBeUndefined();
  });

  it("does not adopt stale account feeds or account articles for a newly selected account", () => {
    const staleAccountArticleCount = 2_000;
    useFeedsMock.mockReturnValue({
      data: createMatrixFeeds().filter((feed) => feed.account_id === "acc-2"),
    });
    useAccountArticlesMock.mockReturnValue({
      data: Array.from({ length: staleAccountArticleCount }, (_, index) =>
        matrixArticle(`stale-account-result-${index}`, "feed-other-account", false, false),
      ),
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useArticleListSources({
          selection: { type: "all" },
          selectedAccountId: "acc-1",
          selectedArticleId: null,
          retainedArticleIds: new Set(),
          viewMode: "all",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.feeds).toEqual([]);
    expect(result.current.accountArticles).toEqual([]);
    expect(result.current.accountArticles).toHaveLength(0);
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

  it("keeps the previous feed source while a refetch reports an empty loading result", () => {
    let currentArticles = [sampleArticles[0], sampleArticles[1]];
    let isLoading = false;
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { mode?: ViewMode }) => ({
      data: options?.mode === "unread" ? currentArticles : [sampleArticles[0], sampleArticles[1]],
      isLoading,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "feed", feedId: "feed-1" },
      selectedAccountId: "acc-1",
      selectedArticleId: "art-2",
      retainedArticleIds: new Set(),
      viewMode: "unread",
    };

    const { result, rerender } = renderHook(() => useArticleListSources(props), {
      wrapper: createWrapper(),
    });

    expect(result.current.articles?.map((article) => article.id)).toEqual(["art-1", "art-2"]);

    currentArticles = [];
    isLoading = true;
    rerender();

    expect(result.current.articles?.map((article) => article.id)).toEqual(["art-1", "art-2"]);
    expect(result.current.isLoadingFeedArticles).toBe(false);

    isLoading = false;
    rerender();

    expect(result.current.articles).toEqual([]);
  });

  it("keeps previously retained feed articles when another retained article remains selected", () => {
    let currentArticles = [sampleArticles[0], { ...sampleArticles[1], id: "art-3", is_read: false, is_starred: false }];
    useArticlesMock.mockImplementation((_feedId: string | null, options?: { mode?: ViewMode }) => ({
      data:
        options?.mode === "unread"
          ? currentArticles
          : [
              sampleArticles[0],
              {
                ...sampleArticles[1],
                id: "art-3",
                is_read: false,
                is_starred: false,
              },
            ],
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

  it("refreshes a retained folder article read state from the all-mode folder source after it leaves the unread source", () => {
    const folderFeeds = createMatrixFeeds().filter((feed) => feed.account_id === "acc-1");
    useFeedsMock.mockReturnValue({ data: folderFeeds });
    useFoldersMock.mockReturnValue({ data: createMatrixFolders() });

    const unreadArticle = matrixArticle("matrix-4", "feed-2", false, false);
    const readArticle = { ...unreadArticle, is_read: true };
    let currentUnreadFolderArticles: ArticleDto[] = [unreadArticle];
    let currentAllFolderArticles: ArticleDto[] = [unreadArticle];
    useFolderArticlesMock.mockImplementation((folderId: string | null, options?: { mode?: ViewMode }) => ({
      data: folderId ? (options?.mode === "all" ? currentAllFolderArticles : currentUnreadFolderArticles) : undefined,
      isLoading: false,
    }));

    const props: Parameters<typeof useArticleListSources>[0] = {
      selection: { type: "folder", folderId: "folder-1" },
      selectedAccountId: "acc-1",
      selectedArticleId: "matrix-4",
      retainedArticleIds: new Set(["matrix-4"]),
      viewMode: "unread",
    };

    const { result, rerender } = renderHook(() => useArticleListSources(props), {
      wrapper: createWrapper(),
    });

    expect(result.current.accountArticles?.map((article) => article.id)).toEqual(["matrix-4"]);
    expect(result.current.accountArticles?.[0]?.is_read).toBe(false);

    // Simulate the auto-mark read patch: the article leaves the unread folder
    // source but stays in the all-mode folder source with is_read: true.
    currentUnreadFolderArticles = [];
    currentAllFolderArticles = [readArticle];
    rerender();

    expect(result.current.accountArticles?.map((article) => article.id)).toEqual(["matrix-4"]);
    expect(result.current.accountArticles?.[0]?.is_read).toBe(true);
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
