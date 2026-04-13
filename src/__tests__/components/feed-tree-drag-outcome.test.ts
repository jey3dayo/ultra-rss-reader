import { describe, expect, it } from "vitest";
import { resolveFeedTreePointerDropOutcome } from "@/components/reader/feed-tree-drag-outcome";
import { createFeedTreePointerDragSession } from "@/components/reader/feed-tree-drag-session";

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

describe("resolveFeedTreePointerDropOutcome", () => {
  it("clears when there is no active drag session", () => {
    expect(resolveFeedTreePointerDropOutcome(null, null, false)).toEqual({ type: "clear" });
  });

  it("clears when the pointer never crossed the drag threshold", () => {
    const session = createFeedTreePointerDragSession(feed, 1, 10, 20);
    expect(resolveFeedTreePointerDropOutcome(session, { kind: "folder", folderId: "folder-1" }, false)).toEqual({
      type: "clear",
    });
  });

  it("returns cancel for cancelled drags", () => {
    const session = createFeedTreePointerDragSession(feed, 1, 10, 20);
    session.isDragging = true;

    expect(resolveFeedTreePointerDropOutcome(session, null, true)).toEqual({ type: "cancel" });
  });

  it("returns folder and unfoldered drop outcomes", () => {
    const session = createFeedTreePointerDragSession(feed, 1, 10, 20);
    session.isDragging = true;

    expect(resolveFeedTreePointerDropOutcome(session, { kind: "folder", folderId: "folder-1" }, false)).toEqual({
      type: "drop-folder",
      folderId: "folder-1",
    });
    expect(resolveFeedTreePointerDropOutcome(session, { kind: "unfoldered" }, false)).toEqual({
      type: "drop-unfoldered",
    });
    expect(resolveFeedTreePointerDropOutcome(session, null, false)).toEqual({ type: "drop-none" });
  });
});
