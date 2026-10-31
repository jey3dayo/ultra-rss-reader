import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeedTreePresenceFeedViewModel } from "@/components/reader/feed-tree.types";
import { FeedTreeRow } from "@/components/reader/feed-tree-row";

const baseFeed: FeedTreePresenceFeedViewModel = {
  id: "feed-break-ui",
  accountId: "acc-1",
  folderId: "folder-1",
  title: "International news and technology headlines with emoji 📰",
  url: "https://example.com/feed.xml",
  siteUrl: "https://example.com",
  unreadCount: 12_345_678,
  readerMode: "on",
  webPreviewMode: "off",
  isSelected: false,
  grayscaleFavicon: false,
  isLeaving: false,
};

describe("FeedTreeRow unread counts", () => {
  it("shows a capped badge label and exposes the exact count in the badge title", () => {
    render(<FeedTreeRow feed={{ ...baseFeed, isSelected: true }} displayFavicons onSelectFeed={() => {}} />);

    expect(screen.getByText("9,999+")).toBeInTheDocument();
    expect(screen.getByTitle("12,345,678")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /International news.*12,345,678/ })).toBeInTheDocument();
  });
});
