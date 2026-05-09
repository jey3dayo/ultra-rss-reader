import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSidebarFeedNavigation } from "@/components/reader/hooks/sidebar/use-sidebar-feed-navigation";
import { APP_EVENTS } from "@/constants/events";

describe("useSidebarFeedNavigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the latest selected feed when keyboard navigation repeats before state rerenders", () => {
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

    expect(setExpandedFolders).toHaveBeenNthCalledWith(1, new Set(["folder-a"]));
    expect(setExpandedFolders).toHaveBeenNthCalledWith(2, new Set(["folder-a", "folder-b"]));
    expect(selectFeed).toHaveBeenNthCalledWith(1, "feed2");
    expect(selectFeed).toHaveBeenNthCalledWith(2, "feed3");

    unmount();
    requestAnimationFrameSpy.mockRestore();
  });

  it("focuses feed rows whose data id needs selector escaping", () => {
    const setExpandedFolders = vi.fn();
    const selectFeed = vi.fn();
    const button = document.createElement("button");
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    button.setAttribute("data-feed-id", 'feed-"quoted"');
    document.body.append(button);

    const { unmount } = renderHook(() =>
      useSidebarFeedNavigation({
        orderedFeedIds: ["feed-1", 'feed-"quoted"'],
        selectedFeedId: "feed-1",
        expandedFolderIds: new Set(),
        getFeedFolderId: () => null,
        setExpandedFolders,
        selectFeed,
      }),
    );

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }));

    expect(selectFeed).toHaveBeenCalledWith('feed-"quoted"');
    expect(button).toHaveFocus();

    unmount();
    button.remove();
    requestAnimationFrameSpy.mockRestore();
  });

  it("cancels pending feed focus frames on unmount", () => {
    const setExpandedFolders = vi.fn();
    const selectFeed = vi.fn();
    const button = document.createElement("button");
    const focusSpy = vi.spyOn(button, "focus");
    const scrollIntoView = vi.fn();
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 42;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    button.setAttribute("data-feed-id", "feed-2");
    button.scrollIntoView = scrollIntoView;
    document.body.append(button);

    const { unmount } = renderHook(() =>
      useSidebarFeedNavigation({
        orderedFeedIds: ["feed-1", "feed-2"],
        selectedFeedId: "feed-1",
        expandedFolderIds: new Set(),
        getFeedFolderId: () => null,
        setExpandedFolders,
        selectFeed,
      }),
    );

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }));
    unmount();
    const frameCallback = scheduledCallbacks[0];
    if (!frameCallback) {
      throw new Error("Expected scheduled focus callback");
    }
    frameCallback(0);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();

    button.remove();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("cancels stale feed focus frames when selection changes before the frame runs", () => {
    const setExpandedFolders = vi.fn();
    const selectFeed = vi.fn();
    const button = document.createElement("button");
    const focusSpy = vi.spyOn(button, "focus");
    const scrollIntoView = vi.fn();
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 42;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    button.setAttribute("data-feed-id", "feed-2");
    button.scrollIntoView = scrollIntoView;
    document.body.append(button);

    const { rerender, unmount } = renderHook(
      ({ selectedFeedId }: { selectedFeedId: string }) =>
        useSidebarFeedNavigation({
          orderedFeedIds: ["feed-1", "feed-2", "feed-3"],
          selectedFeedId,
          expandedFolderIds: new Set(),
          getFeedFolderId: () => null,
          setExpandedFolders,
          selectFeed,
        }),
      { initialProps: { selectedFeedId: "feed-1" } },
    );

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }));
    rerender({ selectedFeedId: "feed-3" });
    const frameCallback = scheduledCallbacks[0];
    if (!frameCallback) {
      throw new Error("Expected scheduled focus callback");
    }
    frameCallback(0);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();

    unmount();
    button.remove();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("recalculates the next feed from the latest account feed list after a pending focus is cancelled", () => {
    const setExpandedFolders = vi.fn();
    const selectFeed = vi.fn();
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return scheduledCallbacks.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { rerender, unmount } = renderHook(
      ({ orderedFeedIds, selectedFeedId }: { orderedFeedIds: string[]; selectedFeedId: string }) =>
        useSidebarFeedNavigation({
          orderedFeedIds,
          selectedFeedId,
          expandedFolderIds: new Set(),
          getFeedFolderId: () => null,
          setExpandedFolders,
          selectFeed,
        }),
      {
        initialProps: { orderedFeedIds: ["account-a-feed-1", "account-a-feed-2"], selectedFeedId: "account-a-feed-1" },
      },
    );

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }));
    rerender({
      orderedFeedIds: ["account-b-feed-1", "account-b-feed-2"],
      selectedFeedId: "account-b-feed-1",
    });
    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }));

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1);
    expect(selectFeed).toHaveBeenNthCalledWith(1, "account-a-feed-2");
    expect(selectFeed).toHaveBeenNthCalledWith(2, "account-b-feed-2");
    expect(scheduledCallbacks).toHaveLength(2);

    unmount();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("selects the next feed without scheduling focus when requestAnimationFrame is unavailable", () => {
    const setExpandedFolders = vi.fn();
    const selectFeed = vi.fn();
    vi.stubGlobal("requestAnimationFrame", undefined);

    const { unmount } = renderHook(() =>
      useSidebarFeedNavigation({
        orderedFeedIds: ["feed-1", "feed-2"],
        selectedFeedId: "feed-1",
        expandedFolderIds: new Set(),
        getFeedFolderId: () => null,
        setExpandedFolders,
        selectFeed,
      }),
    );

    expect(() => window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }))).not.toThrow();
    expect(selectFeed).toHaveBeenCalledWith("feed-2");

    unmount();
  });

  it("warns and selects the next feed without scheduling focus when requestAnimationFrame throws", () => {
    const setExpandedFolders = vi.fn();
    const selectFeed = vi.fn();
    const requestError = new Error("requestAnimationFrame unavailable");
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
      throw requestError;
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { unmount } = renderHook(() =>
      useSidebarFeedNavigation({
        orderedFeedIds: ["feed-1", "feed-2"],
        selectedFeedId: "feed-1",
        expandedFolderIds: new Set(),
        getFeedFolderId: () => null,
        setExpandedFolders,
        selectFeed,
      }),
    );

    expect(() => window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 }))).not.toThrow();
    expect(selectFeed).toHaveBeenCalledWith("feed-2");
    expect(warnSpy).toHaveBeenCalledWith("Failed to schedule sidebar feed focus.", requestError);

    unmount();
    requestAnimationFrameSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
