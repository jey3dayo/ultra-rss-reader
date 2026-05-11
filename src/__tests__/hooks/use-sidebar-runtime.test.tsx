import { act, renderHook } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarRuntime } from "@/components/reader/hooks/sidebar/use-sidebar-runtime";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/dev/use-resolved-dev-intent", () => ({
  useResolvedDevIntent: () => ({ intent: null }),
}));

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-account-switcher", () => ({
  useSidebarAccountSwitcher: () => ({
    isAccountListOpen: false,
    accountDropdownRef: { current: null },
    accountTriggerRef: { current: null },
    accountItemRefs: { current: [] },
    accountMenuId: "account-menu",
    closeAccountList: vi.fn(),
    toggleAccountList: vi.fn(),
  }),
}));

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-sources", () => ({
  useSidebarSources: () => ({
    accounts: [],
    accountStatusLabels: {},
    selectedAccount: null,
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
  }),
}));

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-sync", () => ({
  useSidebarSync: () => ({
    handleSync: vi.fn(),
    lastSyncedLabel: "",
    syncTooltipLabel: null,
    isSyncCoolingDown: false,
    isSyncDisabled: false,
  }),
}));

describe("useSidebarRuntime", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("keeps feed and tag section collapse state across sidebar remounts", () => {
    const { result, unmount } = renderHook(() => useSidebarRuntime(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setIsFeedsSectionOpen(false);
      result.current.setIsTagsSectionOpen((current) => !current);
    });

    expect(result.current.isFeedsSectionOpen).toBe(false);
    expect(result.current.isTagsSectionOpen).toBe(false);

    unmount();

    const remounted = renderHook(() => useSidebarRuntime(), {
      wrapper: createWrapper(),
    });

    expect(remounted.result.current.isFeedsSectionOpen).toBe(false);
    expect(remounted.result.current.isTagsSectionOpen).toBe(false);
  });
});
