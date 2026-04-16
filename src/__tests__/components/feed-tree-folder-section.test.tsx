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

    expect(folderButton).toHaveClass("pl-1.5");
    expect(folderButton).not.toHaveClass("pl-0");
  });
});
