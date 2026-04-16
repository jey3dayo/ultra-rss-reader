import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeedTreeFeedViewModel } from "@/components/reader/feed-tree.types";
import { FeedTreeUnfolderedSection } from "@/components/reader/feed-tree-unfoldered-section";

const unfolderedFeed: FeedTreeFeedViewModel = {
  id: "feed-1",
  accountId: "acc-1",
  folderId: null,
  title: "Loose Feed",
  url: "https://example.com/feed.xml",
  siteUrl: "https://example.com",
  unreadCount: 2,
  readerMode: "on",
  webPreviewMode: "off",
  isSelected: false,
  grayscaleFavicon: false,
};

describe("FeedTreeUnfolderedSection", () => {
  it("uses softened label and rail tones", () => {
    render(
      <FeedTreeUnfolderedSection
        unfolderedFeeds={[unfolderedFeed]}
        unfolderedLabel="No folder"
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        canDragFeeds={false}
        normalizedDraggedFeedId={null}
        onPointerDownFeed={vi.fn()}
        consumeSuppressedHandleClick={() => false}
      />,
    );

    expect(screen.getByText("No folder")).toHaveClass("text-sidebar-foreground/40");
    expect(screen.getByText("Loose Feed").closest("button")).toBeInTheDocument();
  });
});
