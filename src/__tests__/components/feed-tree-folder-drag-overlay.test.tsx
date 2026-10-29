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
  pointerId: 7,
  x: 10,
  y: 20,
};

function movePointer(pointerId: number, clientX: number, clientY: number) {
  window.dispatchEvent(Object.assign(new MouseEvent("pointermove", { clientX, clientY }), { pointerId }));
}

describe("FeedTreeFolderDragOverlay", () => {
  it("follows the pointer without needing a new preview from the parent", () => {
    render(<FeedTreeFolderDragOverlay preview={preview} displayFavicons={false} />);
    const overlay = screen.getByTestId("feed-tree-folder-drag-overlay");
    expect(overlay.style.transform).toBe("translate3d(22px, 32px, 0)");

    act(() => {
      movePointer(7, 100, 200);
    });

    expect(overlay.style.transform).toBe("translate3d(112px, 212px, 0)");
  });

  it("ignores moves from a pointer other than the one that started the drag", () => {
    render(<FeedTreeFolderDragOverlay preview={preview} displayFavicons={false} />);
    const overlay = screen.getByTestId("feed-tree-folder-drag-overlay");

    act(() => {
      movePointer(8, 100, 200);
    });

    expect(overlay.style.transform).toBe("translate3d(22px, 32px, 0)");
  });

  it("stops following the pointer once unmounted", () => {
    const { unmount } = render(<FeedTreeFolderDragOverlay preview={preview} displayFavicons={false} />);
    const overlay = screen.getByTestId("feed-tree-folder-drag-overlay");
    unmount();

    movePointer(7, 100, 200);

    expect(overlay.style.transform).toBe("translate3d(22px, 32px, 0)");
  });
});
