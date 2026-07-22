import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createHookDataResult } from "@tests/helpers/typed-test-factories";
import { SettingsIcon } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaletteAction } from "@/components/reader/command-palette.types";
import { useCommandPaletteData } from "@/components/reader/hooks/command-palette/use-command-palette-data";
import { STORAGE_KEYS } from "@/constants/storage";
import { useRecentArticles, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useTags } from "@/hooks/use-tags";
import { sampleArticles, sampleFeeds, sampleFolders, sampleTags } from "../../../tests/helpers/fixtures";

vi.mock("@/hooks/use-articles", () => ({
  useRecentArticles: vi.fn(),
  useSearchArticles: vi.fn(),
}));

vi.mock("@/hooks/use-feeds", () => ({
  useFeeds: vi.fn(),
}));

vi.mock("@/hooks/use-folders", () => ({
  useFolders: vi.fn(),
}));

vi.mock("@/hooks/use-tags", () => ({
  useTags: vi.fn(),
}));

const action: PaletteAction = {
  id: "open-settings",
  label: "Open Settings",
  icon: SettingsIcon,
  keywords: ["settings"],
};

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

describe("useCommandPaletteData", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useFeeds).mockReturnValue(createHookDataResult<ReturnType<typeof useFeeds>>(sampleFeeds));
    vi.mocked(useFolders).mockReturnValue(createHookDataResult<ReturnType<typeof useFolders>>(sampleFolders));
    vi.mocked(useTags).mockReturnValue(createHookDataResult<ReturnType<typeof useTags>>(sampleTags));
    vi.mocked(useSearchArticles).mockReturnValue(createHookDataResult<ReturnType<typeof useSearchArticles>>([]));
    vi.mocked(useRecentArticles).mockReturnValue(
      createHookDataResult<ReturnType<typeof useRecentArticles>>(sampleArticles),
    );
  });

  it("projects only existing feed, tag, and article targets into recent resources", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify([
        "feed:feed-1",
        "folder:folder-1",
        "tag:tag-1",
        "article:art-1",
        "action:open-settings",
        "feed:missing",
        "folder:missing",
      ]),
    );

    const { result } = renderHook(() =>
      useCommandPaletteData({
        actions: [action],
        deferredQuery: "",
        devScenarios: [],
        prefix: null,
        query: "",
        selectedAccountId: "acc-1",
      }),
    );

    expect(result.current.recentFeeds.map((feed) => feed.id)).toEqual(["feed-1"]);
    expect(result.current.recentFolders.map((folder) => folder.id)).toEqual(["folder-1"]);
    expect(result.current.recentTags.map((tag) => tag.id)).toEqual(["tag-1"]);
    expect(result.current.recentArticles.map((article) => article.id)).toEqual(["art-1"]);
    expect(result.current.recentActions.map((recentAction) => recentAction.id)).toEqual(["open-settings"]);
    expect(result.current.showRecentResources).toBe(true);
    expect(result.current.hasVisibleResults).toBe(true);
  });

  it("treats command history resource ids as scoped by the current account resource projection", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify(["feed:feed-2", "feed:feed-1", "article:art-2", "article:art-1"]),
    );
    vi.mocked(useFeeds).mockReturnValue(createHookDataResult<ReturnType<typeof useFeeds>>([sampleFeeds[0]]));
    vi.mocked(useRecentArticles).mockReturnValue(
      createHookDataResult<ReturnType<typeof useRecentArticles>>([sampleArticles[0]]),
    );

    const { result } = renderHook(() =>
      useCommandPaletteData({
        actions: [action],
        deferredQuery: "",
        devScenarios: [],
        prefix: null,
        query: "",
        selectedAccountId: "acc-1",
      }),
    );

    expect(result.current.recentFeeds.map((feed) => feed.id)).toEqual(["feed-1"]);
    expect(result.current.recentArticles.map((article) => article.id)).toEqual(["art-1"]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(["feed:feed-1", "article:art-1"]));
  });

  it("drops search and recent article candidates whose feeds are not in the current account snapshot", () => {
    const staleArticle = { ...sampleArticles[1], id: "stale-article", feed_id: "feed-from-previous-account" };
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["article:stale-article", "article:art-1"]));
    vi.mocked(useFeeds).mockReturnValue(createHookDataResult<ReturnType<typeof useFeeds>>([sampleFeeds[0]]));
    vi.mocked(useSearchArticles).mockReturnValue(
      createHookDataResult<ReturnType<typeof useSearchArticles>>([staleArticle, sampleArticles[0]]),
    );
    vi.mocked(useRecentArticles).mockReturnValue(
      createHookDataResult<ReturnType<typeof useRecentArticles>>([staleArticle, sampleArticles[0]]),
    );

    const { result } = renderHook(() =>
      useCommandPaletteData({
        actions: [action],
        deferredQuery: "article",
        devScenarios: [],
        prefix: null,
        query: "article",
        selectedAccountId: "acc-1",
      }),
    );

    expect(result.current.articles.map((article) => article.id)).toEqual(["art-1"]);
    expect(result.current.recentArticles.map((article) => article.id)).toEqual(["art-1"]);
    expect(result.current.selectableArticleFeedIds.has("feed-1")).toBe(true);
    expect(result.current.selectableArticleFeedIds.has("feed-from-previous-account")).toBe(false);
    expect(result.current.selectableArticleIds.has("art-1")).toBe(true);
    expect(result.current.selectableArticleIds.has("stale-article")).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(["article:art-1"]));
  });

  it("keeps recent resources hidden once the user enters a query or resource prefix", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["feed:feed-1", "tag:tag-1", "article:art-1"]));

    const queried = renderHook(() =>
      useCommandPaletteData({
        actions: [action],
        deferredQuery: "tech",
        devScenarios: [],
        prefix: null,
        query: "tech",
        selectedAccountId: "acc-1",
      }),
    );
    const prefixed = renderHook(() =>
      useCommandPaletteData({
        actions: [action],
        deferredQuery: "",
        devScenarios: [],
        prefix: "@",
        query: "",
        selectedAccountId: "acc-1",
      }),
    );

    expect(queried.result.current.showRecentResources).toBe(false);
    expect(prefixed.result.current.showRecentResources).toBe(false);
  });

  it("shows folders alongside feeds for the @ prefix", () => {
    const prefixed = renderHook(() =>
      useCommandPaletteData({
        actions: [],
        deferredQuery: "",
        devScenarios: [],
        prefix: "@",
        query: "",
        selectedAccountId: "acc-1",
      }),
    );

    expect(prefixed.result.current.showFeeds).toBe(true);
    expect(prefixed.result.current.showFolders).toBe(true);
  });
});
