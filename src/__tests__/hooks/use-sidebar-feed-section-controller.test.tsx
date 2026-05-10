import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { sampleFeeds, sampleFolders } from "@tests/helpers/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarFeedSectionController } from "@/components/reader/hooks/sidebar/use-sidebar-feed-section-controller";
import type { SidebarFeedSectionParams } from "@/components/reader/sidebar-feed-section.types";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const openFeedLandingMock = vi.fn();

vi.mock("@/hooks/use-feed-landing", () => ({
  useFeedLanding: () => openFeedLandingMock,
}));

vi.mock("@/hooks/use-articles", () => ({
  useMarkFeedRead: () => ({ mutate: vi.fn() }),
  useMarkFolderRead: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/hooks/use-confirm-mark-all-read", () => ({
  useConfirmMarkAllRead: () => vi.fn(),
}));

function createControllerParams(overrides: Partial<SidebarFeedSectionParams> = {}): SidebarFeedSectionParams {
  return {
    selectedAccountId: "acc-1",
    feeds: [sampleFeeds[0]],
    folders: [{ ...sampleFolders[0], account_id: "acc-1" }],
    starredCountByFeedId: new Map(),
    selection: { type: "all" },
    viewMode: "all",
    expandedFolderIds: new Set(),
    sortSubscriptions: "folders_first",
    grayscaleFavicons: false,
    isFeedsSectionOpen: true,
    startupFolderExpansion: "restore_previous",
    sidebarDensity: "normal",
    showSidebarUnread: true,
    showSidebarStarred: true,
    showSidebarRecentArticles: true,
    showSidebarTags: true,
    tags: [],
    setExpandedFolders: vi.fn(),
    selectFeed: vi.fn(),
    selectFolder: vi.fn(),
    selectAll: vi.fn(),
    selectSmartView: vi.fn(),
    setViewMode: vi.fn(),
    toggleFolder: vi.fn(),
    displayFavicons: true,
    moveFeedToFolder: vi.fn(async () => undefined),
    moveFeedToUnfoldered: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("useSidebarFeedSectionController", () => {
  beforeEach(() => {
    openFeedLandingMock.mockReset();
    usePreferencesStore.setState({
      prefs: { open_first_article_on_feed_selection: "false" },
      loaded: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces open-first-article landing failures without falling back to plain feed selection", async () => {
    const showToast = vi.fn();
    const selectFeed = vi.fn();
    const landingFailure = {
      type: "feed_not_found" as const,
      feedId: "feed-1",
    };
    openFeedLandingMock.mockResolvedValue(Result.fail(landingFailure));
    usePreferencesStore.setState({
      prefs: { open_first_article_on_feed_selection: "true" },
      loaded: true,
    });
    useUiStore.setState({ showToast });

    const { result } = renderHook(() => useSidebarFeedSectionController(createControllerParams({ selectFeed })));

    act(() => {
      result.current.feedTreeProps.onSelectFeed("feed-1");
    });

    expect(openFeedLandingMock).toHaveBeenCalledWith("feed-1");
    expect(selectFeed).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Feed not found.");
    });
  });

  it("keeps starred tree feed selection local to the sidebar and does not run open-first landing", () => {
    const selectFeed = vi.fn();
    openFeedLandingMock.mockResolvedValue(Result.succeed({ type: "feed_selected", feedId: "feed-1", articleId: null }));
    usePreferencesStore.setState({
      prefs: { open_first_article_on_feed_selection: "true" },
      loaded: true,
    });

    const { result } = renderHook(() =>
      useSidebarFeedSectionController(
        createControllerParams({
          selectFeed,
          selection: { type: "smart", kind: "starred" },
          viewMode: "all",
        }),
      ),
    );

    act(() => {
      result.current.feedTreeProps.onSelectFeed("feed-1");
    });

    expect(selectFeed).toHaveBeenCalledWith("feed-1");
    expect(openFeedLandingMock).not.toHaveBeenCalled();
  });

  it("waits for loading feeds before falling back from a hidden smart view to the first feed", () => {
    const selectAll = vi.fn();
    const selectFeed = vi.fn();
    const params = createControllerParams({
      feeds: undefined,
      folders: undefined,
      selection: { type: "smart", kind: "unread" },
      showSidebarUnread: false,
      selectAll,
      selectFeed,
    });

    const { rerender } = renderHook((currentParams) => useSidebarFeedSectionController(currentParams), {
      initialProps: params,
    });

    expect(selectAll).not.toHaveBeenCalled();
    expect(selectFeed).not.toHaveBeenCalled();

    rerender({
      ...params,
      feeds: [sampleFeeds[0]],
      folders: [{ ...sampleFolders[0], account_id: "acc-1" }],
    });

    expect(selectFeed).toHaveBeenCalledWith(sampleFeeds[0].id);
    expect(selectAll).not.toHaveBeenCalled();
  });
});
