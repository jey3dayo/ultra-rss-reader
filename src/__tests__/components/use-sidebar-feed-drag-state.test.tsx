import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSidebarFeedDragState } from "@/components/reader/hooks/sidebar/use-sidebar-feed-drag-state";

function renderDragState({
  canDragFeeds = true,
  isFeedsSectionOpen = true,
  feedById = new Map([
    ["feed-foldered", { folder_id: "folder-1" }],
    ["feed-unfoldered", { folder_id: null }],
  ]),
  moveFeedToFolder = vi.fn(async () => undefined),
  moveFeedToUnfoldered = vi.fn(async () => undefined),
}: Partial<Parameters<typeof useSidebarFeedDragState>[0]> = {}) {
  return renderHook(() =>
    useSidebarFeedDragState({
      canDragFeeds,
      isFeedsSectionOpen,
      feedById,
      moveFeedToFolder,
      moveFeedToUnfoldered,
    }),
  );
}

describe("useSidebarFeedDragState", () => {
  it("moves dragged feeds to a different folder and clears drag state", async () => {
    const moveFeedToFolder = vi.fn(async () => undefined);
    const { result } = renderDragState({ moveFeedToFolder });

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
      result.current.handleDragEnterFolder("folder-2");
    });

    await act(async () => {
      await result.current.handleDropToFolder("folder-2");
    });

    expect(moveFeedToFolder).toHaveBeenCalledWith("feed-foldered", "folder-2");
    expect(result.current.draggedFeedId).toBeNull();
    expect(result.current.activeDropTarget).toBeNull();
  });

  it("clears drag state without repository updates for invalid or same-target drops", async () => {
    const moveFeedToFolder = vi.fn(async () => undefined);
    const moveFeedToUnfoldered = vi.fn(async () => undefined);
    const { result } = renderDragState({ moveFeedToFolder, moveFeedToUnfoldered });

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
      result.current.handleDragEnterFolder("folder-1");
    });

    await act(async () => {
      await result.current.handleDropToFolder("folder-1");
    });

    expect(moveFeedToFolder).not.toHaveBeenCalled();
    expect(result.current.draggedFeedId).toBeNull();
    expect(result.current.activeDropTarget).toBeNull();

    act(() => {
      result.current.handleDragStartFeed("feed-unfoldered");
      result.current.handleDragEnterUnfoldered();
    });

    await act(async () => {
      await result.current.handleDropToUnfoldered();
    });

    expect(moveFeedToUnfoldered).not.toHaveBeenCalled();
    expect(result.current.draggedFeedId).toBeNull();
    expect(result.current.activeDropTarget).toBeNull();
  });

  it("ignores drag starts when feeds cannot be dragged, the section is closed, or the feed is missing", () => {
    const disabledDrag = renderDragState({ canDragFeeds: false });
    const closedSection = renderDragState({ isFeedsSectionOpen: false });
    const missingFeed = renderDragState();

    act(() => {
      disabledDrag.result.current.handleDragStartFeed("feed-foldered");
      disabledDrag.result.current.handleDragEnterFolder("folder-2");
      closedSection.result.current.handleDragStartFeed("feed-foldered");
      closedSection.result.current.handleDragEnterUnfoldered();
      missingFeed.result.current.handleDragStartFeed("missing-feed");
      missingFeed.result.current.handleDragEnterFolder("folder-2");
    });

    expect(disabledDrag.result.current.draggedFeedId).toBeNull();
    expect(disabledDrag.result.current.activeDropTarget).toBeNull();
    expect(closedSection.result.current.draggedFeedId).toBeNull();
    expect(closedSection.result.current.activeDropTarget).toBeNull();
    expect(missingFeed.result.current.draggedFeedId).toBeNull();
    expect(missingFeed.result.current.activeDropTarget).toBeNull();
  });

  it("clears drag state and rejects when folder drops fail", async () => {
    const dropError = new Error("move failed");
    const moveFeedToFolder = vi.fn(async () => {
      throw dropError;
    });
    const { result } = renderDragState({ moveFeedToFolder });

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
      result.current.handleDragEnterFolder("folder-2");
    });

    await act(async () => {
      await expect(result.current.handleDropToFolder("folder-2")).rejects.toThrow(dropError);
    });

    expect(moveFeedToFolder).toHaveBeenCalledWith("feed-foldered", "folder-2");
    expect(result.current.draggedFeedId).toBeNull();
    expect(result.current.activeDropTarget).toBeNull();
  });

  it("clears drag state and rejects when unfoldered drops fail", async () => {
    const dropError = new Error("move failed");
    const moveFeedToUnfoldered = vi.fn(async () => {
      throw dropError;
    });
    const { result } = renderDragState({ moveFeedToUnfoldered });

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
      result.current.handleDragEnterUnfoldered();
    });

    await act(async () => {
      await expect(result.current.handleDropToUnfoldered()).rejects.toThrow(dropError);
    });

    expect(moveFeedToUnfoldered).toHaveBeenCalledWith("feed-foldered");
    expect(result.current.draggedFeedId).toBeNull();
    expect(result.current.activeDropTarget).toBeNull();
  });
});
