import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleArticles, sampleFeeds, sampleFolders } from "@tests/helpers/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleViewSelection } from "@/components/reader/hooks/article/use-article-view-selection";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

const {
  useAccountsMock,
  useArticleListDataMock,
  useArticleListSourcesMock,
  useArticlesMock,
  useFolderArticlesMock,
  useFoldersMock,
  useArticlesByTagMock,
  useTagsMock,
} = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useArticleListDataMock: vi.fn(),
  useArticleListSourcesMock: vi.fn(),
  useArticlesMock: vi.fn(),
  useFolderArticlesMock: vi.fn(),
  useFoldersMock: vi.fn(),
  useArticlesByTagMock: vi.fn(),
  useTagsMock: vi.fn(),
}));

vi.mock("@/hooks/use-accounts", () => ({
  useAccounts: useAccountsMock,
}));

vi.mock("@/hooks/use-articles", () => ({
  useArticles: useArticlesMock,
  useFolderArticles: useFolderArticlesMock,
}));

vi.mock("@/hooks/use-folders", () => ({
  useFolders: useFoldersMock,
}));

vi.mock("@/hooks/use-tags", () => ({
  useArticlesByTag: useArticlesByTagMock,
  useTags: useTagsMock,
}));

vi.mock("@/components/reader/hooks/article-list/use-article-list-data", () => ({
  useArticleListData: useArticleListDataMock,
}));

vi.mock("@/components/reader/hooks/article-list/use-article-list-sources", () => ({
  useArticleListSources: useArticleListSourcesMock,
}));

function setArticleViewState(contentMode: "browser" | "reader", browserUrl: string | null) {
  useUiStore.setState({
    contentMode,
    browserUrl,
    selectedArticleId: "missing-article",
    selection: { type: "all" },
    subscriptionsWorkspace: null,
    selectedAccountId: "acc-1",
    retainedArticleIds: new Set(),
    viewMode: "all",
  });
}

describe("useArticleViewSelection", () => {
  beforeEach(() => {
    useAccountsMock.mockReturnValue({ data: [{ id: "acc-1" }] });
    useFoldersMock.mockReturnValue({ data: [] });
    useTagsMock.mockReturnValue({ data: [] });
    useArticlesMock.mockReturnValue({ data: [] });
    useFolderArticlesMock.mockReturnValue({ data: [] });
    useArticlesByTagMock.mockReturnValue({ data: [] });
    useArticleListSourcesMock.mockReturnValue({
      accountArticles: [],
      accountListScopeId: "acc-1",
      articles: [],
      feedId: null,
      feeds: [],
      folderId: null,
      sourcePlan: { kind: "account", mode: "all" },
      tagArticles: [],
      tagId: null,
    });
    useArticleListDataMock.mockReturnValue({
      feedId: null,
      filteredArticles: [],
      tagId: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useUiStore.setState({
      contentMode: "empty",
      browserUrl: null,
      selectedArticleId: null,
      selection: { type: "all" },
      subscriptionsWorkspace: null,
      selectedAccountId: null,
      retainedArticleIds: new Set(),
      viewMode: "unread",
    });
  });

  it("prefers browser-only fallback when browser mode has a URL and the selected article is missing", () => {
    setArticleViewState("browser", "https://example.com/article");

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toEqual({
      kind: "browser-only",
      browserUrl: "https://example.com/article",
    });
  });

  it("returns not-found when reader mode cannot resolve the selected article", () => {
    setArticleViewState("reader", "https://example.com/article");

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toEqual({ kind: "not-found" });
  });

  it("returns not-found when browser mode has no URL for the browser-only fallback", () => {
    setArticleViewState("browser", null);

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toEqual({ kind: "not-found" });
  });

  it("uses the account switch reset instead of surfacing a stale not-found state", () => {
    setArticleViewState("browser", "https://example.com/stale-article");

    useUiStore.getState().selectAccount("acc-2");

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toEqual({
      kind: "empty",
      emptyReason: "no-feeds",
      summary: undefined,
    });
  });

  it("builds empty folder summaries from all folder articles instead of visible filtered articles", () => {
    const visibleArticle = {
      ...sampleArticles[0],
      feed_id: "feed-1",
      is_read: false,
      published_at: "2026-03-01T10:00:00Z",
    };
    const hiddenLatestArticle = {
      ...sampleArticles[1],
      id: "hidden-folder-latest",
      feed_id: "feed-2",
      is_read: false,
      published_at: "2026-04-01T10:00:00Z",
    };
    const folderFeeds = sampleFeeds.slice(0, 2).map((feed) => ({
      ...feed,
      folder_id: "folder-1",
    }));

    useUiStore.setState({
      contentMode: "empty",
      browserUrl: null,
      selectedArticleId: null,
      selection: { type: "folder", folderId: "folder-1" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "unread",
    });
    useFoldersMock.mockReturnValue({
      data: [{ ...sampleFolders[0], id: "folder-1" }],
    });
    useArticleListSourcesMock.mockReturnValue({
      accountArticles: [],
      accountListScopeId: "acc-1",
      articles: [],
      feedId: null,
      feeds: folderFeeds,
      folderId: "folder-1",
      sourcePlan: { kind: "folder", mode: "unread" },
      tagArticles: [],
      tagId: null,
    });
    useArticleListDataMock.mockReturnValue({
      feedId: null,
      filteredArticles: [visibleArticle],
      tagId: null,
    });
    useFolderArticlesMock.mockReturnValue({
      data: [visibleArticle, hiddenLatestArticle],
    });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({
      kind: "empty",
      emptyReason: "default",
      summary: {
        kind: "folder",
        feedCount: 2,
        unreadCount: 2,
        latestArticlePublishedAt: "2026-04-01T10:00:00Z",
      },
    });
  });
});
