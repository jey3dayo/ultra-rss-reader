import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type FeedTreeFeedViewModel, FeedTreeView } from "@/components/reader/feed-tree-view";

const baseFeed: FeedTreeFeedViewModel = {
  id: "feed-1",
  accountId: "account-1",
  folderId: null,
  title: "Example Feed",
  url: "https://example.com/feed.xml",
  siteUrl: "https://example.com",
  unreadCount: 3,
  readerMode: "inherit",
  webPreviewMode: "inherit",
  isSelected: false,
  grayscaleFavicon: false,
};

describe("FeedTreeView visibility and density contract", () => {
  it("does not project empty-state content while the subscriptions section is collapsed", () => {
    const { container } = render(
      <FeedTreeView
        isOpen={false}
        folders={[]}
        unfolderedFeeds={[]}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "Press plus to add feed" }}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
      />,
    );

    expect(screen.queryByText("Press plus to add feed")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("projects the selected density tokens onto feed rows", () => {
    render(
      <FeedTreeView
        isOpen={true}
        sidebarDensity="compact"
        folders={[]}
        unfolderedFeeds={[baseFeed]}
        displayFavicons={false}
        emptyState={{ kind: "hidden" }}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Example Feed/ })).toHaveClass("min-h-8", "py-0.5");
  });
});
