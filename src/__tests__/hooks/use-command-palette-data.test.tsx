import { renderHook } from "@testing-library/react";
import { createHookDataResult } from "@tests/helpers/typed-test-factories";
import { SettingsIcon } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaletteAction } from "@/components/reader/command-palette.types";
import { useCommandPaletteData } from "@/components/reader/hooks/command-palette/use-command-palette-data";
import { STORAGE_KEYS } from "@/constants/storage";
import { useRecentArticles, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import { sampleArticles, sampleFeeds, sampleTags } from "../../../tests/helpers/fixtures";

vi.mock("@/hooks/use-articles", () => ({
  useRecentArticles: vi.fn(),
  useSearchArticles: vi.fn(),
}));

vi.mock("@/hooks/use-feeds", () => ({
  useFeeds: vi.fn(),
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

describe("useCommandPaletteData", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useFeeds).mockReturnValue(createHookDataResult<ReturnType<typeof useFeeds>>(sampleFeeds));
    vi.mocked(useTags).mockReturnValue(createHookDataResult<ReturnType<typeof useTags>>(sampleTags));
    vi.mocked(useSearchArticles).mockReturnValue(createHookDataResult<ReturnType<typeof useSearchArticles>>([]));
    vi.mocked(useRecentArticles).mockReturnValue(
      createHookDataResult<ReturnType<typeof useRecentArticles>>(sampleArticles),
    );
  });

  it("projects only existing feed, tag, and article targets into recent resources", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify(["feed:feed-1", "tag:tag-1", "article:art-1", "action:open-settings", "feed:missing"]),
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
    expect(result.current.recentTags.map((tag) => tag.id)).toEqual(["tag-1"]);
    expect(result.current.recentArticles.map((article) => article.id)).toEqual(["art-1"]);
    expect(result.current.recentActions.map((recentAction) => recentAction.id)).toEqual(["open-settings"]);
    expect(result.current.showRecentResources).toBe(true);
    expect(result.current.hasVisibleResults).toBe(true);
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
});
