import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FolderContextMenuView } from "@/components/reader/folder-context-menu-view";
import { ContextMenu } from "@/design-system/context-menu";

describe("FolderContextMenuView", () => {
  it("disables move actions at visible order boundaries", () => {
    render(
      <ContextMenu.Root open>
        <FolderContextMenuView
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          moveUpLabel="Move up"
          moveDownLabel="Move down"
          resetOrderLabel="Reset folder order"
          folderOrderMode="manual"
          canMoveUp={false}
          canMoveDown
          onMarkAllRead={vi.fn()}
          onMarkOldUnreadRead={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onResetOrder={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.getByRole("menuitem", { name: "Move up" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Move down" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Reset folder order" })).toBeInTheDocument();
  });
});
