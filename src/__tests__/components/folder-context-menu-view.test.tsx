import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FolderContextMenuView } from "@/components/reader/folder-context-menu-view";
import { ContextMenu } from "@/design-system/context-menu";
import type { FolderOrderMode } from "@/lib/sidebar/folder-order";

function renderMenu(folderOrderMode: FolderOrderMode) {
  render(
    <ContextMenu.Root open>
      <FolderContextMenuView
        markAllReadLabel="Mark all as read"
        markOldUnreadReadLabel="Mark old unread as read"
        oldUnreadDayLabel={(days) => `${days} days`}
        resetOrderLabel="Reset folder order"
        folderOrderMode={folderOrderMode}
        onMarkAllRead={vi.fn()}
        onMarkOldUnreadRead={vi.fn()}
        onResetOrder={vi.fn()}
      />
    </ContextMenu.Root>,
  );
}

describe("FolderContextMenuView", () => {
  it("offers reset only in manual order mode and never offers move actions", () => {
    renderMenu("manual");

    expect(screen.getByRole("menuitem", { name: "Reset folder order" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /move (up|down)/i })).not.toBeInTheDocument();
  });

  it("hides reset in name order mode", () => {
    renderMenu("name");

    expect(screen.queryByRole("menuitem", { name: "Reset folder order" })).not.toBeInTheDocument();
  });
});
