import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSidebarFeedDragState } from "@/components/reader/hooks/sidebar/use-sidebar-feed-drag-state";

function renderDragState({
  feedById = new Map([
    ["feed-foldered", { folder_id: "folder-1" }],
    ["feed-unfoldered", { folder_id: null }],
  ]),
  moveFeedToFolder = vi.fn(async () => undefined),
  moveFeedToUnfoldered = vi.fn(async () => undefined),
}: Partial<Parameters<typeof useSidebarFeedDragState>[0]> = {}) {
  return renderHook(() =>
    useSidebarFeedDragState({
      canDragFeeds: true,
      isFeedsSectionOpen: true,
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
});
