import { describe, expect, it } from "vitest";
import { resolveFeedTreePointerDropOutcome } from "@/components/reader/feed-tree-drag-outcome";
import type { FeedTreePointerDragSession } from "@/components/reader/feed-tree-drag-session";
import type { FeedTreeFeedViewModel } from "@/components/reader/feed-tree-row";

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

const draggingSession: FeedTreePointerDragSession = {
  feed,
  pointerId: 3,
  originX: 10,
  originY: 20,
  currentX: 12,
  currentY: 24,
  isDragging: true,
  hoverTarget: null,
};

describe("resolveFeedTreePointerDropOutcome", () => {
  it("clears when no session is active or dragging has not started", () => {
    expect(resolveFeedTreePointerDropOutcome(null, null, false)).toEqual({ type: "clear" });
    expect(resolveFeedTreePointerDropOutcome({ ...draggingSession, isDragging: false }, null, false)).toEqual({
      type: "clear",
    });
  });

  it("returns cancel when escape or pointer cancel ends an active drag", () => {
    expect(resolveFeedTreePointerDropOutcome(draggingSession, null, true)).toEqual({ type: "cancel" });
  });

  it("routes folder and unfoldered drops to the matching outcomes", () => {
    expect(resolveFeedTreePointerDropOutcome(draggingSession, { kind: "folder", folderId: "folder-1" }, false)).toEqual(
      {
        type: "drop-folder",
        folderId: "folder-1",
      },
    );
    expect(resolveFeedTreePointerDropOutcome(draggingSession, { kind: "unfoldered" }, false)).toEqual({
      type: "drop-unfoldered",
    });
  });

  it("returns drop-none when an active drag ends outside any target", () => {
    expect(resolveFeedTreePointerDropOutcome(draggingSession, null, false)).toEqual({ type: "drop-none" });
  });
});
