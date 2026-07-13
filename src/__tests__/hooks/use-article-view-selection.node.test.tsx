import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleArticles, sampleFeeds, sampleFolders } from "@tests/helpers/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleViewSelection } from "@/components/reader/hooks/article/use-article-view-selection";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

const {
  useAccountsMock,
  useArticleMock,
  useArticleListDataMock,
  useArticleListSourcesMock,
  useArticlesMock,
  useFolderArticlesMock,
  useFoldersMock,
  useArticlesByTagMock,
  useTagsMock,
  useRecentArticlesMock,
} = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useArticleMock: vi.fn(),
  useArticleListDataMock: vi.fn(),
  useArticleListSourcesMock: vi.fn(),
  useArticlesMock: vi.fn(),
  useFolderArticlesMock: vi.fn(),
  useFoldersMock: vi.fn(),
  useArticlesByTagMock: vi.fn(),
  useTagsMock: vi.fn(),
  useRecentArticlesMock: vi.fn(),
}));

vi.mock("@/hooks/use-accounts", () => ({
  useAccounts: useAccountsMock,
}));

vi.mock("@/hooks/use-articles", () => ({
  useArticle: useArticleMock,
  useArticles: useArticlesMock,
  useFolderArticles: useFolderArticlesMock,
  useRecentArticles: useRecentArticlesMock,
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
    useArticleMock.mockReturnValue({ data: undefined });
    useFolderArticlesMock.mockReturnValue({ data: [] });
    useArticlesByTagMock.mockReturnValue({ data: [] });
    useRecentArticlesMock.mockReturnValue({ data: [] });
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

  it("keeps the article view when the by-id fetch resolves even in browser mode", () => {
    const browserResolvedArticle = {
      ...sampleArticles[0],
      id: "browser-mode-article",
      feed_id: "feed-1",
    };

    useUiStore.setState({
      contentMode: "browser",
      browserUrl: "https://example.com/x",
      selectedArticleId: "browser-mode-article",
      selection: { type: "all" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "all",
    });
    // The list does not contain the selected article; only the by-id fetch resolves it.
    useArticleListDataMock.mockReturnValue({
      feedId: null,
      filteredArticles: [],
      tagId: null,
    });
    useArticleMock.mockReturnValue({ data: browserResolvedArticle, isPending: false });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({
      kind: "article",
      article: { id: "browser-mode-article" },
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

  it("uses the full selected article body when list rows are lightweight", () => {
    const listArticle = {
      ...sampleArticles[0],
      id: "selected-article",
      content_sanitized: "",
    };
    const fullArticle = {
      ...listArticle,
      content_sanitized: "<p>Full body</p>",
    };

    useUiStore.setState({
      contentMode: "reader",
      browserUrl: null,
      selectedArticleId: "selected-article",
      selection: { type: "all" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "all",
    });
    useArticleListDataMock.mockReturnValue({
      feedId: null,
      filteredArticles: [listArticle],
      tagId: null,
    });
    useArticleMock.mockReturnValue({ data: fullArticle });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({
      kind: "article",
      article: {
        id: "selected-article",
        content_sanitized: "<p>Full body</p>",
      },
    });
  });

  it("resolves a search-clicked article via the by-id fetch even when it is absent from the reconstructed list", () => {
    const searchOnlyArticle = {
      ...sampleArticles[0],
      id: "search-only-article",
      feed_id: "feed-1",
      content_sanitized: "<p>Search body</p>",
    };

    useUiStore.setState({
      contentMode: "reader",
      browserUrl: null,
      selectedArticleId: "search-only-article",
      selection: { type: "all" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "unread",
    });
    // The reconstructed (search-less) list does not include the clicked article.
    useArticleListDataMock.mockReturnValue({
      feedId: null,
      filteredArticles: [],
      tagId: null,
    });
    useArticleMock.mockReturnValue({ data: searchOnlyArticle, isPending: false });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({
      kind: "article",
      article: { id: "search-only-article", content_sanitized: "<p>Search body</p>" },
    });
  });

  it("reports hasNextArticle true when a later article exists in the filtered list", () => {
    const currentArticle = { ...sampleArticles[0], id: "selected-article" };
    const nextArticle = { ...sampleArticles[0], id: "next-article" };

    useUiStore.setState({
      contentMode: "reader",
      browserUrl: null,
      selectedArticleId: "selected-article",
      selection: { type: "all" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "all",
    });
    useArticleListDataMock.mockReturnValue({
      feedId: null,
      filteredArticles: [currentArticle, nextArticle],
      tagId: null,
    });
    useArticleMock.mockReturnValue({ data: currentArticle });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({ kind: "article", hasNextArticle: true });
  });

  it("reports hasNextArticle false when the selected article is the last in the filtered list", () => {
    const currentArticle = { ...sampleArticles[0], id: "selected-article" };

    useUiStore.setState({
      contentMode: "reader",
      browserUrl: null,
      selectedArticleId: "selected-article",
      selection: { type: "all" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "all",
    });
    useArticleListDataMock.mockReturnValue({
      feedId: null,
      filteredArticles: [currentArticle],
      tagId: null,
    });
    useArticleMock.mockReturnValue({ data: currentArticle });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({ kind: "article", hasNextArticle: false });
  });

  it("returns loading instead of not-found while the by-id fetch for a list-absent article is pending", () => {
    setArticleViewState("reader", null);
    useArticleMock.mockReturnValue({ data: undefined, isPending: true });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toEqual({ kind: "loading" });
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

  it("keeps empty-state landing in reader mode when Web Preview was closed for the session", () => {
    const landingArticle = {
      ...sampleArticles[0],
      feed_id: "feed-1",
      url: "https://example.com/landing",
    };
    const previewFeed = {
      ...sampleFeeds[0],
      id: "feed-1",
      reader_mode: "on",
      web_preview_mode: "on",
    };

    useUiStore.setState({
      contentMode: "empty",
      browserUrl: null,
      selectedArticleId: null,
      selection: { type: "feed", feedId: "feed-1" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "unread",
      webPreviewSessionMode: "forced-off",
    });
    useArticleListSourcesMock.mockReturnValue({
      accountArticles: [],
      accountListScopeId: "acc-1",
      articles: [],
      feedId: "feed-1",
      feeds: [previewFeed],
      folderId: null,
      sourcePlan: { kind: "feed", mode: "unread" },
      tagArticles: [],
      tagId: null,
    });
    useArticleListDataMock.mockReturnValue({
      feedId: "feed-1",
      filteredArticles: [landingArticle],
      tagId: null,
    });
    useArticlesMock.mockReturnValue({ data: [landingArticle] });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({
      kind: "empty",
      landingCandidate: {
        article: { id: landingArticle.id },
        browserUrl: null,
      },
    });
  });

  it("keeps empty-state landing in Web Preview when Web Preview was opened for the session", () => {
    const landingArticle = {
      ...sampleArticles[0],
      feed_id: "feed-1",
      url: "https://example.com/landing",
    };
    const standardFeed = {
      ...sampleFeeds[0],
      id: "feed-1",
      reader_mode: "on",
      web_preview_mode: "off",
    };

    useUiStore.setState({
      contentMode: "empty",
      browserUrl: null,
      selectedArticleId: null,
      selection: { type: "feed", feedId: "feed-1" },
      subscriptionsWorkspace: null,
      selectedAccountId: "acc-1",
      retainedArticleIds: new Set(),
      viewMode: "unread",
      webPreviewSessionMode: "forced-on",
    });
    useArticleListSourcesMock.mockReturnValue({
      accountArticles: [],
      accountListScopeId: "acc-1",
      articles: [],
      feedId: "feed-1",
      feeds: [standardFeed],
      folderId: null,
      sourcePlan: { kind: "feed", mode: "unread" },
      tagArticles: [],
      tagId: null,
    });
    useArticleListDataMock.mockReturnValue({
      feedId: "feed-1",
      filteredArticles: [landingArticle],
      tagId: null,
    });
    useArticlesMock.mockReturnValue({ data: [landingArticle] });

    const { result } = renderHook(() => useArticleViewSelection());

    expect(result.current).toMatchObject({
      kind: "empty",
      landingCandidate: {
        article: { id: landingArticle.id },
        browserUrl: "https://example.com/landing",
      },
    });
  });

  it("builds empty folder summaries from all folder articles and feed unread totals", () => {
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
        unreadCount: 5,
        latestArticlePublishedAt: "2026-04-01T10:00:00Z",
      },
    });
  });
});
