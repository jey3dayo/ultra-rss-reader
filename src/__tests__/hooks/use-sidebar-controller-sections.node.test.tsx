import { renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleAccounts, sampleFeeds, sampleFolders } from "@tests/helpers/fixtures";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSidebarControllerSections } from "@/components/reader/hooks/sidebar/use-sidebar-controller-sections";
import type { SidebarControllerSectionsParams } from "@/components/reader/sidebar.types";

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-feed-section-controller", () => ({
  useSidebarFeedSectionController: () => ({ feedTreeProps: {} }),
}));

setupBrowserTestDom();

function createSectionsParams(
  overrides: Partial<SidebarControllerSectionsParams> = {},
): SidebarControllerSectionsParams {
  return {
    t: ((key: string) => key) as SidebarControllerSectionsParams["t"],
    selectedAccountId: "acc-1",
    feeds: [],
    folders: [],
    starredCountByFeedId: new Map(),
    isFeedTreeLoading: false,
    showFeedTreeSkeleton: false,
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
    setExpandedFolders: vi.fn(),
    selectFeedFromCurrentContext: vi.fn(),
    selectFolderFromCurrentContext: vi.fn(),
    selectAll: vi.fn(),
    selectSmartView: vi.fn(),
    selectTagFromCurrentContext: vi.fn(),
    setViewMode: vi.fn(),
    toggleFolder: vi.fn(),
    displayFavicons: true,
    accounts: sampleAccounts,
    accountStatusLabels: {},
    selectedAccount: sampleAccounts[0],
    isAccountListOpen: false,
    accountMenuId: "account-menu",
    accountDropdownRef: createRef<HTMLDivElement | null>(),
    accountTriggerRef: createRef<HTMLButtonElement | null>(),
    accountItemRefs: { current: [] },
    handleSelectAccount: vi.fn(),
    closeAccountList: vi.fn(),
    focusAccountList: vi.fn(),
    syncProgress: { active: false, kind: null },
    handleSync: vi.fn(),
    syncTooltipLabel: null,
    isSyncCoolingDown: false,
    isSyncDisabled: false,
    handleAddFeed: vi.fn(),
    toggleFeedsSection: vi.fn(),
    lastSyncedLabel: "Today",
    totalUnread: 0,
    starredCount: 0,
    showUnreadCount: true,
    showStarredCount: true,
    feedViewportRef: createRef<HTMLDivElement | null>(),
    openSubscriptionsIndex: vi.fn(),
    handleOpenSettings: vi.fn(),
    handleOpenTagSettings: vi.fn(),
    isAddFeedDialogOpen: false,
    handleAddFeedDialogOpenChange: vi.fn(),
    isTagsSectionOpen: true,
    toggleTagsSection: vi.fn(),
    handleOpenAccountSettings: vi.fn(),
    tags: [],
    tagArticleCounts: {},
    moveFeedToFolder: vi.fn(async () => undefined),
    moveFeedToUnfoldered: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("useSidebarControllerSections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the account focus action for both account navigation entry points", () => {
    const focusAccountList = vi.fn();
    const params = createSectionsParams({ focusAccountList });
    const { result } = renderHook(() => useSidebarControllerSections(params), {
      wrapper: createQueryWrapper().wrapper,
    });

    result.current.accountSectionProps.onToggle();
    expect(focusAccountList).toHaveBeenCalled();

    focusAccountList.mockClear();
    result.current.contentSectionsProps.onFocusAccountList();
    expect(focusAccountList).toHaveBeenCalled();
    expect(result.current.accountSectionProps.title).toBe(sampleAccounts[0]?.name);
  });

  it("preserves the empty account fallback and pending feed state", () => {
    const selectTagFromCurrentContext = vi.fn();
    const params = createSectionsParams({
      accounts: undefined,
      selectedAccount: undefined,
      selectedAccountId: null,
      isFeedTreeLoading: true,
      showFeedTreeSkeleton: true,
      sidebarDensity: "compact",
      selectTagFromCurrentContext,
    });
    const { result } = renderHook(() => useSidebarControllerSections(params), {
      wrapper: createQueryWrapper().wrapper,
    });

    expect(result.current.accountSectionProps.accounts).toEqual([]);
    expect(result.current.accountSectionProps.title).toBe("app_name");
    expect(result.current.contentSectionsProps.feedTree).toMatchObject({
      isLoading: true,
      showSkeleton: true,
    });
    expect(result.current.contentSectionsProps.sidebarDensity).toBe("compact");
    expect(result.current.contentSectionsProps.addFeedDialog.accountId).toBeNull();
    result.current.contentSectionsProps.tagSection.onSelectTag("tag-1");
    expect(selectTagFromCurrentContext).toHaveBeenCalledWith("tag-1");
  });

  it("opens only folders with unread feeds when selecting the unread smart view", () => {
    const setExpandedFolders = vi.fn();
    const selectSmartView = vi.fn();
    const unreadFolder = {
      ...sampleFolders[0],
      id: "folder-unread",
      account_id: "acc-1",
    };
    const readFolder = {
      ...sampleFolders[1],
      id: "folder-read",
      account_id: "acc-1",
    };

    const { result } = renderHook(
      () =>
        useSidebarControllerSections(
          createSectionsParams({
            feeds: [
              {
                ...sampleFeeds[0],
                id: "feed-unread",
                folder_id: "folder-unread",
                unread_count: 3,
              },
              {
                ...sampleFeeds[1],
                id: "feed-read",
                folder_id: "folder-read",
                unread_count: 0,
              },
              {
                ...sampleFeeds[2],
                id: "feed-unfoldered",
                folder_id: null,
                unread_count: 5,
              },
            ],
            folders: [unreadFolder, readFolder],
            setExpandedFolders,
            selectSmartView,
          }),
        ),
      // The sidebar header reads the feed-list fetching state from React Query
      // (see useSidebarHeaderProps), so this hook needs a query client.
      { wrapper: createQueryWrapper().wrapper },
    );

    result.current.smartViewsProps.onSelectSmartView("unread");

    expect(setExpandedFolders).toHaveBeenCalledWith(new Set(["folder-unread"]));
    expect(selectSmartView).toHaveBeenCalledWith("unread");
  });
});
