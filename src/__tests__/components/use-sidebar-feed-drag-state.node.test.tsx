import { act, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it, vi } from "vitest";
import { useSidebarFeedDragState } from "@/components/reader/hooks/sidebar/use-sidebar-feed-drag-state";

setupBrowserTestDom();

function renderDragState({
  canDragFeeds = true,
  isFeedsSectionOpen = true,
  feedById = new Map([
    ["feed-foldered", { account_id: "account-1", folder_id: "folder-1" }],
    ["feed-unfoldered", { account_id: "account-1", folder_id: null }],
  ]),
  folderById = new Map([
    ["folder-1", { account_id: "account-1" }],
    ["folder-2", { account_id: "account-1" }],
  ]),
  moveFeedToFolder = vi.fn(async () => undefined),
  moveFeedToUnfoldered = vi.fn(async () => undefined),
}: Partial<Parameters<typeof useSidebarFeedDragState>[0]> = {}) {
  return renderHook(() =>
    useSidebarFeedDragState({
      canDragFeeds,
      isFeedsSectionOpen,
      feedById,
      folderById,
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
    });

    act(() => {
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

  it("ignores folder drops when the target folder is missing or belongs to another account", async () => {
    const moveFeedToFolder = vi.fn(async () => undefined);
    const { result } = renderDragState({
      moveFeedToFolder,
      folderById: new Map([
        ["folder-1", { account_id: "account-1" }],
        ["folder-other-account", { account_id: "account-2" }],
      ]),
    });

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
      result.current.handleDragEnterFolder("missing-folder");
    });

    await act(async () => {
      await result.current.handleDropToFolder("missing-folder");
    });

    expect(moveFeedToFolder).not.toHaveBeenCalled();
    expect(result.current.draggedFeedId).toBeNull();
    expect(result.current.activeDropTarget).toBeNull();

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
      result.current.handleDragEnterFolder("folder-other-account");
    });

    await act(async () => {
      await result.current.handleDropToFolder("folder-other-account");
    });

    expect(moveFeedToFolder).not.toHaveBeenCalled();
    expect(result.current.draggedFeedId).toBeNull();
    expect(result.current.activeDropTarget).toBeNull();
  });

  it("does not keep stale folder hover targets when a folder is missing or belongs to another account", async () => {
    const { result } = renderDragState({
      folderById: new Map([
        ["folder-1", { account_id: "account-1" }],
        ["folder-other-account", { account_id: "account-2" }],
      ]),
    });

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
    });

    await waitFor(() => {
      expect(result.current.draggedFeedId).toBe("feed-foldered");
    });

    act(() => {
      result.current.handleDragEnterFolder("missing-folder");
    });

    expect(result.current.activeDropTarget).toBeNull();

    act(() => {
      result.current.handleDragEnterFolder("folder-other-account");
    });

    expect(result.current.activeDropTarget).toBeNull();
  });

  it("clears an active folder hover target when folder data changes during drag", async () => {
    const initialFeedById = new Map([["feed-foldered", { account_id: "account-1", folder_id: "folder-1" }]]);
    const initialFolderById = new Map([
      ["folder-1", { account_id: "account-1" }],
      ["folder-2", { account_id: "account-1" }],
    ]);
    const moveFeedToFolder = vi.fn(async () => undefined);
    const moveFeedToUnfoldered = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ folderById }) =>
        useSidebarFeedDragState({
          canDragFeeds: true,
          isFeedsSectionOpen: true,
          feedById: initialFeedById,
          folderById,
          moveFeedToFolder,
          moveFeedToUnfoldered,
        }),
      { initialProps: { folderById: initialFolderById } },
    );

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
    });

    await waitFor(() => {
      expect(result.current.draggedFeedId).toBe("feed-foldered");
    });

    act(() => {
      result.current.handleDragEnterFolder("folder-2");
    });

    expect(result.current.activeDropTarget).toEqual({ kind: "folder", folderId: "folder-2" });

    rerender({
      folderById: new Map([["folder-1", { account_id: "account-1" }]]),
    });

    expect(result.current.draggedFeedId).toBe("feed-foldered");
    expect(result.current.activeDropTarget).toBeNull();
  });

  it("ignores a drop to a folder that became stale after hover", async () => {
    const initialFeedById = new Map([["feed-foldered", { account_id: "account-1", folder_id: "folder-1" }]]);
    const initialFolderById = new Map([
      ["folder-1", { account_id: "account-1" }],
      ["folder-2", { account_id: "account-1" }],
    ]);
    const moveFeedToFolder = vi.fn(async () => undefined);
    const moveFeedToUnfoldered = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ folderById }) =>
        useSidebarFeedDragState({
          canDragFeeds: true,
          isFeedsSectionOpen: true,
          feedById: initialFeedById,
          folderById,
          moveFeedToFolder,
          moveFeedToUnfoldered,
        }),
      { initialProps: { folderById: initialFolderById } },
    );

    act(() => {
      result.current.handleDragStartFeed("feed-foldered");
    });

    await waitFor(() => {
      expect(result.current.draggedFeedId).toBe("feed-foldered");
    });

    act(() => {
      result.current.handleDragEnterFolder("folder-2");
    });

    expect(result.current.activeDropTarget).toEqual({ kind: "folder", folderId: "folder-2" });

    rerender({
      folderById: new Map([["folder-1", { account_id: "account-1" }]]),
    });

    await act(async () => {
      await result.current.handleDropToFolder("folder-2");
    });

    expect(moveFeedToFolder).not.toHaveBeenCalled();
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
