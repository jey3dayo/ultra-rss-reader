import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleViewSelection } from "@/components/reader/hooks/article/use-article-view-selection";
import { useUiStore } from "@/stores/ui-store";

const {
  useAccountsMock,
  useArticleListDataMock,
  useArticleListSourcesMock,
  useArticlesMock,
  useFoldersMock,
  useTagsMock,
} = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useArticleListDataMock: vi.fn(),
  useArticleListSourcesMock: vi.fn(),
  useArticlesMock: vi.fn(),
  useFoldersMock: vi.fn(),
  useTagsMock: vi.fn(),
}));

vi.mock("@/hooks/use-accounts", () => ({
  useAccounts: useAccountsMock,
}));

vi.mock("@/hooks/use-articles", () => ({
  useArticles: useArticlesMock,
}));

vi.mock("@/hooks/use-folders", () => ({
  useFolders: useFoldersMock,
}));

vi.mock("@/hooks/use-tags", () => ({
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
});
