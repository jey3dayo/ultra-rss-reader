import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeedTreeFeedViewModel } from "@/components/reader/feed-tree.types";
import { FeedTreeRow } from "@/components/reader/feed-tree-row";

const baseFeed: FeedTreeFeedViewModel = {
  id: "feed-1",
  accountId: "acc-1",
  folderId: "folder-1",
  title: "Alpha",
  url: "https://example.com/alpha.xml",
  siteUrl: "https://example.com/alpha",
  unreadCount: 4,
  readerMode: "on",
  webPreviewMode: "off",
  isSelected: true,
  grayscaleFavicon: false,
};

describe("FeedTreeRow", () => {
  it("does not reserve the old drag padding when drag mode is enabled", () => {
    const { container } = render(
      <FeedTreeRow
        feed={baseFeed}
        displayFavicons={false}
        onSelectFeed={vi.fn()}
        canDragFeeds={true}
        onDragStartFeed={vi.fn()}
        onPointerDownFeed={vi.fn()}
        consumeSuppressedHandleClick={() => false}
      />,
    );

    const feedButton = container.querySelector<HTMLButtonElement>("button[data-feed-id='feed-1']");
    const selectedIndicator = container.querySelector<HTMLElement>("[data-feed-row-selected-indicator='feed-1']");
    const handleAnchor = container.querySelector<HTMLElement>("[data-feed-row-handle-anchor='feed-1']");
    const row = container.querySelector<HTMLElement>("[data-feed-row-id='feed-1']");

    expect(feedButton).not.toBeNull();
    expect(selectedIndicator).not.toBeNull();
    expect(handleAnchor).not.toBeNull();
    expect(row).not.toBeNull();
    expect(feedButton).not.toHaveClass("pl-7");
    expect(feedButton).not.toHaveClass("pl-8");
    expect(selectedIndicator).toHaveClass("left-[var(--feed-tree-rail-offset)]");
    expect(handleAnchor).toHaveClass("left-[var(--feed-tree-rail-offset)]");
    expect(selectedIndicator).toHaveClass("group-hover/feed-row:opacity-0");
    expect(selectedIndicator).toHaveClass("group-focus-within/feed-row:opacity-0");
    expect(feedButton).not.toHaveClass("before:-left-2");
    expect(row).toHaveAttribute("data-feed-row-id", "feed-1");
  });

  it("keeps the selected indicator visible when drag mode is disabled", () => {
    const { container } = render(
      <FeedTreeRow feed={baseFeed} displayFavicons={false} onSelectFeed={vi.fn()} canDragFeeds={false} />,
    );

    const selectedIndicator = container.querySelector<HTMLElement>("[data-feed-row-selected-indicator='feed-1']");
    const dragButton = screen.queryByRole("button", { name: "Drag Alpha" });

    expect(selectedIndicator).not.toBeNull();
    expect(selectedIndicator).not.toHaveClass("group-hover/feed-row:opacity-0");
    expect(selectedIndicator).not.toHaveClass("group-focus-within/feed-row:opacity-0");
    expect(dragButton).toBeNull();
  });

  it("shows the drag handle only on row hover or focus", () => {
    const { container } = render(
      <FeedTreeRow
        feed={{ ...baseFeed, isSelected: false }}
        displayFavicons={false}
        onSelectFeed={vi.fn()}
        canDragFeeds={true}
        onDragStartFeed={vi.fn()}
        onPointerDownFeed={vi.fn()}
        consumeSuppressedHandleClick={() => false}
      />,
    );

    const dragButton = screen.getByRole("button", { name: "Drag Alpha" });

    expect(dragButton).toHaveClass("opacity-0");
    expect(dragButton).toHaveClass("group-hover/feed-row:opacity-100");
    expect(dragButton).toHaveClass("group-focus-within/feed-row:opacity-100");
    expect(container.firstChild).toHaveClass("group/feed-row");
  });

  it("uses the softened sidebar hover tone for the drag handle", () => {
    render(
      <FeedTreeRow
        feed={{ ...baseFeed, isSelected: false }}
        displayFavicons={false}
        onSelectFeed={vi.fn()}
        canDragFeeds={true}
        onDragStartFeed={vi.fn()}
        onPointerDownFeed={vi.fn()}
        consumeSuppressedHandleClick={() => false}
      />,
    );

    const dragButton = screen.getByRole("button", { name: "Drag Alpha" });

    expect(dragButton).toHaveClass("hover:bg-sidebar-accent/28");
  });
});
