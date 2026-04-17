import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeedTreeFolderViewModel } from "@/components/reader/feed-tree.types";
import { FeedTreeFolderSection } from "@/components/reader/feed-tree-folder-section";

const baseFolder: FeedTreeFolderViewModel = {
  id: "folder-1",
  name: "Comic",
  accountId: "acc-1",
  sortOrder: 0,
  unreadCount: 9274,
  isExpanded: false,
  isSelected: true,
  feeds: [],
};

describe("FeedTreeFolderSection", () => {
  it("keeps some inset between the selected folder border and its label", () => {
    render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    const folderButton = screen.getByRole("button", { name: "Select folder Comic" });
    const toggleButton = screen.getByRole("button", { name: "Toggle folder Comic" });

    expect(folderButton).toHaveClass("pl-1.5");
    expect(folderButton).not.toHaveClass("pl-0");
    expect(toggleButton).toHaveClass("select-none", "hover:bg-[var(--sidebar-hover-surface)]");
    expect(screen.getByText("9,274")).toHaveClass("text-foreground-soft");
  });

  it("uses a softer active drop tone for folder targets", () => {
    render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={{ kind: "folder", folderId: "folder-1" }}
        draggedFeedId="feed-2"
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        canDragFeeds={true}
      />,
    );

    const folderButton = screen.getByRole("button", { name: "Select folder Comic" });
    const row = folderButton.closest("div.rounded-md");

    expect(row).toHaveClass("bg-[var(--feed-tree-active-folder-surface)]");
    expect(folderButton).toHaveClass("bg-[var(--feed-tree-drop-target-surface)]");
  });

  it("keeps the folder feed panel mounted with animated collapse state", () => {
    render(
      <FeedTreeFolderSection
        folder={{
          ...baseFolder,
          isExpanded: false,
          feeds: [
            {
              id: "feed-1",
              accountId: "acc-1",
              folderId: "folder-1",
              title: "Alpha",
              url: "https://example.com/feed.xml",
              siteUrl: "https://example.com",
              unreadCount: 1,
              readerMode: "on",
              webPreviewMode: "off",
              isSelected: false,
              grayscaleFavicon: false,
            },
          ],
        }}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    const toggleButton = screen.getByRole("button", { name: "Toggle folder Comic" });
    const folderPanel = document.getElementById("feed-tree-folder-panel-folder-1");

    expect(toggleButton).toHaveClass("motion-disclosure-trigger");
    expect(toggleButton.querySelector("svg")).toHaveClass("motion-disclosure-icon");
    expect(folderPanel).toHaveAttribute("aria-hidden", "true");
    expect(folderPanel).toHaveClass("motion-disclosure-panel");
  });
});
