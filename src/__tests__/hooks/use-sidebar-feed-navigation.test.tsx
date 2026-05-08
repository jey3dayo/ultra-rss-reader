import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSidebarFeedNavigation } from "@/components/reader/hooks/sidebar/use-sidebar-feed-navigation";
import { APP_EVENTS } from "@/constants/events";

describe("useSidebarFeedNavigation", () => {
  it("keeps prior same-tick folder expansions when keyboard navigation repeats before state rerenders", () => {
    const setExpandedFolders = vi.fn();
    const selectFeed = vi.fn();
    const getFeedFolderId = vi.fn((feedId: string) => {
      return { feed2: "folder-a", feed3: "folder-b" }[feedId] ?? null;
    });
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    const { unmount } = renderHook(() =>
      useSidebarFeedNavigation({
        orderedFeedIds: ["feed1", "feed2", "feed3"],
        selectedFeedId: "feed1",
        expandedFolderIds: new Set(),
        getFeedFolderId,
        setExpandedFolders,
        selectFeed,
      }),
    );

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }));

    expect(setExpandedFolders).toHaveBeenCalledOnce();
    expect(setExpandedFolders).toHaveBeenCalledWith(new Set(["folder-a"]));
    expect(selectFeed).toHaveBeenNthCalledWith(1, "feed2");
    expect(selectFeed).toHaveBeenNthCalledWith(2, "feed2");

    unmount();
    requestAnimationFrameSpy.mockRestore();
  });
});
