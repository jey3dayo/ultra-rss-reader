import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedTreeView } from "@/components/reader/feed-tree-view";

describe("FeedTreeView", () => {
  it("renders folder and feed rows and delegates row actions", async () => {
    const user = userEvent.setup();
    const onToggleFolder = vi.fn();
    const onSelectFeed = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        folders={[
          {
            id: "folder-1",
            name: "Work",
            unreadCount: 4,
            isExpanded: true,
            feeds: [
              {
                id: "feed-1",
                title: "Alpha",
                url: "https://example.com/alpha.xml",
                siteUrl: "https://example.com/alpha",
                unreadCount: 4,
                displayMode: "normal",
                isSelected: true,
                grayscaleFavicon: false,
              },
            ],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-2",
            title: "Beta",
            url: "https://example.com/beta.xml",
            siteUrl: "https://example.com/beta",
            unreadCount: 1,
            displayMode: "normal",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={onToggleFolder}
        onSelectFeed={onSelectFeed}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
        renderFolderContextMenu={() => <div />}
        renderFeedContextMenu={() => <div />}
      />,
    );

    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Work/ }));
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    await user.click(screen.getByRole("button", { name: /Beta/ }));

    expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(1, "feed-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(2, "feed-2");
  });

  it("renders the empty action when there are no feeds", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "action", label: "Add account", onAction }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add account" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
