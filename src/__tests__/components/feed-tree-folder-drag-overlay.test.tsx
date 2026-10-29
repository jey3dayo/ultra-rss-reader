import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedTreeFolderDragOverlay } from "@/components/reader/feed-tree-folder-drag-overlay";
import type { FolderTreeDragOverlayPreview } from "@/components/reader/hooks/feed-tree/folder-tree-drag.types";

const preview: FolderTreeDragOverlayPreview = {
  folder: {
    id: "folder-1",
    name: "Comic",
    accountId: "acc-1",
    sortOrder: 0,
    unreadCount: 0,
    isExpanded: false,
    isSelected: false,
    feeds: [],
  },
  x: 10,
  y: 20,
};

describe("FeedTreeFolderDragOverlay", () => {
  it("follows the pointer without needing a new preview from the parent", () => {
    render(<FeedTreeFolderDragOverlay preview={preview} displayFavicons={false} />);
    const overlay = screen.getByTestId("feed-tree-folder-drag-overlay");
    expect(overlay.style.transform).toBe("translate3d(22px, 32px, 0)");

    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, clientY: 200 }));
    });

    expect(overlay.style.transform).toBe("translate3d(112px, 212px, 0)");
  });

  it("stops following the pointer once unmounted", () => {
    const { unmount } = render(<FeedTreeFolderDragOverlay preview={preview} displayFavicons={false} />);
    const overlay = screen.getByTestId("feed-tree-folder-drag-overlay");
    unmount();

    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, clientY: 200 }));

    expect(overlay.style.transform).toBe("translate3d(22px, 32px, 0)");
  });
});
