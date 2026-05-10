import { fireEvent, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import type { UseFeedTreePointerDragEventsParams } from "@/components/reader/hooks/feed-tree/feed-tree-drag.types";
import { useFeedTreePointerDragEvents } from "@/components/reader/hooks/feed-tree/use-feed-tree-pointer-drag-events";
import type { ActiveDropTarget, FeedTreeFeedViewModel } from "@/components/reader/feed-tree.types";
import {
  createFeedTreePointerDragSession,
  type FeedTreePointerDragSession,
} from "@/components/reader/feed-tree-drag-session";
import {
  FEED_DROP_TARGET_ID_ATTRIBUTE,
  FEED_DROP_TARGET_KIND_ATTRIBUTE,
} from "@/components/reader/feed-tree-drop-target";

const dragWindowEventTypes = new Set([
  "pointermove",
  "pointerup",
  "pointercancel",
  "keydown",
  "blur",
]);

function createFeed(overrides: Partial<FeedTreeFeedViewModel> = {}): FeedTreeFeedViewModel {
  return {
    id: "feed-1",
    accountId: "account-1",
    folderId: null,
    title: "Alpha",
    url: "https://example.com/feed.xml",
    siteUrl: "https://example.com",
    unreadCount: 0,
    readerMode: "on",
    webPreviewMode: "off",
    isSelected: false,
    grayscaleFavicon: false,
    ...overrides,
  };
}

function createFolderDropElement(folderId: string) {
  const element = document.createElement("div");
  element.setAttribute(FEED_DROP_TARGET_KIND_ATTRIBUTE, "folder");
  element.setAttribute(FEED_DROP_TARGET_ID_ATTRIBUTE, folderId);
  return element;
}

function createParams(
  pointerDragRef: MutableRefObject<FeedTreePointerDragSession | null>,
  overrides: Partial<UseFeedTreePointerDragEventsParams> = {},
): UseFeedTreePointerDragEventsParams {
  return {
    isPointerTracking: true,
    pointerDragRef,
    setPointerDragPreview: vi.fn(),
    setPointerHoverTarget: vi.fn(),
    queueSuppressHandleClickReset: vi.fn(),
    clearPointerTracking: vi.fn(),
    onDragStartFeed: vi.fn(),
    onDragEnterFolder: vi.fn(),
    onDragEnterUnfoldered: vi.fn(),
    onDropToFolder: vi.fn(),
    onDropToUnfoldered: vi.fn(),
    onDragEnd: vi.fn(),
    ...overrides,
  };
}

function createPointerEvent(type: string, pointerId: number, clientX: number, clientY: number) {
  return new PointerEvent(type, {
    bubbles: true,
    clientX,
    clientY,
    pointerId,
  });
}

describe("useFeedTreePointerDragEvents", () => {
  it("keeps window listeners fixed for the drag session while using latest callbacks", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const originalElementFromPoint = document.elementFromPoint;
    const firstFolderTarget = createFolderDropElement("folder-1");
    const secondFolderTarget = createFolderDropElement("folder-2");
    const pointerDragRef: MutableRefObject<FeedTreePointerDragSession | null> = {
      current: createFeedTreePointerDragSession(createFeed(), 1, 10, 10),
    };
    const initialSetPointerDragPreview = vi.fn();
    const latestSetPointerDragPreview = vi.fn();
    const initialOnDragEnterFolder = vi.fn();
    const latestOnDragEnterFolder = vi.fn();
    const latestOnDropToFolder = vi.fn();
    const latestClearPointerTracking = vi.fn(() => {
      pointerDragRef.current = null;
    });
    const getDragListenerAdds = () =>
      addEventListenerSpy.mock.calls.filter(([type]) =>
        dragWindowEventTypes.has(String(type)),
      ).length;
    const getDragListenerRemoves = () =>
      removeEventListenerSpy.mock.calls.filter(([type]) =>
        dragWindowEventTypes.has(String(type)),
      ).length;

    try {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: vi.fn(() => firstFolderTarget),
      });

      const { rerender, unmount } = renderHook(
        ({ params }: { params: UseFeedTreePointerDragEventsParams }) =>
          useFeedTreePointerDragEvents(params),
        {
          initialProps: {
            params: createParams(pointerDragRef, {
              setPointerDragPreview: initialSetPointerDragPreview,
              onDragEnterFolder: initialOnDragEnterFolder,
            }),
          },
        },
      );

      expect(getDragListenerAdds()).toBe(5);
      expect(getDragListenerRemoves()).toBe(0);

      fireEvent(window, createPointerEvent("pointermove", 1, 20, 20));

      expect(initialSetPointerDragPreview).toHaveBeenCalledWith({
        feed: expect.objectContaining({ id: "feed-1" }),
        x: 20,
        y: 20,
      });
      expect(initialOnDragEnterFolder).toHaveBeenCalledWith("folder-1");

      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: vi.fn(() => secondFolderTarget),
      });

      rerender({
        params: createParams(pointerDragRef, {
          setPointerDragPreview: latestSetPointerDragPreview,
          onDragEnterFolder: latestOnDragEnterFolder,
          onDropToFolder: latestOnDropToFolder,
          clearPointerTracking: latestClearPointerTracking,
        }),
      });

      fireEvent(window, createPointerEvent("pointermove", 1, 30, 30));

      expect(getDragListenerAdds()).toBe(5);
      expect(getDragListenerRemoves()).toBe(0);
      expect(initialSetPointerDragPreview).toHaveBeenCalledTimes(1);
      expect(latestSetPointerDragPreview).toHaveBeenCalledWith({
        feed: expect.objectContaining({ id: "feed-1" }),
        x: 30,
        y: 30,
      });
      expect(initialOnDragEnterFolder).toHaveBeenCalledTimes(1);
      expect(latestOnDragEnterFolder).toHaveBeenCalledWith("folder-2");

      fireEvent(window, createPointerEvent("pointerup", 1, 30, 30));

      expect(latestOnDropToFolder).toHaveBeenCalledWith("folder-2");
      expect(latestClearPointerTracking).toHaveBeenCalledOnce();

      rerender({
        params: createParams(pointerDragRef, {
          isPointerTracking: false,
          setPointerDragPreview: latestSetPointerDragPreview,
          onDragEnterFolder: latestOnDragEnterFolder,
          onDropToFolder: latestOnDropToFolder,
          clearPointerTracking: latestClearPointerTracking,
        }),
      });
      expect(getDragListenerRemoves()).toBe(5);

      unmount();
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    }
  });

  it("cancels the current drag session on pointercancel", () => {
    const pointerDragRef: MutableRefObject<FeedTreePointerDragSession | null> = {
      current: createFeedTreePointerDragSession(createFeed(), 1, 10, 10),
    };
    const queueSuppressHandleClickReset = vi.fn();
    const clearPointerTracking = vi.fn(() => {
      pointerDragRef.current = null;
    });
    const onDragEnd = vi.fn();

    renderHook(() =>
      useFeedTreePointerDragEvents(
        createParams(pointerDragRef, {
          queueSuppressHandleClickReset,
          clearPointerTracking,
          onDragEnd,
        }),
      ),
    );

    fireEvent(window, createPointerEvent("pointermove", 1, 20, 20));
    fireEvent(window, createPointerEvent("pointercancel", 1, 20, 20));

    expect(queueSuppressHandleClickReset).toHaveBeenCalledOnce();
    expect(onDragEnd).toHaveBeenCalledOnce();
    expect(clearPointerTracking).toHaveBeenCalledOnce();
  });
});
