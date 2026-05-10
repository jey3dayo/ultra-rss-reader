import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSidebarController } from "@/components/reader/hooks/sidebar/use-sidebar-controller";
import type { SidebarRuntimeResult } from "@/components/reader/sidebar-runtime.types";

const {
  closeAccountListMock,
  focusSelectedAccountPaneTargetMock,
  openAccountPaneMock,
  runtimeState,
  toggleAccountListMock,
} = vi.hoisted(() => ({
  closeAccountListMock: vi.fn(),
  focusSelectedAccountPaneTargetMock: vi.fn(),
  openAccountPaneMock: vi.fn(),
  runtimeState: {
    value: null as SidebarRuntimeResult | null,
  },
  toggleAccountListMock: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/use-update-feed-folder", () => ({
  useUpdateFeedFolder: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/stores/ui-store", () => ({
  useUiStore: {
    getState: () => ({ openAccountPane: openAccountPaneMock }),
  },
}));

vi.mock("@/lib/reader-focus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reader-focus")>();
  return {
    ...actual,
    focusSelectedAccountPaneTarget: focusSelectedAccountPaneTargetMock,
  };
});

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-runtime", () => ({
  useSidebarRuntime: () => {
    if (!runtimeState.value) {
      throw new Error("Sidebar runtime state was not configured.");
    }
    return runtimeState.value;
  },
}));

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-controller-sections", () => ({
  useSidebarControllerSections: ({ focusAccountList }: { focusAccountList: () => void }) => ({
    headerProps: {},
    accountSectionProps: {},
    smartViewsProps: {},
    contentSectionsProps: {
      onFocusAccountList: focusAccountList,
    },
  }),
}));

function createRuntime(overrides: Partial<SidebarRuntimeResult> = {}): SidebarRuntimeResult {
  const runtime: SidebarRuntimeResult = {
    isFeedsSectionOpen: true,
    setIsFeedsSectionOpen: vi.fn(),
    isTagsSectionOpen: true,
    setIsTagsSectionOpen: vi.fn(),
    isAccountListOpen: false,
    accountDropdownRef: createRef<HTMLDivElement | null>(),
    accountTriggerRef: createRef<HTMLButtonElement | null>(),
    accountItemRefs: { current: [] },
    accountMenuId: "account-menu",
    closeAccountList: closeAccountListMock,
    toggleAccountList: toggleAccountListMock,
    layoutMode: "wide",
    focusedPane: "sidebar",
    selectedAccountId: "account-1",
    selectAccount: vi.fn(),
    restoreAccountSelection: vi.fn(),
    clearSelectedAccount: vi.fn(),
    selection: { type: "all" },
    viewMode: "all",
    selectFeed: vi.fn(),
    selectFeedFromCurrentContext: vi.fn(),
    selectFolder: vi.fn(),
    selectFolderFromCurrentContext: vi.fn(),
    selectAll: vi.fn(),
    selectSmartView: vi.fn(),
    selectTag: vi.fn(),
    selectTagFromCurrentContext: vi.fn(),
    setViewMode: vi.fn(),
    expandedFolderIds: new Set(),
    setExpandedFolders: vi.fn(),
    toggleFolder: vi.fn(),
    openSettings: vi.fn(),
    openSubscriptionsIndex: vi.fn(),
    isAddFeedDialogOpen: false,
    openAddFeedDialog: vi.fn(),
    closeAddFeedDialog: vi.fn(),
    openSettingsAccount: vi.fn(),
    openSettingsAddAccount: vi.fn(),
    syncProgress: {
      active: false,
      kind: null,
      stage: null,
      total: 0,
      completed: 0,
      currentAccountName: null,
      activeAccountIds: new Set(),
    },
    applySyncProgress: vi.fn(),
    clearSyncProgress: vi.fn(),
    showToast: vi.fn(),
    showUnreadCount: true,
    showStarredCount: true,
    showSidebarUnread: true,
    showSidebarStarred: true,
    showSidebarRecentArticles: true,
    showSidebarTags: true,
    displayFavicons: true,
    grayscaleFavicons: false,
    sortSubscriptions: "folders_first",
    startupFolderExpansion: "restore_previous",
    sidebarDensity: "normal",
    opaqueSidebars: false,
    savedAccountId: "",
    preferencesLoaded: true,
    setPref: vi.fn(),
    accounts: [
      {
        id: "account-1",
        name: "Account",
        kind: "local",
        display_name: undefined,
        server_url: null,
        username: null,
        sync_interval_secs: 3600,
        sync_on_startup: false,
        sync_on_wake: false,
        keep_read_items_days: 30,
      },
    ],
    accountStatusLabels: {},
    selectedAccount: {
      id: "account-1",
      name: "Account",
      kind: "local",
      display_name: undefined,
      server_url: null,
      username: null,
      sync_interval_secs: 3600,
      sync_on_startup: false,
      sync_on_wake: false,
      keep_read_items_days: 30,
    },
    accountArticles: [],
    feeds: [],
    feedList: [],
    folders: [],
    folderList: [],
    starredCountByFeedId: new Map(),
    isFeedTreeLoading: false,
    showFeedTreeSkeleton: false,
    tags: [],
    tagArticleCounts: {},
    totalUnread: 0,
    starredCount: 0,
    feedViewportRef: createRef<HTMLDivElement | null>(),
    activeDevIntent: null,
    handleSync: vi.fn(),
    lastSyncedLabel: "synced",
    syncTooltipLabel: null,
    isSyncCoolingDown: false,
    isSyncDisabled: false,
  };
  Object.assign(runtime, overrides);
  return runtime;
}

describe("useSidebarController", () => {
  afterEach(() => {
    runtimeState.value = null;
    vi.restoreAllMocks();
    focusSelectedAccountPaneTargetMock.mockReset();
    openAccountPaneMock.mockReset();
    closeAccountListMock.mockReset();
    toggleAccountListMock.mockReset();
  });

  it("cancels a pending wide account pane focus request when a newer request supersedes it", () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    runtimeState.value = createRuntime();

    const { result } = renderHook(() => useSidebarController());

    act(() => {
      result.current.contentSectionsProps.onFocusAccountList();
      result.current.contentSectionsProps.onFocusAccountList();
    });

    act(() => {
      frameCallbacks[0]?.(0);
    });
    expect(focusSelectedAccountPaneTargetMock).not.toHaveBeenCalled();

    act(() => {
      frameCallbacks[1]?.(0);
    });
    expect(focusSelectedAccountPaneTargetMock).toHaveBeenCalledTimes(1);
  });

  it("cleans up a pending wide account pane focus request on unmount", () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    runtimeState.value = createRuntime();

    const { result, unmount } = renderHook(() => useSidebarController());

    act(() => {
      result.current.contentSectionsProps.onFocusAccountList();
    });
    unmount();

    act(() => {
      frameCallbacks[0]?.(0);
    });

    expect(focusSelectedAccountPaneTargetMock).not.toHaveBeenCalled();
  });
});
