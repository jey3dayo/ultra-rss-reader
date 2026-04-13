import { describe, expect, it } from "vitest";
import {
  createFeedTreePointerDragSession,
  shouldStartFeedTreePointerDrag,
  updateFeedTreePointerDragSessionPosition,
} from "@/components/reader/feed-tree-drag-session";
import type { FeedTreeFeedViewModel } from "@/components/reader/feed-tree-row";

describe("feedTreeDragSession", () => {
  const feed = {
    id: "feed-1",
    accountId: "account-1",
    folderId: null,
    title: "Tech Feed",
    url: "https://example.com/feed.xml",
    siteUrl: "https://example.com",
    unreadCount: 3,
    readerMode: "inherit",
    webPreviewMode: "inherit",
    isSelected: false,
    grayscaleFavicon: false,
  } as const satisfies FeedTreeFeedViewModel;

  it("creates a new session from the initial pointer position", () => {
    const session = createFeedTreePointerDragSession(feed, 7, 120, 240);

    expect(session).toEqual({
      feed,
      pointerId: 7,
      originX: 120,
      originY: 240,
      currentX: 120,
      currentY: 240,
      isDragging: false,
      hoverTarget: null,
    });
  });

  it("updates the current pointer position without touching the origin", () => {
    const session = createFeedTreePointerDragSession(feed, 7, 120, 240);

    updateFeedTreePointerDragSessionPosition(session, 150, 275);

    expect(session.originX).toBe(120);
    expect(session.originY).toBe(240);
    expect(session.currentX).toBe(150);
    expect(session.currentY).toBe(275);
  });

  it("starts dragging only after the drag threshold is reached", () => {
    const session = createFeedTreePointerDragSession(feed, 7, 100, 100);

    expect(shouldStartFeedTreePointerDrag(session, 104, 104)).toBe(false);
    expect(shouldStartFeedTreePointerDrag(session, 106, 100)).toBe(true);
  });
});
