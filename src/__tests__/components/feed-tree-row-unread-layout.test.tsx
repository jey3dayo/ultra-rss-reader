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

describe("FeedTreeRow sidebar unread layout", () => {
  it("caps unread counts, keeps the rail from shrinking, and truncates long feed titles", () => {
    const { container } = render(
      <FeedTreeRow feed={{ ...baseFeed, isSelected: true }} displayFavicons onSelectFeed={() => {}} />,
    );

    const button = container.querySelector("[data-feed-id='feed-break-ui']");
    const title = screen.getByText(baseFeed.title);
    const badge = container.querySelector(".motion-sidebar-badge");

    expect(button).not.toBeNull();
    expect(screen.getByText("9,999+")).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "12,345,678");
    expect(badge).toHaveClass("shrink-0");
    expect(screen.getByText("9,999+")).toHaveClass("min-w-8", "shrink-0", "justify-end", "text-right");
    expect(title).toHaveClass("min-w-0", "flex-1", "truncate");
    expect(button?.querySelector(":scope > span.flex-1")).toHaveClass("min-w-0");
  });
});
