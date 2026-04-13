import { describe, expect, it } from "vitest";
import {
  createFeedTreePointerDragSession,
  shouldStartFeedTreePointerDrag,
  updateFeedTreePointerDragSessionPosition,
} from "@/components/reader/feed-tree-drag-session";

const feed = {
  id: "feed-1",
  accountId: "account-1",
  folderId: null,
  title: "Feed 1",
  url: "https://example.com/feed.xml",
  siteUrl: "https://example.com",
  unreadCount: 3,
  readerMode: "inherit",
  webPreviewMode: "inherit",
  isSelected: false,
  grayscaleFavicon: false,
} as const;

describe("feed tree drag session helpers", () => {
  it("creates a fresh pointer drag session from the initial pointer position", () => {
    const session = createFeedTreePointerDragSession(feed, 7, 10, 20);

    expect(session).toMatchObject({
      feed,
      pointerId: 7,
      originX: 10,
      originY: 20,
      currentX: 10,
      currentY: 20,
      isDragging: false,
      hoverTarget: null,
    });
  });

  it("updates pointer position and starts dragging only after crossing the threshold", () => {
    const session = createFeedTreePointerDragSession(feed, 7, 10, 20);

    updateFeedTreePointerDragSessionPosition(session, 13, 23);
    expect(shouldStartFeedTreePointerDrag(session, 13, 23)).toBe(false);

    updateFeedTreePointerDragSessionPosition(session, 16, 26);
    expect(shouldStartFeedTreePointerDrag(session, 16, 26)).toBe(true);
  });
});
